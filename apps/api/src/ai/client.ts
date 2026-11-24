import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { unavailable } from "../utils/errors.js";

export interface AiCapabilities {
  service: string;
  voice: { available: boolean; model: string | null; mock: boolean; reason?: string };
  talkingFace: { available: boolean; model: string | null; mock: boolean; reason?: string };
  device: string | null;
}

export interface VoiceGenerateResult {
  audio: Buffer;
  mimeType: string;
  model: string;
  mock: boolean;
  durationSeconds?: number;
}

export interface VideoGenerateResult {
  video: Buffer;
  mimeType: string;
  model: string;
  mock: boolean;
  durationSeconds?: number;
}

async function aiFetch(path: string, init?: RequestInit, timeoutMs = 30_000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.AI_SERVICE_TOKEN) headers["X-AI-Token"] = env.AI_SERVICE_TOKEN;
    const res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

export async function getCapabilities(): Promise<AiCapabilities | null> {
  try {
    const res = await aiFetch("/internal/capabilities", {}, 5000);
    if (!res.ok) return null;
    return (await res.json()) as AiCapabilities;
  } catch (err) {
    logger.debug("ai_capabilities_unreachable", { err: String(err) });
    return null;
  }
}

export async function generateSpeech(params: {
  text: string;
  language?: string;
  referenceAudio: Buffer;
  referenceMime?: string;
  speakerWav?: Buffer;
}): Promise<VoiceGenerateResult> {
  const form = new FormData();
  form.append("text", params.text);
  if (params.language) form.append("language", params.language);
  form.append(
    "reference_audio",
    new Blob([new Uint8Array(params.referenceAudio)], { type: params.referenceMime ?? "audio/wav" }),
    "reference.wav",
  );
  if (params.speakerWav) {
    form.append("speaker_wav", new Blob([new Uint8Array(params.speakerWav)], { type: "audio/wav" }), "speaker.wav");
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10 * 60_000);
  try {
    const headers: Record<string, string> = {};
    if (env.AI_SERVICE_TOKEN) headers["X-AI-Token"] = env.AI_SERVICE_TOKEN;
    const res = await fetch(`${env.AI_SERVICE_URL}/internal/voice/generate`, {
      method: "POST",
      body: form,
      headers,
      signal: controller.signal,
    });
    if (res.status === 503) {
      const body = (await res.json().catch(() => ({}))) as { detail?: string };
      throw unavailable(body.detail ?? "AI voice service unavailable");
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(body.detail ?? `Voice generation failed (${res.status})`);
    }
    const audio = Buffer.from(await res.arrayBuffer());
    const meta = {
      model: res.headers.get("X-Model") ?? "unknown",
      mock: res.headers.get("X-Mock") === "true",
      mimeType: res.headers.get("Content-Type") ?? "audio/wav",
      durationSeconds: Number(res.headers.get("X-Duration") ?? 0) || undefined,
    };
    return { audio, ...meta };
  } finally {
    clearTimeout(t);
  }
}

export async function generateVideo(params: {
  audio: Buffer;
  audioMime?: string;
  faceImage: Buffer;
  faceMime?: string;
  script?: string;
  aspectRatio?: string;
  resolution?: string;
  subtitles?: boolean;
}): Promise<VideoGenerateResult> {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(params.audio)], { type: params.audioMime ?? "audio/wav" }), "speech.wav");
  form.append("face_image", new Blob([new Uint8Array(params.faceImage)], { type: params.faceMime ?? "image/jpeg" }), "face.jpg");
  if (params.script) form.append("script", params.script);
  if (params.aspectRatio) form.append("aspect_ratio", params.aspectRatio);
  if (params.resolution) form.append("resolution", params.resolution);
  if (params.subtitles) form.append("subtitles", "true");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 30 * 60_000);
  try {
    const headers: Record<string, string> = {};
    if (env.AI_SERVICE_TOKEN) headers["X-AI-Token"] = env.AI_SERVICE_TOKEN;
    const res = await fetch(`${env.AI_SERVICE_URL}/internal/video/generate`, {
      method: "POST",
      body: form,
      headers,
      signal: controller.signal,
    });
    if (res.status === 503) {
      const body = (await res.json().catch(() => ({}))) as { detail?: string };
      throw unavailable(body.detail ?? "AI video service unavailable");
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(body.detail ?? `Video generation failed (${res.status})`);
    }
    const video = Buffer.from(await res.arrayBuffer());
    return {
      video,
      mimeType: res.headers.get("Content-Type") ?? "video/mp4",
      model: res.headers.get("X-Model") ?? "unknown",
      mock: res.headers.get("X-Mock") === "true",
      durationSeconds: Number(res.headers.get("X-Duration") ?? 0) || undefined,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function processMedia(params: { operation: string; input: Buffer; inputMime?: string; options?: Record<string, unknown> }) {
  const form = new FormData();
  form.append("operation", params.operation);
  form.append("input", new Blob([new Uint8Array(params.input)], { type: params.inputMime ?? "application/octet-stream" }), "input.bin");
  if (params.options) form.append("options", JSON.stringify(params.options));
  const res = await aiFetch("/internal/media/process", { method: "POST", body: form }, 15 * 60_000);
  if (!res.ok) throw new Error(`Media processing failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
