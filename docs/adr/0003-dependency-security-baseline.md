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
- Exact overrides are permitted only when documented and tested. Express 4's
  `path-to-regexp` override remains until the separately reviewed Express 5
  migration.
- Development-only findings are tracked separately and do not justify moving
  runtime packages into development dependencies.
- Major runtime upgrades are isolated by compatibility area and receive focused
  tests plus the full PR gate.

## Consequences

- The production acceptance target is zero critical/high findings.
- Low/moderate development-tool findings remain visible and require separate
  replacement work when an upgrade is not safely compatible.
- Express 5 and ExcelJS replacement remain independent tasks rather than being
  bundled into architecture refactors.
