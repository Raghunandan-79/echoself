# API Specification

Base URL: `http://localhost:4000/api/v1` · Auth: `Authorization: Bearer <accessToken>` (refresh via `POST /auth/refresh`, cookie `es_refresh`).

All responses: `{ "data": ... }` or `{ "error": { "code", "message", "details" } }`.

## Auth
- POST /auth/register {email,password,name?} → {accessToken,user}
- POST /auth/login {email,password} → {accessToken,user}
- POST /auth/refresh → rotates session, returns new accessToken
- POST /auth/logout → revokes session
- POST /auth/forgot-password {email} → always 200 (no enumeration)
- POST /auth/reset-password {token,password}

## Users
- GET /users/me → profile + stats (voices, faces, audio, videos, storageBytes)
- PATCH /users/me {name?}
- DELETE /users/me → deletes all owned objects then anonymizes account

## Consents
- POST /consents {scope,granted} — scope ∈ voice_cloning|face_animation|biometric_storage|external_processing
- GET /consents → latest per scope
- DELETE /consents/:id → revoke

## Voices
- POST /voices {name,language?,referenceAssetId?,consentConfirmed:true} — requires active voice_cloning consent
- GET /voices, GET /voices/:id, DELETE /voices/:id

## Faces
- POST /faces {name,referenceAssetId,consentConfirmed:true} — requires active face_animation consent
- GET /faces, GET /faces/:id, PATCH /faces/:id, DELETE /faces/:id

## Assets (private media)
- POST /assets/uploads {kind,mimeType,sizeBytes} → {assetId,uploadUrl,method,headers,expiresAt}
  - kind ∈ voice_reference|face_reference|temporary_media
  - R2 driver: uploadUrl is a presigned PUT to R2. Local driver: PUT to `/assets/:id/content`.
- PUT /assets/:id/content (local driver only) — raw body upload
- POST /assets/:id/complete → verifies object exists (HeadObject), marks UPLOADED
- GET /assets → paginated list
- GET /assets/:id → metadata
- GET /assets/:id/access → {url,expiresIn:300} presigned GET or signed local URL
- GET /assets/:id/content → streams bytes (authenticated)
- DELETE /assets/:id → deletes object + detaches profile references

## Generation
- POST /speech/jobs {voiceProfileId,text,language?} → {id,state} (max 5000 chars; idempotent per voice+text)
- POST /videos/jobs {voiceProfileId,faceProfileId,script,language?,aspectRatio?,resolution?,subtitles?} → {id,state} (max 2000 chars; one active video job per user)
- GET /jobs?page=&pageSize= · GET /jobs/:id · POST /jobs/:id/cancel

## Chat (EchoBot)
- GET /chat/capabilities → {available,provider,model,streaming,reason?}
- POST /chat/messages {content,conversationId?} → {conversationId,message}
- POST /chat/messages/stream → SSE (`data: {delta}` … `data: {done,conversationId}`)
- GET /chat/conversations · GET /chat/conversations/:id · DELETE /chat/conversations/:id

## Health
- GET /health/health → {status,db,storage,queue}
- GET /health/capabilities → AI service capabilities proxy
