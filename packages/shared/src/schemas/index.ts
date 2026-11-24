import { z } from "zod";
import {
  CONSENT_SCOPES,
  SPEECH_LIMITS,
  VIDEO_LIMITS,
  SUPPORTED_LANGUAGES,
  ASPECT_RATIOS,
  VIDEO_RESOLUTIONS,
  UPLOAD_LIMITS,
} from "../constants/index.js";

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .regex(/[a-zA-Z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

export const registerSchema = z.object({
  email: z.email().max(254),
  password: passwordSchema,
  name: z.string().trim().min(1).max(120).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.email().max(254),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).nullable().optional(),
});

export const voiceProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  language: z.string().max(10).optional(),
  referenceAssetId: z.uuid().optional(),
  consentConfirmed: z.literal(true, {
    error: "Voice cloning consent is required",
  }),
});
export type VoiceProfileInput = z.infer<typeof voiceProfileSchema>;

export const faceProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  referenceAssetId: z.uuid(),
  consentConfirmed: z.literal(true, {
    error: "Face animation consent is required",
  }),
});
export type FaceProfileInput = z.infer<typeof faceProfileSchema>;

export const consentSchema = z.object({
  scope: z.enum(CONSENT_SCOPES),
  granted: z.boolean(),
});
export type ConsentInput = z.infer<typeof consentSchema>;

export const uploadAuthorizeSchema = z.object({
  kind: z.enum(["voice_reference", "face_reference", "temporary_media"]),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().positive(),
});
export type UploadAuthorizeInput = z.infer<typeof uploadAuthorizeSchema>;

export const speechJobSchema = z.object({
  voiceProfileId: z.uuid(),
  text: z.string().trim().min(1).max(SPEECH_LIMITS.maxChars),
  language: z
    .enum(SUPPORTED_LANGUAGES.map((l) => l.code) as [string, ...string[]])
    .optional(),
});
export type SpeechJobInput = z.infer<typeof speechJobSchema>;

export const videoJobSchema = z.object({
  voiceProfileId: z.uuid(),
  faceProfileId: z.uuid(),
  script: z.string().trim().min(1).max(VIDEO_LIMITS.maxChars),
  language: z
    .enum(SUPPORTED_LANGUAGES.map((l) => l.code) as [string, ...string[]])
    .optional(),
  aspectRatio: z.enum(ASPECT_RATIOS.map((a) => a.value) as [string, ...string[]]).default("16:9"),
  resolution: z.enum(VIDEO_RESOLUTIONS.map((r) => r.value) as [string, ...string[]]).default("720p"),
  subtitles: z.boolean().default(false),
});
export type VideoJobInput = z.infer<typeof videoJobSchema>;

export const chatMessageSchema = z.object({
  conversationId: z.uuid().optional(),
  content: z.string().trim().min(1).max(8000),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const uploadLimits = UPLOAD_LIMITS;
