# Database Design (Prisma + PostgreSQL)

Provider: Neon PostgreSQL free tier (or local Postgres via docker-compose / system service).

All IDs are UUIDs (`@db.Uuid`). Metadata and object keys only — never media blobs.

## Models

| Model | Purpose | Key fields |
|---|---|---|
| User | Accounts | email (unique), passwordHash (argon2id), deletedAt (soft delete) |
| Session | Refresh tokens | refreshHash (unique, sha256), expiresAt, revokedAt |
| PasswordResetToken | Password resets | tokenHash, expiresAt, usedAt |
| Consent | Privacy consents | scope enum, version, granted, revokedAt; latest-per-scope wins |
| VoiceProfile | Voice identities | userId, name, language, status, referenceAssetId |
| FaceProfile | Face identities | userId, name, status, referenceAssetId |
| Avatar | Named avatar combos | userId, voiceId, faceId |
| Asset | Media metadata | kind, objectKey (unique), mimeType, sizeBytes, status, parentId (derivation) |
| GenerationJob | Background jobs | type (SPEECH/VIDEO/MEDIA), state, progress, queueJobId, idempotencyKey (unique), input JSON, outputAssetId |
| Conversation / Message | EchoBot history | userId, role, content |
| AuditLog | Security audit | userId, action, resource, metadata, ipAddress |

## Enums

- JobState: PENDING → QUEUED → PROCESSING → COMPLETED | FAILED | CANCELLED
- JobType: SPEECH | VIDEO | MEDIA
- AssetStatus: PENDING_UPLOAD → UPLOADED → PROCESSING → READY | FAILED | DELETED
- ProfileStatus: ACTIVE | PENDING | DISABLED | DELETED
- ConsentScope: voice_cloning | face_animation | biometric_storage | external_processing

## Integrity

- FK cascades: user delete cascades sessions/consents/profiles/assets/jobs/conversations.
- `referenceAssetId` uses `onDelete: SetNull` so deleting a reference doesn't destroy the profile row.
- Asset self-relation `parentId` links derived outputs (e.g., speech audio produced during a video job).
- Indexes on (userId), (userId, state), (status), (userId, kind), idempotencyKey unique.

## Migrations

`bun run db:migrate` (apps/api) — Prisma migrations live in `apps/api/prisma/migrations/`.
Seed: `bun run db:seed` creates `demo@echoself.local` / `DemoPass123!`.
