# ADR 0001: Separate Router and Module Public Boundaries

- Status: Accepted
- Date: 2026-08-12

## Context

Routers, application workflows, and peer modules need different subsets of a
domain's capabilities. Exporting repositories or internal actions directly
makes ownership unclear and creates dependency cycles.

## Decision

Each server module may expose two deliberately different entry points:

- `routerApi.ts` is consumed only by the owned HTTP/tRPC router. It provides
  schemas and router-facing actions needed to preserve the public procedure
  contract.
- `publicApi.ts` is the minimal capability surface available to application
  workflows and other modules.

Repositories, provider implementations, internal schemas, and non-exported
actions remain owned by the module. The canonical dependency rules and fitness
function live in [`.context/architecture.md`](../../.context/architecture.md).

## Consequences

- Existing tRPC paths, including `trpc.system.*`, remain stable while internals
  can evolve.
- Cross-module dependencies are visible and reviewable.
- A new public export requires focused contract tests and architecture checks.
