# Legacy Token Field Retirement Plan

## Current status
- Runtime token validation is fully based on `appointmentTokens`.
- Deprecated columns on `appointments` are no longer read in runtime logic:
  - `accessTokenHash`
  - `doctorTokenHash`
  - `accessTokenExpiresAt`
  - `accessTokenRevokedAt`
  - `doctorTokenRevokedAt`

## 1) Backfill plan (for historical rows)
Run one-time backfill to copy legacy hashes into `appointmentTokens`.

Command:
```bash
pnpm tokens:backfill-legacy
```

Script:
- `scripts/backfill-legacy-appointment-tokens.ts`

Behavior:
- Migrates patient and doctor hashes from `appointments` into `appointmentTokens`.
- Preserves revoked/expires semantics by mapping:
  - patient revoked -> `accessTokenRevokedAt`
  - doctor revoked -> `doctorTokenRevokedAt`
  - expires -> `accessTokenExpiresAt` (or fallback timestamps if null)
- Deduplicates by `(appointmentId, role, tokenHash)` using `NOT EXISTS`.

## 2) Deprecation and misuse prevention
- Schema fields are marked `@deprecated` in `drizzle/schema.ts`.
- Runtime guard test prevents reintroduction of old-field reads:
  - `server/legacy-token-usage-guard.test.ts`

## 3) Suggested removal timeline
- T0: deploy token-table-only runtime + backfill script.
- T0 + 1 day: run backfill in production.
- T0 + 14 days: monitor for token validation/auth anomalies.
- T0 + 30 days: execute drop migration for legacy columns.

## 4) Optional final migration (drop old columns)
After observation window, run a migration equivalent to:

```sql
ALTER TABLE appointments DROP INDEX doctorTokenHashIdx;
ALTER TABLE appointments DROP COLUMN accessTokenHash;
ALTER TABLE appointments DROP COLUMN doctorTokenHash;
ALTER TABLE appointments DROP COLUMN accessTokenExpiresAt;
ALTER TABLE appointments DROP COLUMN accessTokenRevokedAt;
ALTER TABLE appointments DROP COLUMN doctorTokenRevokedAt;
```

## 5) Why system stays available after column drop
- Validation path uses `appointmentTokens` only (`validateAppointmentToken`).
- Auth magic-link verification resolves by `appointmentTokens` and then uses `validateAppointmentToken`.
- Resend/issuance writes `appointmentTokens` only.
