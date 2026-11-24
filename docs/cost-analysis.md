# Cost Analysis — Zero Paid APIs

Core functionality requires **no paid API keys**. All external services used have free tiers; local inference is free/open-source.

## External services

| Service | Free tier | Limits / notes | Card required? |
|---|---|---|---|
| Neon Postgres | ~0.5 GB storage, 190 compute hrs/mo | Autosuspend; fine for dev/small use | No (historically) |
| Upstash Redis | 10k commands/day free | BullMQ needs persistent Redis protocol — Upstash supports it; watch daily cap | No |
| Cloudflare R2 | 10 GB storage, 1M Class A / 10M Class B ops/mo | Egress free; bucket `echoself-private` | No |
| Vercel Hobby | Frontend hosting | Non-commercial only; serverless limits | No |
| Render/Railway free | API hosting options | Cold starts, ephemeral FS — workers must run locally | Varies |
| Ollama | Free, local | Model download size only | No |

## Local (always free)
- Express API, Next.js, Postgres/Redis via docker-compose, FastAPI AI service, FFmpeg, PyTorch, XTTS-v2 / SadTalker / Wav2Lip (open weights — verify licenses in ai-models.md).

## What we do NOT use
OpenAI/Anthropic/ElevenLabs/HeyGen/Runway/paid TTS or paid storage. No service auto-upgrades billing.

## Staying inside free tiers
- R2: monitor `sizeBytes` sums (dashboard shows usage); quotas enforced via `USER_STORAGE_QUOTA_BYTES`.
- Upstash: 10k cmds/day — keep polling intervals ≥2s; prefer job-state polling over chatty updates.
- Neon: autosuspend OK; run `prisma migrate deploy` on deploy.
- Local AI: models load on demand; mock mode keeps CPU inference optional.

## Alternatives if a free tier is exceeded
Local Postgres/Redis (docker-compose), local disk storage driver (dev), local LLM via Ollama — all documented in setup.md.
