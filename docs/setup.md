# Setup

## Prerequisites
- Bun 1.4+, Node 24+, Python 3.12, Docker (optional), FFmpeg (`apt install ffmpeg`), Ollama (optional, for EchoBot).

## 1. Install JS deps
```bash
bun install
```

## 2. Start local infra (or use Neon/Upstash)
```bash
docker compose -f infrastructure/docker-compose.yml up -d
# Postgres → localhost:5433 (5432 may be taken), Redis → localhost:6379
```

## 3. Configure API
```bash
cd apps/api
cp .env.example .env   # defaults work with local docker; set JWT_SECRET for anything real
bun run db:migrate     # creates schema
bun run db:seed        # optional demo user
```

## 4. Run services
```bash
# from repo root — runs web(3000) + api(4000) + docs(3001) via turbo
bun run dev

# workers (separate terminal, required for generation jobs):
cd apps/api && bun run worker:dev

# AI service:
cd services/ai && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000

# EchoBot (optional):
ollama pull qwen2.5:7b && ollama serve
```

## 5. Verify
- `curl localhost:4000/api/v1/health/health`
- `curl localhost:8000/internal/capabilities`
- Open http://localhost:3000 → register → dashboard.

## Environment variables
See `apps/api/.env.example` and `apps/web/.env.example`. Key ones:
- `DATABASE_URL` — Postgres (Neon or local)
- `REDIS_URL` — Upstash or `redis://localhost:6379` (empty = in-memory dev queue)
- `STORAGE_DRIVER` — `r2` (needs R2_* vars) or `local` (dev)
- `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `OLLAMA_URL`, `OLLAMA_MODEL`

## Cloudflare R2 setup
1. Create bucket `echoself-private` (private, no public access).
2. Create R2 API token (Object Read & Write) scoped to the bucket.
3. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT=https://<acct>.r2.cloudflarestorage.com`, `STORAGE_DRIVER=r2`.
4. Configure bucket CORS for `PUT`/`GET` from your frontend origin.

## Deploy modes
- **Mode A (local)**: everything above on your machine.
- **Mode B (free cloud)**: web → Vercel Hobby; api → Render/Railway free (note: no persistent workers — run `bun run worker` + AI service locally, or use a job-pull design); DB → Neon; Redis → Upstash; storage → R2; AI worker stays local and must reach the API's queue (BullMQ needs Redis reachable — use Upstash TLS endpoint).
