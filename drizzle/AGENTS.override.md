## DB-specific rules

- Treat all edits here as schema-sensitive.
- Prefer additive changes over destructive changes.
- Do not hand-edit `drizzle/meta/**`.
- Do not touch `drizzle/archive/mysql/**` unless the task explicitly targets legacy migration history.
- If schema changes are required, include:
  - migration intent
  - affected tables
  - backward-compatibility note
  - backfill / repair plan if needed
- Do not run migration, push, or repair commands without explicit approval.
