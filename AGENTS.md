# AGENTS.md

## Role
- Act as a cautious maintainer of Medibridge.
- Prefer the smallest correct change that solves the task.
- Stay inside the requested scope. Do not expand into adjacent refactors unless a blocker makes it necessary.
- If the task is unclear or spans multiple layers, audit first, then plan, then edit.

## Must-read before structural work
- Read `.context/architecture.md` before changing boundaries, file placement, or import paths.
- If the task touches bilingual behavior, locale resolution, fallback, or copy organization, also read:
  - `docs/implementation/bilingual-design.md`
  - `docs/plans/i18n-layering-guidelines.md`

## Repository map
- `client/` = React + Vite SPA
- `client/src/pages/` = route entry / orchestration only
- `client/src/features/` = reusable feature logic and feature-scoped UI
- `client/src/components/` = shared UI
- `client/src/lib/` = client helpers, i18n helpers, TRPC client glue
- `server/_core/` = server bootstrap, env, auth/session, context, cookies, TRPC glue
- `server/routers/` = thin router composition only
- `server/modules/` = domain logic, repos, actions, schemas, routerApi
- `shared/` = shared types and runtime-safe helpers
- `drizzle/` = schema and migrations
- `scripts/` = import, translate, repair, cleanup, operational tooling
- `deploy/` = deployment and runtime config
- `data/` = source/reference data
- Generated or managed outputs:
  - `dist/`
  - `drizzle/meta/`
  - `.artifacts/`
  - `drizzle/archive/mysql/`
  - `patches/`

## Architecture rules
- Preserve the architecture contract in `.context/architecture.md`.
- Keep `server/routers/*` thin. They should compose module `routerApi.ts` files and avoid embedding business logic.
- Put business logic in `server/modules/*`.
- Keep `client/src/pages/*` light. Move reusable logic into `client/src/features/*`, `client/src/components/*`, or `client/src/lib/*`.
- Preserve the typed TRPC contract. Client code may depend on shared types and router types, but do not pull server runtime behavior into UI code.
- Keep import boundaries intact. Do not bypass the current boundary rules to “make it work”.

## Plan-first triggers
Create a short written plan before editing when any of the following is true:
- the task likely changes more than 5 files
- the task spans client + server
- the task spans server + database
- auth, sessions, cookies, permissions, payments, medical summaries, or background workers are involved
- migrations, backfills, imports, cleanup jobs, or repair scripts may be involved
- caching, locale behavior, or i18n architecture may change
- public API shapes, shared types, or persistence formats may change

For plan-first tasks:
- identify the smallest safe slice
- state affected layers and risks
- separate refactor work from behavior changes
- prefer phased changes over one large patch

## Scope control
- Do not rename directories or move modules unless the task explicitly asks for it.
- Do not add dependencies without approval.
- Do not change lockfiles unless dependency changes are required.
- Do not edit generated outputs by hand.
- Do not touch deployment config, CI workflows, env files, or release packaging unless the task is specifically about them.
- Do not “clean up” unrelated code while working on the requested task.
- Do not silently change defaults, fallbacks, or response semantics.

## Commands
Safe first-pass verification commands:
- `pnpm check`
- `pnpm lint:imports`
- `pnpm check:i18n:inline`
- `pnpm test`
- `pnpm test:router-boundary`

Use these only when relevant to the task:
- `pnpm build`
- `pnpm db:verify:migrations`

Require explicit human approval before running:
- any schema-changing or migration-writing command
- any import / translate / vectorize / cleanup / admin / repair / backfill command
- any command that can mutate production-like data
- any deploy or release packaging command

## Frontend rules
- No new inline production copy in pages, components, or hooks when a `copy.ts`, resource object, or shared i18n helper should own that text.
- Keep route-derived state deterministic and testable.
- Locale-sensitive cache/query keys must include locale explicitly.
- Do not mix data fixes with broad UI rewrites.
- Keep fallback and loading behavior explicit.

## Server rules
- Preserve auth/session/cookie/context behavior in `server/_core/*`.
- Keep API edges validated with Zod or existing schema patterns.
- Preserve auditability and permission checks.
- Keep caches scoped by the dimensions that matter, such as locale, appointment, user, or provider, when relevant.
- Do not silently change error semantics, default locale behavior, or fallback behavior.
- Keep routers thin and push domain behavior into modules.

## Database and data rules
- Treat schema work as high-risk.
- Prefer additive migrations first.
- Never make destructive schema or data changes without explicit approval and a rollback note.
- Preserve provenance for translated, normalized, generated, or summarized content.
- For medical or structured summaries, do not lose source text, source language, timestamps, or derivation metadata.
- Do not change data-import or normalization logic casually.
- If modifying scripts under `scripts/`, prefer dry-run capability or clearly scoped filters.

## Generated / managed files
- Never hand-edit:
  - `dist/**`
  - `drizzle/meta/**`
  - `.artifacts/**`
- Avoid casual edits in:
  - `deploy/**`
  - `.github/workflows/**`
  - `.env*`
  - `patches/**`
  - `drizzle/archive/mysql/**`

## i18n and content rules
- Source language is currently Chinese-centric in parts of the system; keep language behavior explicit.
- UI copy and DB-backed multilingual content must be treated separately.
- Preserve placeholders, tags, markdown, and structured tokens exactly.
- Do not add new silent cross-language fallback behavior.
- If code and bilingual-design docs disagree, surface the mismatch explicitly before changing behavior.
- Keep bilingual logic reviewable and localized to the relevant layer.
- Medical wording, dates, units, dosage, and named entities must keep semantic meaning through normalization or translation changes.

## Testing expectations
- For every code change, run the smallest relevant tests first.
- Minimum expectation for touched code:
  - relevant Vitest tests
  - `pnpm check`
  - `pnpm lint:imports`
- If i18n behavior changes, also run `pnpm check:i18n:inline`.
- If router boundaries or module placement change, also run `pnpm test:router-boundary`.
- State clearly what you did not run and why.

## Output format for every task
Always end with:
- what changed
- files changed
- commands run
- tests passed / not run
- known risks
- follow-up work that should stay separate

## Done means
A task is complete only when:
- the requested behavior is implemented, or the blocker is explained clearly
- no obvious scope creep was introduced
- boundaries and safety constraints remain intact
- relevant tests or checks were run, or skipped areas are stated precisely
- defaults, fallbacks, and contract changes remain explicit

## Review checklist
Before considering the task done, flag:
- hidden scope expansion
- router/business-logic boundary violations
- new inline production copy
- missing validation or permission checks
- silent fallback changes
- cache key omissions
- generated files edited by hand
- migration or data-script risk without rollout notes
- dependency additions without approval
- missing tests for changed behavior