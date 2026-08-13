# ADR 0003: Enforce the Production Dependency Security Baseline

- Status: Accepted
- Date: 2026-08-12

## Context

Dependency upgrades can change application behavior, while leaving known
high-severity production vulnerabilities creates unacceptable operational risk.
Development-only tooling and production runtime packages have different
exposure.

## Decision

- CI runs `pnpm audit --prod --audit-level high`; critical and high production
  findings block merging.
- Node is pinned to major version 24 and pnpm to the `packageManager` version in
  `package.json` so local and CI dependency resolution are reproducible.
- Exact overrides are permitted only when documented and tested.
- Development-only findings are tracked separately and do not justify moving
  runtime packages into development dependencies.
- Major runtime upgrades are isolated by compatibility area and receive focused
  tests plus the full PR gate.

## Consequences

- The production acceptance target is zero critical/high findings.
- Low/moderate development-tool findings remain visible and require separate
  replacement work when an upgrade is not safely compatible.
- Major dependency replacements remain independent changes rather than being
  bundled into architecture refactors.

## Implementation update (2026-08-14)

- The Express 5 migration is complete at Express 5.2.1, including webhook raw
  body, tRPC middleware, error handling and development middleware regression
  coverage. The Express 4 `path-to-regexp` override has been removed; the lock
  file resolves `path-to-regexp` 8.4.2.
- ExcelJS has been removed. Trusted Excel import tooling uses the development
  dependency `read-excel-file`, with input parsing kept outside the production
  runtime dependency set.
- CI continues to enforce zero high/critical production dependency findings.
