# Medibridge Architecture Contract

This is the canonical placement and dependency contract for Medibridge. The
automated fitness function is `pnpm check:architecture`; prose elsewhere must
link here instead of defining competing dependency rules.

## Target dependency flow

```text
Pages -> feature root public API -> feature internals

HTTP/tRPC routers -> application workflows -> module publicApi -> domain actions
                  \-> owned module routerApi -> domain actions

Domain actions -> owned repositories -> PostgreSQL
Application workflows -> participating module publicApi files only
server/_core adapters -> external providers (LLM, AWS, OAuth, mail)
```

Feature and server-module dependency graphs must remain acyclic.

## Top-level ownership

| Path                             | Responsibility                                                           |
| -------------------------------- | ------------------------------------------------------------------------ |
| `client/src/features/*`          | Feature UI, hooks, adapters, copy, types, and root `index.ts` public API |
| `client/src/pages/*`             | Route parameters, route guards, and feature composition only             |
| `client/src/components/ui/*`     | Generic design-system primitives with no business dependencies           |
| `client/src/components/layout/*` | App shell and domain-neutral layout wrappers                             |
| `client/src/lib/*`               | Cross-feature frontend utilities and client integrations                 |
| `client/src/contexts/*`          | Global React context providers                                           |
| `server/routers/*`               | Thin HTTP/tRPC declaration and permission boundary                       |
| `server/workflows/*`             | Cross-domain application orchestration                                   |
| `server/modules/*`               | Domain actions, schemas, owned repositories, and explicit public APIs    |
| `server/_core/*`                 | Runtime infrastructure, adapters, auth/session/context, and composition  |
| `shared/*`                       | Cross-runtime types, constants, and runtime-safe validators              |
| `drizzle/*`                      | PostgreSQL schema and migrations                                         |
| `scripts/*`                      | Operational or data-maintenance tooling                                  |

## Public boundaries

Server modules expose two deliberately different boundaries:

- `server/modules/<module>/routerApi.ts` is for the corresponding HTTP/tRPC
  router only. It may expose validated schemas and router-facing actions.
- `server/modules/<module>/publicApi.ts` is the minimal contract available to
  other modules and application workflows. Repositories, schemas, internal
  actions, provider implementations, and `routerApi.ts` remain private.

Frontend features expose cross-boundary values only through
`@/features/<feature>`, implemented by the feature root `index.ts`. Internal
components, hooks, copy, presentation helpers, and adapters are not public API.

## Enforced import rules

### Frontend

1. A feature may import its own internals, shared UI, client utilities, and
   shared runtime-safe code.
2. Any consumer outside a feature, including pages and other features, must
   import that feature through `@/features/<feature>` exactly.
3. Features must not import pages.
4. `client/src/components/ui/*` may depend only on other UI primitives,
   `client/src/lib/*`, and external packages.
5. The feature dependency graph must be acyclic.

### Backend

1. A leaf file in `server/routers/*` may import only `server/_core/trpc`, its
   owned module `routerApi.ts`, application workflows, and external packages.
   `consultation` owns the `ai` router API; the future `system` router owns the
   `admin` router API.
2. `server/routers/index.ts` is router composition only and may import other
   routers plus `server/_core/trpc`.
3. Code inside a module may use its own internals. Cross-module imports must
   target the other module's `publicApi.ts`; modules must never import routers.
4. Cross-domain orchestration belongs in `server/workflows/*`. Workflows may
   use participating module `publicApi.ts` files, core infrastructure, shared
   code, and external packages, but not module internals or routers.
5. `server/_core/index.ts` is the composition root. Other `_core` files must
   not import business modules or routers.
6. The production server-module dependency graph must be acyclic.

## Incremental enforcement and file budgets

`scripts/architecture-allowlist.json` records only violations that predate the
gate. Every entry is an exact path-bound violation with a remediation phase;
wildcards are invalid. Pull requests may remove entries and lower oversized-file
ceilings, but may not add entries, raise ceilings, or defer their phase.

New source files are limited to 400 lines. Existing files above 400 lines have
exact ceilings and may not grow. Once an allowlisted file is removed or reaches
400 lines, its stale exception must be deleted.

## Placement rules

1. Pages contain no reusable components or reusable domain logic.
2. Feature-specific UI lives under its feature's `components` directory.
3. Routers declare procedures, validation, and permissions; domain behavior
   belongs in modules and cross-domain behavior belongs in workflows.
4. Domain actions receive project-owned DTOs rather than Express request types.
5. Shared client/server values live in `shared/*`; server-only infrastructure
   remains in `_core`.
6. New infrastructure uses `server/_core/*`, never the legacy `server/core/*`.

## Mandatory PR checks

- `pnpm check:architecture`
- `pnpm test:router-boundary`
- Relevant unit tests for every changed public boundary
- No new allowlist entry, wildcard, dependency cycle, or oversized file
- No router business logic, cross-module deep import, or feature deep import
