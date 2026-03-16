# PostgreSQL Local/Test Cutover Checklist

## Goal
Use this checklist to validate the PostgreSQL migration in local or test environments before any production cutover.

## Preconditions
- A PostgreSQL database is available and reachable from the app.
- `DATABASE_URL` points to PostgreSQL, not MySQL.
- Node dependencies are installed with `pnpm install`.

## 1. Schema Bootstrap
- For a brand-new PostgreSQL database, run `pnpm db:migrate`.
- If the local database was created earlier via `pnpm db:push`, run:
  - `pnpm exec tsx scripts/repair-migration-history.ts`
  - `pnpm db:migrate`
  - `pnpm db:verify:migrations`
- `pnpm db:verify:migrations` 现在会同时检查 `doctor_user_bindings`、`doctor_account_invites` 及其关键索引。
- Do not run the archived MySQL SQL migration files directly against PostgreSQL.

## 2. Seed and Backfill
- Run `pnpm import:doctors` to import the baseline doctor dataset.
- Run `pnpm exec tsx scripts/backfill-doctor-specialty-tags.ts` to restore specialty tags.
- Run `pnpm vectorize:doctors` if you want embedding JSON rows present for existing recommendation flows.
- Run `pnpm translate:bilingual` if the environment needs translated mirror fields.

## 3. App Verification
- Run `pnpm check`.
- Run `pnpm test server/appointments.test.ts server/visit.test.ts server/modules/visit/realtimeGateway.test.ts server/stripeWebhookRoute.test.ts`.
- Start the app with `pnpm dev`.
- Verify these flows manually:
  - guest access and OTP flow
  - AI triage session creation and completion
  - doctor search and recommendation
  - appointment draft creation and payment checkout redirection
  - appointment token access
  - visit room message send and history load
  - admin appointment list and summary reads

## 4. Data Sanity Checks
- Confirm doctor, department, and hospital counts match the source import expectations.
- Confirm `appointmentTokens`, `appointmentVisitSummaries`, and `visitRetentionPolicies` tables exist and accept writes.
- Confirm `doctorEmbeddings.embedding` stores JSON arrays successfully.

## 5. Rollback Readiness
- If you still have a legacy MySQL fallback, keep the old MySQL `DATABASE_URL` available until PostgreSQL validation passes.
- If local MySQL has already been retired, this item no longer applies to local development.
- If local/test verification fails, switch `DATABASE_URL` back and rerun `pnpm dev`.

## Current Known Gaps
- `pgvector` is intentionally not included in this phase.
- Production RDS provisioning and deployment variable switching are not covered by this checklist.
- MySQL-era migrations now live under `drizzle/archive/mysql/` and are not a valid PostgreSQL bootstrap path.
