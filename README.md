# MediBridge SaaS Platform

MediBridge is a Node.js + React SaaS platform for AI triage, doctor discovery, appointment booking, and visit messaging.

This README is the onboarding overview. The canonical placement and dependency
contract is [`.context/architecture.md`](./.context/architecture.md); detailed
implementation and operations material is indexed in
[`docs/README.md`](./docs/README.md).

## Tech Stack

- Frontend: React 19, Vite, TypeScript, TanStack Query, tRPC client
- Backend: Express, tRPC server, TypeScript
- Database: PostgreSQL + Drizzle ORM
- Auth: Progressive Profiling (Guest shadow account + passwordless OTP + Magic Link)

## Quick Start

Use Node.js 24 and the repository-pinned pnpm version through Corepack.

1. Install dependencies

```bash
pnpm install
```

2. Run DB migrations (safe mode, recommended)

```bash
pnpm db:migrate:safe
```

3. Start dev server

```bash
pnpm dev
```

For local OTP login without an email provider, configure a private,
Git-ignored `.env.development` with an explicit allowlist and six-digit code:

```dotenv
LOCAL_OTP_ENABLED=true
LOCAL_OTP_EMAILS=local@example.test
LOCAL_OTP_CODE=replace-with-six-digits
```

The fixed code is accepted only by `pnpm dev`, which marks the runtime as
`development` and release channel `local`. It is not returned by the API or
written to logs, and it is rejected by `dev` and `main` release artifacts.

4. Type check

```bash
pnpm check
```

5. Run tests

```bash
pnpm test
```

## Project Map

### Frontend Domain Structure (`client/src/features/*`)

- `features/auth`: passwordless auth UX, OTP login modal, auth hooks, deviceId handling
- `features/triage`: AI triage chat flow, session lifecycle, doctor recommendation UI
- `features/hospitals`: hospitals/doctor browsing and detail experiences
- `features/appointment`: appointment creation and token-based access flows
- `features/visit`: real-time visit room message UI

### Backend Domain Structure (`server/modules/*`)

- `modules/auth`: user repository, guest/formal user resolution, merge utilities
- `modules/ai`: triage service and AI session/message repository layer
- `modules/appointments`: appointment persistence and magic-link related DB operations
- `modules/visit`: visit/patient-session and appointment message persistence
- `modules/referrals`: hospital referral orders, coordinator fulfillment, SLA,
  refunds, and notification outbox workers
- `modules/chat`: chat-oriented business composition
- `modules/doctors`: doctor search and recommendation repositories
- `modules/hospitals`: hospital and department query repositories
- `routerApi.ts`: the module boundary used by its HTTP/tRPC router
- `publicApi.ts`: the minimal module boundary used by workflows or other modules

### Application Workflows (`server/workflows/*`)

- `appointmentBooking`: appointment creation and scheduling orchestration
- `appointmentPayments`: payment settlement and appointment lifecycle orchestration
- `appointmentMedicalSummary`: medical-summary generation orchestration
- `appointmentAutoClose`: inactive visit closure across appointment and visit modules
- `authGuestUpgrade`: guest-owned asset merge after formal authentication

### API Layer (`server/routers/*`)

- `routers/auth.ts`: OTP request, OTP verify + merge, magic-link verify, logout
- `routers/ai.ts`: triage session creation, message sending, triage orchestration endpoints
- `routers/doctors.ts`, `routers/hospitals.ts`, `routers/chat.ts`: discovery and conversational routes
- `routers/appointments.ts`: booking, appointment access and visit-chat token exchange
- `routers/visit.ts`: visit room message operations
- `routers/system.ts`: thin composition preserving the existing `trpc.system.*` contract

### Infrastructure

- `server/_core/*`: tRPC bootstrap, context, env, SDK, cookie/session, mailer, LLM adapter
- `drizzle/schema.ts`: source of truth for schema
- `drizzle/*.sql` + `drizzle/meta/*`: PostgreSQL migrations and snapshots
- `drizzle/archive/mysql/*`: archived MySQL-era migration history
- `shared/*`: cross-runtime constants and shared types

### Email (Resend) Configuration

- `RESEND_API_KEY`: Resend API key used in production.
- `RESEND_FROM`: optional, overrides `MAIL_FROM` for sender address.
- `MAIL_FROM`: fallback sender address (e.g. `MediBridge <no-reply@your-domain.com>`).
- `REFERRAL_OPS_EMAILS`: comma-separated operations recipients for paid
  referral orders and refund/notification failures.
- `APP_BASE_URL`: public application origin used in referral order email links.

Minimal production setup checklist:

1. Configure DNS for your sending domain in Resend (SPF/DKIM/DMARC as required by your provider dashboard).
2. Set `RESEND_API_KEY` and `MAIL_FROM`/`RESEND_FROM` in `.env`.
3. Ensure `NODE_ENV=production` when deploying.
4. Send a test link and verify delivery in Resend logs.

Common failures:

- `401` / `403`: invalid or revoked API key, or sender domain mismatch.
- `422`: invalid `from`/recipient format or message payload rejected by provider.
- `4xx/5xx` with empty body: transient provider issue or temporary invalid domain status.

### Referral Stripe Configuration

- `REFERRAL_PAYMENT_MODE=provider|mock`: controls referral checkout behavior.
  It defaults to `provider`. `mock` is allowed in production, creates no
  external charge, records new referral payments with provider `mock`, and
  completes refunds for those mock payments without contacting Stripe or
  PayPal.
- `PAYMENT_PROVIDER=stripe`: production provider for the referral service.
- `STRIPE_SECRET_KEY`: creates Checkout Sessions, verifies returned sessions,
  and submits full refunds.
- `STRIPE_WEBHOOK_SECRET`: verifies
  `/api/payments/stripe/webhook` signatures.
- `STRIPE_API_BASE_URL`: optional Stripe-compatible API base override.
- Without provider credentials, non-production Stripe calls may still use the
  legacy local checkout/refund fallback. Production mock referral flows must
  use `REFERRAL_PAYMENT_MODE=mock` explicitly.

## Account & Access Architecture (Progressive Profiling)

### Identity Ladder

1. `Guest` (shadow account)

- Created/resolved by `x-device-id`
- `users.isGuest = 1`
- Can start product usage immediately without explicit login

2. `Free` (formal account)

- Passwordless login via email OTP
- `users.isGuest = 0`, `role = free`
- Activated when user verifies email

3. `Pro`

- Paid tier with unlimited AI triage sessions
- `role = pro`

### Authentication Rules

- No password field in DB or UI
- Formal auth paths:
  - OTP verification login
  - Magic-link verification login
- Guest access is allowed through shadow identity bootstrap in request context

### Data Merge Principle (Critical Asset Rule)

When guest user upgrades to formal user (OTP or magic-link verification), all guest-owned assets must be re-bound to the formal `userId`:

- Appointments
- Visit-related records
- AI triage records (session/message ownership through session user)

This merge guarantees no user asset loss during account upgrade.

## Billing Model (Hybrid Packaging)

### Core Design

Quota is charged by **Session**, with a **Message-count fallback guard** inside each session.

### Session Quota Rules

- Guest: lifetime max `1` free AI triage session
- Free: max `1` free AI triage session per day
- Pro: unlimited sessions

### Message Guardrail Rules

- Every session has a hard cap: `<= 20` messages total
- Once the session reaches the cap:
  - Do not call LLM anymore
  - Persist a predefined assistant closing message
  - Mark session as `completed`
  - Frontend disables input and highlights doctor-booking entry

### Why This Model

- Session-level quota controls monetization and daily entitlement
- Message-level cap controls per-session compute risk
- Combined model balances user experience, cost containment, and conversion to paid consultation

## Current Core Data Model (Relevant Tables)

- `users`: identity, guest/formal status, role, device/email mapping
- `ai_chat_sessions`: one complete triage consultation unit
- `ai_chat_messages`: per-message records inside a session
- `appointments`: booking and access token lifecycle
- `appointment_messages`: visit-room conversation records

## Appointment Link Token Security

- Room entry links are token-only: `{APP_BASE_URL}/visit/<appointmentId>?t=...`
- `APP_BASE_URL` is required for link issuance; no Host header fallback is used for token links
- Tokens are high-entropy random values; database stores only SHA-256 hash (`appointmentTokens.tokenHash`)
- Token rows enforce expiry, revoke status, and usage quota (`useCount` / `maxUses`)
- Validation returns normalized access context for downstream visit/chat APIs
- Browser realtime traffic exchanges the appointment token for a visit-specific,
  short-lived token and refreshes it before expiry
- Abuse guards include IP failure rate limit and auto-revoke for repeated failed attempts on the same token hash
- See implementation details: [`docs/implementation/appointment-link-auth.md`](./docs/implementation/appointment-link-auth.md)

## Payment and Appointment State Machine

- Canonical state-machine doc: [`docs/implementation/appointment_state_machine.md`](./docs/implementation/appointment_state_machine.md)
- Appointment statuses are finite and centralized in `server/modules/appointments/stateMachine.ts`.
- Visit-room access is centrally gated by `ensureAppointmentStatusAllowsVisitV2`:
  - Allowed: `paid`, `active` (and `paymentStatus=paid`)
  - Denied with `APPOINTMENT_NOT_ALLOWED`: `pending_payment`, `ended`, `expired`, `refunded`, `canceled`
- Stripe settlement is idempotent:
  - Event-level idempotency: `stripe_webhook_events.eventId` uniqueness
  - State-level idempotency: only `pending_payment -> paid` can settle
  - Replay never re-issues token or resends payment-success link

## Operational Notes

- Any schema change must be followed by migration apply + verification:
  - `pnpm db:migrate:safe` (recommended)
  - or `pnpm db:migrate` then `pnpm db:verify:migrations`
- Brand-new local PostgreSQL databases should bootstrap with `pnpm db:migrate`, not `pnpm db:push`
- If a local PostgreSQL database was created earlier via `db:push`, run `pnpm db:repair:migration-history` once before normal migrations
- If schema was manually patched and Drizzle history is behind, repair history once:
  - `pnpm db:repair:migration-history`
- Auth and billing constraints are business-critical and must be covered by tests before release
- Do not reintroduce password-based authentication paths
- Production hosts must run Node.js 24; the deploy workflow fails before
  switching releases when the remote runtime does not match
- The daily retention worker ships disabled and remains dry-run unless both
  production rollout switches are explicitly approved; see
  [`docs/ops/retention_cleanup.md`](./docs/ops/retention_cleanup.md)

## Release Safety Checklist

- `pnpm format:check` passes
- `pnpm lint` passes
- `pnpm check:secrets` passes
- `pnpm check:architecture` passes
- `pnpm check` passes
- `pnpm check:i18n:inline` passes
- `pnpm test:router-boundary` passes
- `pnpm test:coverage` passes
- `pnpm build` passes
- `pnpm audit --prod --audit-level high` reports no high/critical vulnerability
- Guest -> Free merge flow manually verified
- Session quota + message cap behavior manually verified
- Magic-link login flow manually verified
