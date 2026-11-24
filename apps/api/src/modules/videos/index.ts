import { Router } from "express";
import { videoJobSchema } from "@echoself/shared/schemas";
import { QUEUE_NAMES } from "@echoself/shared/constants";
import { prisma } from "../../database/prisma.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { badRequest, notFound, conflict } from "../../utils/errors.js";
import { hasActiveConsent } from "../consents/index.js";
import { enqueueJob } from "../../queues/index.js";

export const videosRouter: Router = Router();
videosRouter.use(requireAuth);

videosRouter.post("/jobs", validate(videoJobSchema), async (req, res, next) => {
  try {
    const { voiceProfileId, faceProfileId, script, language, aspectRatio, resolution, subtitles } = req.body;

    const [voice, face] = await Promise.all([
      prisma.voiceProfile.findFirst({ where: { id: voiceProfileId, userId: req.userId!, status: "ACTIVE" }, include: { reference: true } }),
      prisma.faceProfile.findFirst({ where: { id: faceProfileId, userId: req.userId!, status: "ACTIVE" }, include: { reference: true } }),
    ]);
    if (!voice) throw notFound("Voice profile not found");
    if (!face) throw notFound("Face profile not found");
    if (!voice.reference) throw badRequest("Voice profile has no reference audio");
    if (!face.reference) throw badRequest("Face profile has no reference image");

    if (!(await hasActiveConsent(req.userId!, "voice_cloning")) || !(await hasActiveConsent(req.userId!, "face_animation"))) {
      throw badRequest("Both voice_cloning and face_animation consents must be active");
    }

    // one active video job per user at a time (GPU-bound local inference)
    const active = await prisma.generationJob.findFirst({
      where: { userId: req.userId!, type: "VIDEO", state: { in: ["PENDING", "QUEUED", "PROCESSING"] } },
    });
    if (active) throw conflict("A video generation job is already in progress");

    const job = await prisma.generationJob.create({
      data: {
        userId: req.userId!,
        type: "VIDEO",
        state: "PENDING",
        voiceProfileId: voice.id,
        faceProfileId: face.id,
        input: { script, language: language ?? voice.language ?? "en", aspectRatio, resolution, subtitles },
      },
    });

    const queueJobId = await enqueueJob(QUEUE_NAMES.VIDEO, {
      generationJobId: job.id,
      userId: req.userId!,
      type: "VIDEO",
    });
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { state: "QUEUED", queueJobId, progress: 5 },
    });
    await prisma.auditLog.create({ data: { userId: req.userId!, action: "video.job.create", resource: job.id } });

    res.status(201).json({ data: { id: job.id, state: "QUEUED" } });
  } catch (err) {
    next(err);
  }
});
