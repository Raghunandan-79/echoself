# EchoSelf

Privacy-first AI digital twin platform: clone your voice, animate your face, generate talking-head videos — all on open-source, local models. Zero paid API dependencies.

## Stack
- **Web**: Next.js 16, React 19, Tailwind v4, TanStack Query, Zustand, RHF+Zod (`apps/web`)
- **API**: Express 5, TypeScript, Prisma, Postgres, BullMQ/Redis, R2/local storage (`apps/api`)
- **AI**: FastAPI + PyTorch adapters (XTTS-v2 candidate, SadTalker/Wav2Lip, Ollama LLM) (`services/ai`)
- **Shared**: `@echoself/shared` (Zod schemas, types, constants)

## Quick start
```bash
bun install
docker compose -f infrastructure/docker-compose.yml up -d   # postgres:5433, redis:6379
cd apps/api && cp .env.example .env && bun run db:migrate && bun run db:seed
cd ../.. && bun run dev          # web :3000, api :4000, docs :3001
cd apps/api && bun run worker    # job worker (separate terminal)
cd services/ai && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/uvicorn app.main:app --port 8000
```

See `docs/setup.md` for full instructions and `docs/` for architecture, API spec, privacy model, cost analysis and AI model notes.

Demo login: `demo@echoself.local` / `DemoPass123!`
