# ADR 0002: Put Cross-Domain Orchestration in Application Workflows

- Status: Accepted
- Date: 2026-08-12

## Context

Appointment settlement, booking, medical summaries, automatic closure, and
guest-account upgrades coordinate multiple domains. Implementing that work in
a leaf module causes ownership leakage and circular dependencies.

## Decision

Cross-domain orchestration belongs in `server/workflows/*`. A workflow may
depend on core infrastructure, shared runtime-safe code, and each participating
module's `publicApi.ts`. It may not import module repositories, internal
actions, schemas, provider adapters, or routers.

Leaf modules retain domain invariants and persistence ownership. Routers remain
thin validation and permission boundaries and delegate to workflows or their
owned module `routerApi.ts`.

## Consequences

- Transaction and idempotency behavior is tested at one application boundary.
- Payment providers return normalized payment results; appointment workflows
  own appointment state, scheduling, and access-token consequences.
- Moving orchestration must preserve existing error, audit, retry, and public
  response semantics.
