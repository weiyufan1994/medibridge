# ADR 0004: Keep Map Capability Removed and Secrets Server-Only

- Status: Accepted
- Date: 2026-08-12

## Context

The product does not require an interactive map. The remaining unused server
adapter built third-party map requests by placing a provider key in the request
URL, creating an unnecessary secret-exposure surface.

## Decision

Map UI, client loaders, script endpoints, and the unused server map adapter are
removed. No client environment variable may contain a key, secret, or token.
The secret gate rejects the retired adapter path and former map proxy markers
in source files.

All provider credentials remain server-only and must not enter browser bundles,
URLs, logs, error responses, or Git. If a map becomes a product requirement,
it requires a new ADR and dedicated security review before implementation.

## Consequences

- There is no map-related browser request or map-specific production
  configuration to maintain.
- Reintroducing maps is a product and security decision, not an incidental UI
  change.
- A future design must define key isolation, upstream allowlisting, timeouts,
  redirect handling, response validation, and failure semantics.
