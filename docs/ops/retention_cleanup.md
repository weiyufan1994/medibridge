# Retention Cleanup Operations

## Safety model

The API process owns a daily retention worker. It is fail-safe by default:

- `RETENTION_CLEANUP_SCHEDULE_ENABLED` defaults to `false`; no timer runs.
- When scheduling is enabled, cleanup defaults to dry-run.
- `RETENTION_CLEANUP_EXECUTE=true` is also required before rows can be deleted.
- The worker prevents overlapping ticks in the current process.
- Each run writes the existing retention audit and emits only aggregate counts.
  Candidate IDs and failure details are not written to application logs.

The current production PM2 configuration uses one forked process. Do not enable
this worker in a cluster or on multiple hosts until it uses a shared lock or a
single external scheduler.

## Safe rollout

Changing production variables or running cleanup requires separate operational
approval. Use this sequence after that approval:

1. Set `RETENTION_CLEANUP_SCHEDULE_ENABLED=true` and leave
   `RETENTION_CLEANUP_EXECUTE=false`.
2. Reload the API process and observe at least one daily dry-run.
3. Review the retention audit in the admin console and confirm the free, paid,
   and guest candidate counts match the configured policies.
4. Confirm application logs contain `retention-cleanup-worker` /
   `tick_completed` and no repeated `tick_failed` events.
5. Obtain explicit approval for destructive retention execution.
6. Set `RETENTION_CLEANUP_EXECUTE=true` and reload the API process.
7. Verify the next audit's deleted counts and continue monitoring daily.

Rollback is immediate: set `RETENTION_CLEANUP_SCHEDULE_ENABLED=false` and reload
the API process. Disabling the worker cannot restore rows already deleted by an
approved execution.

## Failure handling

An executor failure is recorded as `tick_failed`; the worker stays alive and
retries at the next daily tick. The retention repository also attempts to write
a failure audit. Investigate database availability and the retention audit
before retrying manually. Never run `pnpm retention:cleanup` against production
without explicit data-operation approval; use
`pnpm retention:cleanup:dry-run` first under the same approval process.
