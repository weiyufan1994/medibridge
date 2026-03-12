# Router Boundary Pattern

## Goal
- Keep `server/routers/*` as thin boundary layers.
- Move business logic to `server/modules/*`.
- Keep router dependencies stable via module-level `routerApi.ts`.

## Standard Shape

### 1) `routerApi.ts` exports 3 groups
- `*Actions`: mutation/query workflows and business actions.
- `*Schemas`: all zod input/output schemas consumed by routers.
- `*Core`: minimal cross-module contracts (stable entry points).

Example:
- `appointmentActions`
- `appointmentSchemas`
- `appointmentCore`

### 2) Router file only does
- procedure declaration (`publicProcedure/protectedProcedure`)
- `.input(...)` / `.output(...)` binding from `*Schemas`
- delegation to `*Actions` / `*Core`

### 3) Module layering
- `routers/*` -> `modules/*/routerApi.ts`
- `modules/*/routerApi.ts` -> internal `actions/schemas/core`
- No router-to-router imports.

## Current Applied Modules
- `server/routers/appointments.ts`
  - uses `appointmentActions + appointmentSchemas + appointmentCore`
- `server/routers/payments.ts`
  - uses `paymentActions + paymentSchemas + paymentCore`
- `server/routers/visit.ts`
  - uses `visitActions + visitSchemas`
- `server/routers/auth.ts`
  - uses `authActions + authSchemas`
- `server/routers/chat.ts`
  - uses `chatActions + chatSchemas`
- `server/routers/ai.ts`
  - uses `aiActions + aiSchemas`

## Extension Checklist
- Add schema in `modules/<domain>/schemas.ts`
- Add workflow in `modules/<domain>/actions.ts` (or split sub-actions files)
- Export through `modules/<domain>/routerApi.ts`
- Wire router to grouped imports only
- Run:
  - `./node_modules/.bin/tsc --noEmit`
  - related `vitest` suites

## Automated Guard
- Boundary test: `server/router-boundary-pattern.test.ts`
  - validates `routerApi` grouped exports for appointments/payments/visit/auth/chat/ai
  - ensures appointments/payments/visit/auth/chat/ai routers do not bypass module `routerApi` via direct module imports
  - ensures all non-index routers avoid router-to-router imports
- Quick command:
  - `pnpm test:router-boundary`
