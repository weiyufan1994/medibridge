# MediBridge SaaS Platform

MediBridge is a Node.js + React SaaS platform for AI triage, doctor discovery, appointment booking, and visit messaging.

This README is the single handover document for onboarding, architecture understanding, and core business constraints.

## Tech Stack
- Frontend: React 19, Vite, TypeScript, TanStack Query, tRPC client
- Backend: Express, tRPC server, TypeScript
- Database: MySQL + Drizzle ORM
- Auth: Progressive Profiling (Guest shadow account + passwordless OTP + Magic Link)

## Quick Start
1. Install dependencies
```bash
pnpm install
```
2. Run DB migrations
```bash
pnpm db:push
```
3. Start dev server
```bash
pnpm dev
```
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
- `modules/chat`: chat-oriented business composition
- `modules/doctors`: doctor search and recommendation repositories
- `modules/hospitals`: hospital and department query repositories

### API Layer (`server/routers/*`)
- `routers/auth.ts`: OTP request, OTP verify + merge, magic-link verify, logout
- `routers/ai.ts`: triage session creation, message sending, triage orchestration endpoints
- `routers/doctors.ts`, `routers/hospitals.ts`, `routers/chat.ts`: discovery and conversational routes
- `appointmentsRouter.ts` (mounted in `routers/index.ts`): booking and link-based appointment ops
- `visitRouter.ts` (mounted in `routers/index.ts`): visit room message operations

### Infrastructure
- `server/_core/*`: tRPC bootstrap, context, env, SDK, cookie/session, mailer, LLM adapter
- `drizzle/schema.ts`: source of truth for schema
- `drizzle/*.sql` + `drizzle/meta/*`: migration and snapshots
- `shared/*`: cross-runtime constants and shared types

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

## Operational Notes
- Any schema change must be followed by migration generation/apply (`pnpm db:push`)
- Auth and billing constraints are business-critical and must be covered by tests before release
- Do not reintroduce password-based authentication paths

## Release Safety Checklist
- `pnpm check` passes
- `pnpm test` passes
- Guest -> Free merge flow manually verified
- Session quota + message cap behavior manually verified
- Magic-link login flow manually verified
