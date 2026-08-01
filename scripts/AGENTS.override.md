## Scripts rules

- Assume scripts here may mutate real or production-like data.
- Default to audit-only thinking first.
- Do not run import, translate, repair, cleanup, admin, vectorize, or backfill scripts without explicit approval.
- When editing a script, prefer:
  - dry-run support
  - scoped filters
  - explicit logging
  - idempotent behavior where practical
- Do not hide risky actions behind convenience defaults.
