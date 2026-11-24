import { api, apiUrl, getAccessToken } from "@/lib/api";
import type {
  VoiceProfileDTO, FaceProfileDTO, AssetDTO, GenerationJobDTO,
  ConsentDTO, ConversationDTO, MessageDTO, ChatCapabilities, UploadAuthorization, AuthUser,
} from "@echoself/shared/types";
import type { ConsentScope } from "@echoself/shared/constants";

/* ---------- Users ---------- */
export interface MeResponse extends AuthUser {
  stats: {
    voiceProfiles: number;
    faceProfiles: number;
    generatedAudio: number;
    generatedVideos: number;
    storageBytes: number;
  };
}
export const getMe = () => api<MeResponse>("/users/me");
export const updateMe = (name: string | null) => api<AuthUser>("/users/me", { method: "PATCH", body: JSON.stringify({ name }) });
export const deleteMe = () => api<{ ok: boolean }>("/users/me", { method: "DELETE" });

/* ---------- Consents ---------- */
export const listConsents = () => api<ConsentDTO[]>("/consents");
export const grantConsent = (scope: ConsentScope, granted: boolean) =>
  api<ConsentDTO>("/consents", { method: "POST", body: JSON.stringify({ scope, granted }) });
export const revokeConsent = (id: string) => api<{ ok: boolean }>(`/consents/${id}`, { method: "DELETE" });

/* ---------- Voices ---------- */
export const listVoices = () => api<VoiceProfileDTO[]>("/voices");
export const createVoice = (data: { name: string; language?: string; referenceAssetId?: string; consentConfirmed: true }) =>
  api<VoiceProfileDTO>("/voices", { method: "POST", body: JSON.stringify(data) });
export const deleteVoice = (id: string) => api<{ ok: boolean }>(`/voices/${id}`, { method: "DELETE" });

/* ---------- Faces ---------- */
export const listFaces = () => api<FaceProfileDTO[]>("/faces");
export const createFace = (data: { name: string; referenceAssetId: string; consentConfirmed: true }) =>
  api<FaceProfileDTO>("/faces", { method: "POST", body: JSON.stringify(data) });
export const updateFace = (id: string, data: { name?: string; referenceAssetId?: string }) =>
  api<FaceProfileDTO>(`/faces/${id}`, { method: "PATCH", body: JSON.stringify(data) });
export const deleteFace = (id: string) => api<{ ok: boolean }>(`/faces/${id}`, { method: "DELETE" });

/* ---------- Assets ---------- */
export const listAssets = (page = 1, pageSize = 50) =>
  api<AssetDTO[]>(`/assets?page=${page}&pageSize=${pageSize}`);

export async function uploadAsset(kind: "voice_reference" | "face_reference" | "temporary_media", file: File, onProgress?: (pct: number) => void): Promise<AssetDTO> {
  const auth = await api<UploadAuthorization>("/assets/uploads", {
    method: "POST",
    body: JSON.stringify({ kind, mimeType: (file.type || "application/octet-stream").split(";")[0], sizeBytes: file.size }),
  });
  const uploadUrl = auth.uploadUrl.startsWith("http") ? auth.uploadUrl : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}${auth.uploadUrl}`;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(auth.method, uploadUrl);
    for (const [k, v] of Object.entries(auth.headers)) xhr.setRequestHeader(k, v);
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
  await api(`/assets/${auth.assetId}/complete`, { method: "POST" });
  return api<AssetDTO>(`/assets/${auth.assetId}`);
}

export const getAssetAccessUrl = (id: string) => api<{ url: string; expiresIn: number }>(`/assets/${id}/access`);
export const deleteAsset = (id: string) => api<{ ok: boolean }>(`/assets/${id}`, { method: "DELETE" });
export const assetContentUrl = (id: string) => apiUrl(`/assets/${id}/content`);

/* ---------- Jobs ---------- */
export const createSpeechJob = (voiceProfileId: string, text: string, language?: string) =>
  api<{ id: string; state: string }>("/speech/jobs", { method: "POST", body: JSON.stringify({ voiceProfileId, text, language }) });
export const createVideoJob = (data: {
  voiceProfileId: string; faceProfileId: string; script: string;
  language?: string; aspectRatio?: string; resolution?: string; subtitles?: boolean;
}) => api<{ id: string; state: string }>("/videos/jobs", { method: "POST", body: JSON.stringify(data) });
export const listJobs = (page = 1) =>
  api<GenerationJobDTO[]>(`/jobs?page=${page}&pageSize=20`);
export const getJob = (id: string) => api<GenerationJobDTO>(`/jobs/${id}`);
export const cancelJob = (id: string) => api<{ ok: boolean }>(`/jobs/${id}/cancel`, { method: "POST" });

/* ---------- Chat ---------- */
export const chatCapabilities = () => api<ChatCapabilities>("/chat/capabilities", { auth: false }).catch(() => null);
export const listConversations = () => api<ConversationDTO[]>("/chat/conversations");
export const getConversation = (id: string) =>
  api<{ id: string; title: string | null; messages: MessageDTO[] }>(`/chat/conversations/${id}`);
export const deleteConversation = (id: string) => api<{ ok: boolean }>(`/chat/conversations/${id}`, { method: "DELETE" });
export const sendChatMessage = (content: string, conversationId?: string) =>
  api<{ conversationId: string; message: MessageDTO }>("/chat/messages", {
    method: "POST",
    body: JSON.stringify({ content, conversationId }),
  });
export const chatStreamUrl = () => `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/chat/messages/stream`;

/* ---------- Health / capabilities ---------- */
export const health = () =>
  api<{ status: string; db: string; storage: string; queue: string }>("/health/health", { auth: false });
export const aiCapabilities = () =>
  api<{
    service: string; device: string | null;
    voice: { available: boolean; model: string | null; mock: boolean; reason?: string };
    talkingFace: { available: boolean; model: string | null; mock: boolean; reason?: string };
  } | null>("/health/capabilities", { auth: false }).catch(() => null);
