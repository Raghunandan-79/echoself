# Privacy Model

## Principles
- Biometric data (voice refs, face refs) is the most sensitive asset class.
- Consent is explicit, versioned, timestamped, revocable, and enforced server-side.
- Media never lives in Postgres — only metadata + object keys.
- Media is never publicly addressable — presigned URLs only, minted after ownership checks.
- Inference runs locally; no biometric data goes to third-party APIs.

## Consent scopes
| Scope | Gates |
|---|---|
| voice_cloning | Creating voice profiles, speech jobs, video jobs |
| face_animation | Creating face profiles, video jobs |
| biometric_storage | (reserved) storing biometric references |
| external_processing | (reserved) sending data to external processors |

Latest consent record per scope wins. `granted=false` or `revokedAt` set → inactive.
Voice/face/job endpoints return 400 if required consent is inactive.

## Deletion
- Asset delete → storage object removed + profile references detached (status → PENDING).
- Profile delete → status DELETED (soft; row retained for audit).
- Account delete (DELETE /users/me) → every owned object deleted from storage, sessions revoked, email anonymized (`deleted-<uuid>@deleted.local`), `deletedAt` set. Rows cascade-delete via FK.

## Audit
AuditLog records register, consent grant/revoke, voice/face create/delete, job create/complete, asset delete, account delete — with userId, action, resource, ip.

## Synthetic media
Generated videos are labeled "synthetic media" in the UI and flagged `mock` in job input when produced by the dev fallback renderer. Face detection (client-side quality checks) is explicitly not identity verification.
