# Current Progress Summary (2026-03-03)

This document summarizes the current workspace progress based on ongoing code changes and recent fixes.

## 1) Visit Room / Bilingual UX
- `client/src/pages/VisitRoom.tsx`
  - Fixed `AI Triage Summary` localization behavior during `en/zh` switching.
  - Added language-aware request parameter (`lang`) when fetching appointment-by-token data.
  - Removed the `聊天记录保留 7 天` header line per product request.
  - Fixed a React hooks-order issue triggered by conditional render paths.
- `server/appointmentsRouter.ts`
  - `appointments.getByToken` now accepts `lang: "en" | "zh"`.
  - Added server-side triage summary translation before response.
  - Added lightweight in-memory translation cache to reduce repeated translation calls.

## 2) Global Header Localization
- `client/src/components/layout/AppLayout.tsx`
  - Replaced hardcoded Chinese nav labels with language-aware copy:
    - Dashboard (`个人中心` / `My Account`)
    - Logout (`退出登录` / `Sign out`)
    - Browse Hospitals
  - Brand subtitle and logout toasts now follow current language.

## 3) Phase-1 Appointment/Payment Refactor (In Progress)
- DB and migration work is active:
  - `drizzle/schema.ts`
  - `drizzle/0013_phase1_paid_appointments.sql`
  - `drizzle/meta/_journal.json`
  - `drizzle/meta/0014_snapshot.json`
- Backend routing and module updates are active:
  - `server/appointmentsRouter.ts`
  - `server/paymentsRouter.ts`
  - `server/stripeWebhookRoute.ts`
  - `server/modules/payments/*`
  - `server/modules/appointments/repo.ts`
  - `server/modules/ai/repo.ts`
  - `server/modules/visit/repo.ts`
  - `server/routers/index.ts`
- Frontend appointment/visit integration updates are active:
  - `client/src/features/appointment/hooks/useAppointmentForm.ts`
  - `client/src/pages/AppointmentAccess.tsx`
  - `client/src/features/visit/*`
  - `client/src/pages/Dashboard.tsx`

## 4) Test Coverage Updates (In Progress)
- Related test files have active changes:
  - `server/appointments.test.ts`
  - `server/visit.test.ts`

## 5) Documentation Status
- Added/maintained phase-1 design docs:
  - `docs/phase1-appointment-payment-refactor.md`
- Removed migration draft file after confirming formal drizzle migration exists:
  - deleted `docs/phase1-migration-draft.sql`

