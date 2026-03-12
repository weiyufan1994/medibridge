# Token Migration Audit (Static)

## Scope
- Repo: `medibridge`
- Method: static grep audit (no business logic changes)
- Goal: verify whether token validation is mixed between legacy `appointments.*TokenHash` columns and an `appointmentTokens` table.

## 1) Legacy field references (global, with path + line)

### 1.1 `appointments.accessTokenHash` / `accessTokenHash`
- `drizzle/schema.ts:301`
- `drizzle/0013_phase1_paid_appointments.sql:10`
- `drizzle/0008_appointment_magic_link.sql:22`
- `drizzle/0008_appointment_magic_link.sql:25`
- `server/appointmentsRouter.ts:210`
- `server/appointmentsRouter.ts:215`
- `server/appointmentsRouter.ts:374`
- `server/appointmentsRouter.ts:375`
- `server/appointmentsRouter.ts:376`
- `server/appointmentsRouter.ts:732`
- `server/appointmentsRouter.ts:760`
- `server/paymentsRouter.ts:194`
- `drizzle/meta/0009_snapshot.json:150`
- `drizzle/meta/0009_snapshot.json:151`
- `drizzle/meta/0010_snapshot.json:150`
- `drizzle/meta/0010_snapshot.json:151`
- `drizzle/meta/0011_snapshot.json:178`
- `drizzle/meta/0011_snapshot.json:179`
- `drizzle/meta/0012_snapshot.json:345`
- `drizzle/meta/0012_snapshot.json:346`
- `drizzle/meta/0014_snapshot.json:549`
- `drizzle/meta/0014_snapshot.json:550`
- `server/appointments.test.ts:218`
- `server/appointments.test.ts:259`
- `server/routers/auth.ts:184`
- `server/routers/auth.ts:185`
- `server/modules/appointments/repo.ts:79`
- `server/modules/appointments/repo.ts:88`
- `server/modules/appointments/repo.ts:122`
- `server/modules/appointments/repo.ts:161`
- `server/modules/appointments/repo.ts:170`
- `server/modules/appointments/repo.ts:210`
- `server/modules/appointments/repo.ts:222`
- `server/modules/appointments/repo.ts:234`

### 1.2 `appointments.doctorTokenHash` / `doctorTokenHash`
- `docs/phase1-appointment-payment-refactor.md:151`
- `drizzle/schema.ts:302`
- `drizzle/schema.ts:321`
- `drizzle/0010_famous_ink.sql:7`
- `drizzle/0010_famous_ink.sql:10`
- `drizzle/0010_famous_ink.sql:52`
- `drizzle/meta/0010_snapshot.json:157`
- `drizzle/meta/0010_snapshot.json:158`
- `drizzle/meta/0010_snapshot.json:256`
- `drizzle/meta/0011_snapshot.json:185`
- `drizzle/meta/0011_snapshot.json:186`
- `drizzle/meta/0011_snapshot.json:284`
- `drizzle/meta/0012_snapshot.json:352`
- `drizzle/meta/0012_snapshot.json:353`
- `drizzle/meta/0012_snapshot.json:451`
- `drizzle/meta/0014_snapshot.json:556`
- `drizzle/meta/0014_snapshot.json:557`
- `drizzle/meta/0014_snapshot.json:669`
- `server/paymentsRouter.ts:187`
- `server/paymentsRouter.ts:195`
- `server/appointmentsRouter.ts:378`
- `server/appointmentsRouter.ts:379`
- `server/appointmentsRouter.ts:380`
- `server/appointmentsRouter.ts:815`
- `server/appointmentsRouter.ts:821`
- `server/appointments.test.ts:219`
- `server/appointments.test.ts:260`
- `server/modules/appointments/repo.ts:123`
- `server/modules/appointments/repo.ts:162`
- `server/modules/appointments/repo.ts:171`
- `server/modules/appointments/repo.ts:211`
- `server/modules/appointments/repo.ts:223`
- `server/modules/appointments/repo.ts:235`

### 1.3 `doctorAccessTokenHash` (actual-field-name check)
- No matches found in repository.

### 1.4 `verifyToken(token, appointment.accessTokenHash)`-style patterns
- `server/appointmentsRouter.ts:376` (`verifyToken(token, appointment.accessTokenHash)`)
- `server/appointmentsRouter.ts:380` (`verifyToken(token, appointment.doctorTokenHash)`)
- `server/routers/auth.ts:185` (`verifyToken(parsedToken, appointment.accessTokenHash)`)
- `server/appointmentsRouter.ts:732` (`verifyToken(cached.token, appointment.accessTokenHash!)`)

## 2) `validateAppointmentToken` definition and return structure

- Definition: `server/appointmentsRouter.ts:366`
- Signature:
  - `validateAppointmentToken(appointmentId: number, token: string, action: VisitAccessAction = "join_room")`
- Validation behavior (key checks):
  - Token hash check against legacy fields:
    - `appointment.accessTokenHash` (`server/appointmentsRouter.ts:374-376`)
    - `appointment.doctorTokenHash` (`server/appointmentsRouter.ts:378-380`)
  - Expiry required and valid (`server/appointmentsRouter.ts:389-401`)
  - Revocation checks:
    - patient token revoked (`server/appointmentsRouter.ts:403-408`)
    - doctor token revoked (`server/appointmentsRouter.ts:410-415`)
  - Status/payment gating via `ensureAppointmentStatusAllowsVisit` (`server/appointmentsRouter.ts:334-364`, call at `417-421`):
    - requires `paymentStatus === "paid"`
    - forbids status `draft|pending_payment|expired|refunded`
    - forbids `send_message` when status is `completed`
- Return structure:
  - Patient token branch: `{ role: "patient", appointment: { ...appointment, lastAccessAt: touchedAt } }` (`server/appointmentsRouter.ts:425-437`)
  - Doctor token branch: `{ role: "doctor", appointment: { ...appointment, doctorLastAccessAt: touchedAt } }` (`server/appointmentsRouter.ts:439-449`)

## 3) `appointmentTokens` table schema audit

### Result
- No `appointmentTokens` / `appointment_tokens` table definition found.
- No corresponding Drizzle model found in `drizzle/schema.ts`.
- No migration creating such table found in `drizzle/*.sql`.

### Requested schema fields/indexes
- Fields: N/A (table not present)
- Indexes: N/A (table not present)
- `revokedAt` / `expiresAt`: N/A (table not present)

## 4) Token-writing paths (and destination: legacy fields vs token table)

### 4.1 `settleStripePaymentBySessionId`
- Entry: `server/paymentsRouter.ts:137`
- Creates tokens:
  - `generateToken()` at `184` (patient), `186` (doctor)
  - `hashToken()` at `185`, `187`
- Writes destination:
  - Calls `appointmentsRepo.trySetAppointmentAccessTokensIfEmpty(...)` at `192-197`
  - Repo writes to legacy `appointments` columns (`accessTokenHash`, `doctorTokenHash`, `accessTokenExpiresAt`, revoked flags) at `server/modules/appointments/repo.ts:219-228`
- Conclusion: writes legacy `appointments` fields, not token table.

### 4.2 `appointments.resendLink`
- Entry: `server/appointmentsRouter.ts:684`
- Creates token:
  - `generateToken()` at `752`
  - `hashToken()` at `753`
- Writes destination:
  - `appointmentsRepo.updateAppointmentById(...{ accessTokenHash, accessTokenExpiresAt, accessTokenRevokedAt })` at `759-764`
- Conclusion: writes legacy `appointments` fields, not token table.

### 4.3 Other token creation/writes
- `appointments.resendDoctorLink` (`server/appointmentsRouter.ts:776`)
  - `generateToken()` at `814`
  - `hashToken()` at `815`
  - writes `doctorTokenHash`, `doctorTokenRevokedAt`, `accessTokenExpiresAt` via `updateAppointmentById` at `820-825`
  - destination: legacy `appointments` fields.
- `appointmentsRepo.markAppointmentPaid` (`server/modules/appointments/repo.ts:159`)
  - writes `accessTokenHash`, `doctorTokenHash`, expiry/revoked columns at `166-176`
  - destination: legacy `appointments` fields.
- `appointmentsRepo.trySetAppointmentAccessTokensIfEmpty` (`server/modules/appointments/repo.ts:208`)
  - conditional update of `appointments` token columns at `219-239`
  - destination: legacy `appointments` fields.
- `appointmentsRepo.createAppointmentDraft` (`server/modules/appointments/repo.ts:94`)
  - initializes token-related legacy columns to `null` at `122-127`
  - destination: legacy `appointments` fields.

## Final conclusion

- Is token validation mixed between legacy fields and token table? **NO**.
- Current state is legacy-field based validation/writes only; no `appointmentTokens` table usage was found.
- Answer to acceptance question: “`validateAppointmentToken` 当前是否只查 token 表” => **NO**. It checks `appointments.accessTokenHash` and `appointments.doctorTokenHash` directly.
