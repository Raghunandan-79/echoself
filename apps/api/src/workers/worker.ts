import { prisma } from "../database/prisma.js";
import { storage } from "../storage/index.js";
import { createWorker, type JobPayload } from "../queues/index.js";
import { QUEUE_NAMES, R2_PREFIXES } from "@echoself/shared/constants";
import { generateSpeech, generateVideo, getCapabilities } from "../ai/client.js";
import { logger } from "../utils/logger.js";
import { randomUUID } from "node:crypto";

async function setProgress(jobId: string, progress: number, state?: "PROCESSING") {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { progress, ...(state ? { state, startedAt: state === "PROCESSING" ? new Date() : undefined } : {}) },
  });
}

async function failJob(jobId: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { state: "FAILED", error: message.slice(0, 1000), finishedAt: new Date() },
  });
  logger.error("job_failed", { jobId, err: message });
}

async function storeOutput(userId: string, kind: "generated_audio" | "generated_video", body: Buffer, mimeType: string, parentId?: string) {
  const assetId = randomUUID();
  const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("wav") ? "wav" : mimeType.includes("mpeg") ? "mp3" : "bin";
  const objectKey = `${R2_PREFIXES[kind]}${userId}/${assetId}.${ext}`;
  await storage.putObject(objectKey, body, mimeType);
  return prisma.asset.create({
    data: {
      id: assetId,
      userId,
      kind,
      objectKey,
      mimeType,
      sizeBytes: BigInt(body.length),
      status: "READY",
      parentId: parentId ?? null,
    },
  });
}

async function processSpeechJob(payload: JobPayload) {
  const { generationJobId, userId } = payload;
  const job = await prisma.generationJob.findUnique({
    where: { id: generationJobId },
    include: { voiceProfile: { include: { reference: true } } },
  });
  if (!job || job.state === "CANCELLED") return;
  try {
    await setProgress(job.id, 10, "PROCESSING");
    const input = job.input as { text: string; language?: string };
    const ref = job.voiceProfile?.reference;
    if (!ref) throw new Error("Voice profile has no reference audio");

    const refAudio = await storage.getObject(ref.objectKey);
    const caps = await getCapabilities();
    if (caps && !caps.voice.available && !caps.voice.mock) {
      throw new Error(caps.voice.reason ?? "Voice model unavailable");
    }

    await setProgress(job.id, 30);
    const result = await generateSpeech({
      text: input.text,
      language: input.language,
      referenceAudio: refAudio,
      referenceMime: ref.mimeType ?? undefined,
    });
    await setProgress(job.id, 85);
    const asset = await storeOutput(userId, "generated_audio", result.audio, result.mimeType);
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        state: "COMPLETED",
        progress: 100,
        outputAssetId: asset.id,
        finishedAt: new Date(),
        input: { ...input, model: result.model, mock: result.mock },
      },
    });
    await prisma.auditLog.create({ data: { userId, action: "speech.job.complete", resource: job.id } });
    logger.info("speech_job_completed", { jobId: job.id, mock: result.mock });
  } catch (err) {
    await failJob(job.id, err);
  }
}

async function processVideoJob(payload: JobPayload) {
  const { generationJobId, userId } = payload;
  const job = await prisma.generationJob.findUnique({
    where: { id: generationJobId },
    include: {
      voiceProfile: { include: { reference: true } },
      faceProfile: { include: { reference: true } },
    },
  });
  if (!job || job.state === "CANCELLED") return;
  try {
    await setProgress(job.id, 5, "PROCESSING");
    const input = job.input as {
      script: string; language?: string; aspectRatio?: string; resolution?: string; subtitles?: boolean;
    };
    const voiceRef = job.voiceProfile?.reference;
    const faceRef = job.faceProfile?.reference;
    if (!voiceRef || !faceRef) throw new Error("Missing voice or face reference");

    const caps = await getCapabilities();
    if (caps) {
      if (!caps.voice.available && !caps.voice.mock) throw new Error(caps.voice.reason ?? "Voice model unavailable");
      if (!caps.talkingFace.available && !caps.talkingFace.mock) throw new Error(caps.talkingFace.reason ?? "Talking-face model unavailable");
    }

    await setProgress(job.id, 15);
    const refAudio = await storage.getObject(voiceRef.objectKey);
    const speech = await generateSpeech({
      text: input.script,
      language: input.language,
      referenceAudio: refAudio,
      referenceMime: voiceRef.mimeType ?? undefined,
    });
    await setProgress(job.id, 45);

    const faceImage = await storage.getObject(faceRef.objectKey);
    const video = await generateVideo({
      audio: speech.audio,
      audioMime: speech.mimeType,
      faceImage,
      faceMime: faceRef.mimeType ?? undefined,
      script: input.script,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      subtitles: input.subtitles,
    });
    await setProgress(job.id, 90);

    const asset = await storeOutput(userId, "generated_video", video.video, video.mimeType);
    // keep the intermediate speech as an asset too
    const audioAsset = await storeOutput(userId, "generated_audio", speech.audio, speech.mimeType, asset.id);
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        state: "COMPLETED",
        progress: 100,
        outputAssetId: asset.id,
        finishedAt: new Date(),
        input: { ...input, voiceModel: speech.model, faceModel: video.model, voiceMock: speech.mock, faceMock: video.mock },
      },
    });
    await prisma.auditLog.create({ data: { userId, action: "video.job.complete", resource: job.id } });
    logger.info("video_job_completed", { jobId: job.id, audioAssetId: audioAsset.id });
  } catch (err) {
    await failJob(job.id, err);
  }
}

async function main() {
  logger.info("worker_starting", { queues: [QUEUE_NAMES.VOICE, QUEUE_NAMES.VIDEO] });
  await createWorker(QUEUE_NAMES.VOICE, processSpeechJob);
  await createWorker(QUEUE_NAMES.VIDEO, processVideoJob);
  logger.info("worker_ready");

  const shutdown = async () => {
    logger.info("worker_shutting_down");
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("worker_fatal", { err: String(err) });
  process.exit(1);
});
