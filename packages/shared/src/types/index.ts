import type { JobState, ConsentScope, AssetKind } from "../constants/index.js";

export interface ApiResponse<T = unknown> {
  data: T;
  meta?: { page?: number; pageSize?: number; total?: number };
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface VoiceProfileDTO {
  id: string;
  name: string;
  language: string | null;
  status: string;
  referenceAssetId: string | null;
  createdAt: string;
}

export interface FaceProfileDTO {
  id: string;
  name: string;
  status: string;
  referenceAssetId: string | null;
  createdAt: string;
}

export interface AssetDTO {
  id: string;
  kind: AssetKind;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
}

export interface GenerationJobDTO {
  id: string;
  type: "SPEECH" | "VIDEO";
  state: JobState;
  progress: number;
  error: string | null;
  input: Record<string, unknown>;
  outputAssetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsentDTO {
  id: string;
  scope: ConsentScope;
  version: string;
  granted: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export interface ConversationDTO {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatCapabilities {
  available: boolean;
  provider: string;
  model: string | null;
  streaming: boolean;
  reason?: string;
}

export interface UploadAuthorization {
  assetId: string;
  objectKey: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresAt: string;
}
