# Project Folders Structure Blueprint

## 1. Structural Overview

- Project type: Node.js + React + TypeScript full-stack app.
- Organization strategy:
  - Frontend mixes route-first (`pages`) and feature-first (`features`) organization.
  - Backend mostly domain-first (`server/modules/*`) with router boundary (`server/routers/*`).
- Strengths:
  - Clear feature buckets in frontend (`auth`, `triage`, `visit`, `hospitals`, `appointment`).
  - Clear backend domain modules and dedicated `_core` runtime infra.
- Main drift:
  - Route-layer files contain reusable UI and heavy logic.
  - Duplicate/overlapping naming at layout/core levels (`components/layout` vs `layout`, `_core` vs `core`).

## 2. Current Directory Snapshot (Depth 3)

```text
client/src/
  components/
    layout/
    ui/
  contexts/
  features/
    admin/
    appointment/
    auth/
    dashboard/
    home/
    hospitals/
    triage/
    visit/
  hooks/
  layout/
  lib/
  pages/

server/
  _core/
  core/
  modules/
    admin/
    ai/
    appointments/
    auth/
    doctors/
    payments/
    visit/
  routers/

shared/
  _core/
```

## 3. File Placement Patterns

- `client/src/pages/*`: route entries, but some pages still include orchestration-heavy UI and API mutations.
- `client/src/features/*`: good pattern of `components/hooks/api/copy`, but not all domains are consistently complete.
- `server/routers/*`: several very large routers indicate mixed responsibilities.
- `server/modules/*`: repositories and services exist, but further extraction from routers is still needed.

## 4. Naming and Organization Conventions

Observed conventions:
- React components: `PascalCase.tsx`
- Hooks: `use*.ts`
- Domain folders: lowercase plural nouns

Inconsistencies:
- Two layout roots in frontend: `components/layout` and `layout`.
- Two server infra roots: `_core` and `core`.
- A few legacy page-level component placements (one migrated in this pass: `ChatComposer`).

## 5. Priority Refactor Plan

### P0 (High impact, low-medium risk)

1. Establish architecture contract and enforce placement
- Status: done in this pass via `.context/architecture.md`.
- Next: use it as review checklist for every new file.

2. Keep pages as route-entry only
- Move any page-local reusable UI into matching feature folders.
- Completed in this pass: `ChatComposer` moved to `features/visit/components`.

3. Split oversized route files
- Target first: `server/routers/appointments.ts` (~1473 LOC), `client/src/pages/Admin.tsx` (~1453 LOC).
- Strategy: extract business logic to `server/modules/appointments/*` and UI/data hooks to `client/src/features/admin/*`.

### P1 (Medium impact)

1. Unify frontend layout ownership
- Choose one canonical location for app layouts:
  - recommended: keep `client/src/components/layout/*` as canonical, migrate `client/src/layout/*` into it.

2. Decommission `server/core/*`
- Move `server/core/getPublicBaseUrl.ts` into `server/_core/`.
- Update imports and delete legacy `server/core` directory.

3. Normalize feature folder shape
- For each feature, prefer: `components/`, `hooks/`, optional `api/`, `copy.ts`, `types.ts`.

### P2 (Longer-term hardening)

1. Introduce lint boundaries
- Add import-boundary lint rules so `pages` cannot be imported by `features`.

2. Co-locate tests by domain depth
- Keep fast unit tests near modules/features, reserve top-level `server/*.test.ts` for integration-level tests.

## 6. Implementation Notes from This Pass

- Added architecture contract: `.context/architecture.md`.
- Executed one concrete structure fix:
  - moved `client/src/pages/ChatComposer.tsx`
  - to `client/src/features/visit/components/ChatComposer.tsx`
  - updated importer in `client/src/pages/VisitRoom.tsx`.

## 7. Suggested Next Refactor Batch

1. Backend: split `server/routers/appointments.ts` into smaller action-focused handlers in `server/modules/appointments/`.
2. Frontend: split `client/src/pages/Admin.tsx` into `features/admin/components` + `features/admin/hooks`.
3. Cleanup: merge frontend layout roots and remove `server/core` compatibility layer.
