# Resend Rate Limit

## Rule
- Scope: same `appointmentId + role`.
- Window: 60 seconds.
- Behavior: only one resend token issuance is allowed within the window.

## Implementation
- Uses token table (`appointmentTokens`) latest `createdAt` as source of truth.
- Check point:
  - `appointmentsRouter.resendLink` (role=`patient`)
  - `appointmentsRouter.resendDoctorLink` (role=`doctor`)
- Query helper: `appointmentsRepo.getLatestAppointmentTokenIssuedAt({ appointmentId, role })`.

## Error returned when limited
- `TRPCError.code = "TOO_MANY_REQUESTS"`
- `message = "Please wait at least 60 seconds before resending again"`

This message is ready for direct frontend display.
