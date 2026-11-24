export const API_PREFIX = "/api/v1";

export const JOB_STATES = [
  "PENDING",
  "QUEUED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type JobState = (typeof JOB_STATES)[number];

export const QUEUE_NAMES = {
  VOICE: "voice-generation",
  VIDEO: "video-generation",
  MEDIA: "media-processing",
} as const;

export const CONSENT_SCOPES = [
  "voice_cloning",
  "face_animation",
  "biometric_storage",
  "external_processing",
] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];

export const CONSENT_VERSIONS: Record<ConsentScope, string> = {
  voice_cloning: "1.0",
  face_animation: "1.0",
  biometric_storage: "1.0",
  external_processing: "1.0",
};

export const ASSET_KINDS = [
  "voice_reference",
  "face_reference",
  "generated_audio",
  "generated_video",
  "temporary_media",
] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const R2_PREFIXES: Record<AssetKind, string> = {
  voice_reference: "voice-references/",
  face_reference: "face-references/",
  generated_audio: "generated-audio/",
  generated_video: "generated-videos/",
  temporary_media: "temporary-media/",
};

export const UPLOAD_LIMITS = {
  voice_reference: { maxBytes: 50 * 1024 * 1024, mimeTypes: ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/ogg", "audio/flac"] },
  face_reference: { maxBytes: 20 * 1024 * 1024, mimeTypes: ["image/jpeg", "image/png", "image/webp"] },
  temporary_media: { maxBytes: 200 * 1024 * 1024, mimeTypes: ["audio/*", "video/*", "image/*"] },
} as const;

export const SPEECH_LIMITS = { maxChars: 5000, defaultLanguage: "en" } as const;
export const VIDEO_LIMITS = { maxChars: 2000 } as const;

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "ru", label: "Russian" },
  { code: "nl", label: "Dutch" },
  { code: "cs", label: "Czech" },
  { code: "ar", label: "Arabic" },
  { code: "zh-cn", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "hi", label: "Hindi" },
] as const;

export const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 Landscape" },
  { value: "9:16", label: "9:16 Portrait" },
  { value: "1:1", label: "1:1 Square" },
] as const;

export const VIDEO_RESOLUTIONS = [
  { value: "480p", label: "480p" },
  { value: "720p", label: "720p" },
] as const;

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_DAYS = 30;

export const PAGE_SIZE_DEFAULT = 20;
export const PAGE_SIZE_MAX = 100;
