# Appointment Entry Link Auth

## Overview
Medibridge uses short-lived appointment access tokens instead of traditional account login for room entry links.

- Link format: `{APP_BASE_URL}/room?token=<token>`
- Token contains no clear-text identity data (`appointmentId`, email, role are not exposed)
- Database stores only `sha256(token)` in `appointmentTokens.tokenHash`

## Issuance Strategy
Current strategy is **revoke-and-reissue**:

1. Revoke existing non-revoked tokens for the appointment (`reason=reissued`)
2. Issue a fresh patient token and doctor token
3. Return `patientLink`, `doctorLink`, `expiresAt`

This avoids long-lived forwarded links remaining valid after re-send.

## Validation Rules
Server validation checks:

- token exists
- token not expired
- token not revoked
- `useCount < maxUses` (atomic increment)
- role/appointment match when expected by endpoint
- appointment status/payment allow room access

Success returns access context:

- `appointmentId`
- `role`
- `tokenId`
- `tokenHash`
- `expiresAt`
- `displayInfo`

## Abuse Controls
- In-memory IP failure rate limiting (`APPOINTMENT_TOKEN_FAIL_*`)
- Validation failures are reason-coded (`TOKEN_INVALID`, `TOKEN_EXPIRED`, ...)
- Repeated failures on the same token hash auto-revoke token after threshold
- First successful IP/UA are persisted on token row (`ipFirstSeen`, `uaFirstSeen`)

## Environment Variables
- `APP_BASE_URL` (required for link generation)
- `APPOINTMENT_TOKEN_TTL_HOURS` (default: `24`)
- `APPOINTMENT_PATIENT_TOKEN_MAX_USES` (default: `1`)
- `APPOINTMENT_DOCTOR_TOKEN_MAX_USES` (default: `20`)
- `APPOINTMENT_TOKEN_FAIL_WINDOW_MS` (default: `60000`)
- `APPOINTMENT_TOKEN_FAIL_MAX_PER_IP` (default: `20`)
- `APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES` (default: `30`)

## APIs
Implemented in `appointmentsRouter`:

- `issueAccessLinks({ appointmentId })`
- `validateAccessToken({ token })`
- `revokeAccessToken({ appointmentId?, role?, token?, revokeReason? })`
