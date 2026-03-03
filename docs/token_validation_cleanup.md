# Token Validation Cleanup

## Summary
- Goal: remove runtime token validation paths that read legacy `appointments.accessTokenHash` / `appointments.doctorTokenHash`.
- Result: all token validation in business routers now goes through token-table-backed logic (`validateAppointmentToken` and `appointmentTokens` queries).

## Replaced key references

1. `server/appointmentsRouter.ts` (`validateAppointmentToken`)
- Replaced legacy-field validation:
  - removed direct checks against `appointment.accessTokenHash` / `appointment.doctorTokenHash`
- Now validates by:
  - `appointmentsRepo.listActiveAppointmentTokens({ appointmentId, now })`
  - `verifyToken(token, tokenHash)` over active token rows

2. `server/routers/auth.ts` (`verifyMagicLink`)
- Replaced legacy-field lookup + verify:
  - removed `getAppointmentByAccessTokenHash(hashToken(parsedToken))`
  - removed `verifyToken(parsedToken, appointment.accessTokenHash)`
- Now validates by:
  - `appointmentsRepo.getActiveAppointmentTokenByHash({ tokenHash, role: "patient" })` to resolve appointment
  - `validateAppointmentToken(appointmentId, parsedToken, "join_room")` as unified gate

3. `server/modules/appointments/repo.ts`
- Removed legacy read helper:
  - deleted `getAppointmentByAccessTokenHash`
- Added token-table query helper:
  - `getActiveAppointmentTokenByHash`

## Uniform validation entrypoint
- `visitRouter` already uses `validateAppointmentToken`.
- `appointmentsRouter` token-protected actions use `validateAppointmentToken`.
- `auth.verifyMagicLink` now also uses `validateAppointmentToken`.

## Verification grep (runtime validation paths)

### A) No direct legacy verify pattern remains
- Command:
  - `rg -n "verifyToken\([^\)]*appointment\.(accessTokenHash|doctorTokenHash)\)" server --glob '!**/*.test.ts'`
- Result: no matches.

### B) No legacy hash lookup helper usage remains
- Command:
  - `rg -n "getAppointmentByAccessTokenHash\(" server --glob '!**/*.test.ts'`
- Result: no matches.

## Notes on remaining legacy-field references
- Runtime server code (`server/**`, excluding tests) has no direct `accessTokenHash` / `doctorTokenHash` references.
- Remaining references are in schema/migration artifacts only:
  - `drizzle/schema.ts`
  - `drizzle/*.sql`
  - `drizzle/meta/*.json`
