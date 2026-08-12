# Router Boundary Pattern

## Goal

- Keep `server/routers/*` as thin boundary layers.
- Move business logic to `server/modules/*`.
- Keep router dependencies stable via module-level `routerApi.ts`.
- Keep cross-module and workflow dependencies stable via module-level
  `publicApi.ts`.

## Standard Shape

### 1) Public boundaries have distinct consumers

- `routerApi.ts`: router-facing actions, schemas, and narrowly scoped core
  helpers. Only the owned HTTP/tRPC router imports this file.
- `publicApi.ts`: the minimal stable contract for application workflows and
  other modules. It must not expose repositories or provider internals.

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
- `workflows/*` -> participating `modules/*/publicApi.ts`
- `modules/<source>/*` -> `modules/<target>/publicApi.ts`
- No router-to-router imports.
- No cross-module deep imports.

## Current Router Boundaries

All leaf routers under `server/routers/` use their owned module `routerApi.ts`.
The two composition aliases are explicit: `consultation` uses the AI router
API, and `system` uses the admin procedure map while preserving all existing
`trpc.system.*` paths.

## Extension Checklist

- Add schema in `modules/<domain>/schemas.ts`
- Add domain behavior in `modules/<domain>/actions.ts` (or a focused action
  file)
- Export through `modules/<domain>/routerApi.ts`
- Wire router to grouped imports only
- For a cross-domain caller, expose only the required capability through
  `modules/<domain>/publicApi.ts`; put orchestration in `server/workflows/*`
- Run:
  - `pnpm check`
  - `pnpm check:architecture`
  - `pnpm test:router-boundary`
  - related Vitest suites

## Automated Guard

- Boundary test: `server/router-boundary-pattern.test.ts`
  - validates router API export shapes and the preserved public procedure map
  - ensures routers do not bypass module `routerApi` files
  - ensures all non-index routers avoid router-to-router imports
- Architecture fitness function: `pnpm check:architecture`
- Canonical dependency contract: [`.context/architecture.md`](../../.context/architecture.md)
