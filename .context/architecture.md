# Medibridge Architecture Contract

This file is the placement and dependency contract used by `architecture-guard`.

## Top-level modules

| Module | Responsibility |
|---|---|
| `client/src/features/*` | Feature domain UI, feature hooks, feature API adapters, feature copy/types |
| `client/src/pages/*` | Route entry only; compose feature components and route-level guards |
| `client/src/components/ui/*` | Generic design-system primitives (no business domain logic) |
| `client/src/components/layout/*` | App-shell and reusable layout wrappers |
| `client/src/lib/*` | Cross-feature frontend utilities and client integrations |
| `client/src/contexts/*` | Global React context providers |
| `server/modules/*` | Domain business logic and persistence coordination |
| `server/routers/*` | tRPC router/input-output boundary layer |
| `server/_core/*` | Runtime infrastructure (context, trpc bootstrap, env, adapters) |
| `server/core/*` | Transitional shared helpers for server; prefer migration into `_core` |
| `shared/*` | Cross-runtime types/constants/validators |
| `drizzle/*` | Database schema and migrations |
| `scripts/*` | Operational or data maintenance scripts |

## Placement rules

1. `pages` must not host reusable components.
2. Feature-specific UI goes under `client/src/features/<feature>/components`.
3. Feature hooks stay inside the same feature unless genuinely cross-feature.
4. Routers orchestrate and validate; heavy business rules belong in `server/modules/*`.
5. Shared constants/types used by both client/server live in `shared/*`.
6. New server infra files should go to `server/_core/*`, not `server/core/*`.

## Import rules

### Frontend

- `client/src/pages/*` may import from:
  - `client/src/features/*`
  - `client/src/components/*`
  - `client/src/lib/*`
  - `client/src/contexts/*`
  - `shared/*` (via `@shared/*`)
- `client/src/features/*` may import from:
  - same feature subtree
  - `client/src/components/ui/*`
  - `client/src/lib/*`
  - `shared/*`
- `client/src/components/ui/*` may import only:
  - `client/src/lib/*`
  - other `components/ui/*`
  - external packages

### Backend

- `server/routers/*` may import from:
  - `server/modules/*`
  - `server/_core/*`
  - `server/core/*` (temporary compatibility)
  - `shared/*`
- `server/modules/*` may import from:
  - same module subtree
  - `server/_core/*`
  - `shared/*`
  - `drizzle/*`
- `server/_core/*` may import from:
  - `shared/*`
  - `drizzle/*`
  - external packages

## Current transitional exceptions

1. `server/core/getPublicBaseUrl.ts` is still referenced by routers and `_core/systemRouter.ts`.
2. Some route files are still large and contain mixed orchestration/business behavior.

These exceptions are allowed short-term but should be reduced in planned refactors.
