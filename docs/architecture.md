# EchoSelf Architecture

## Overview

EchoSelf is a privacy-first AI digital twin platform built as a Turborepo + Bun monorepo.

```
apps/
  web/          Next.js 16 (App Router) — public site + authenticated studios
  docs/         Next.js docs starter (unchanged)
  api/          Express 5 + TypeScript + Prisma — REST API, queues, workers, storage
services/
  ai/           Python 3.12 FastAPI — local model inference (voice, talking-face, media)
packages/
  shared/       Zod schemas, DTO types, constants shared by web + api
  ui/           Shared React components (starter stub)
  typescript-config/, eslint-config/
infrastructure/
  docker-compose.yml   Local Postgres + Redis (optional; system services also work)
docs/           Architecture, DB design, API spec, privacy, cost, AI models, setup
```

## Request flow

1. Browser → `apps/web` (Next.js) → `apps/api` (`/api/v1`) → Postgres (Neon or local) + Redis (Upstash or local) + R2 (or local disk driver).
2. Generation requests create a `GenerationJob` row (PENDING) then enqueue to BullMQ (`voice-generation`, `video-generation`).
3. `apps/api` worker processes jobs: fetches private references from storage → calls `services/ai` FastAPI → stores outputs → marks COMPLETED.
4. Frontend polls `GET /jobs/:id` for progress.

## Storage

- `STORAGE_DRIVER=r2` → Cloudflare R2 via AWS SDK v3 (presigned PUT/GET).
- `STORAGE_DRIVER=local` → filesystem under `apps/api/storage/` for development. Access via short-lived token URLs. **Dev only.**

## Queue fallback

- `REDIS_URL` set → BullMQ on Redis/Upstash.
- `REDIS_URL` empty → in-memory queue (jobs run in-process; lost on restart). **Dev only.**

## AI service

- `services/ai` exposes `/health`, `/internal/capabilities`, `/internal/voice/generate`, `/internal/video/generate`, `/internal/media/process`.
- Adapters: `voice.py` (Coqui XTTS-v2 candidate), `talking_face.py` (SadTalker/Wav2Lip detection), `llm.py` (Ollama).
- When models/ffmpeg are unavailable and `ENABLE_MOCK=true`, endpoints return clearly-labelled synthetic output (`X-Mock: true`). Mock output is never presented as real inference.

## Auth

Argon2id password hashing, JWT access tokens (15m), rotating refresh tokens stored as SHA-256 hashes in `sessions`, HttpOnly cookie + body token support, session revocation on logout/reset/delete.

## Security

Helmet, CORS locked to `WEB_ORIGIN`, rate limiting (global + auth), Zod validation on every input, ownership checks on every user resource, audit log table, no secrets in repo.
