# Payment and Appointment State Machine

## Status Set
- Appointment status: `draft`, `pending_payment`, `paid`, `active`, `ended`, `expired`, `refunded`, `canceled`
- Payment status: `unpaid`, `pending`, `paid`, `failed`, `expired`, `refunded`, `canceled`

## Canonical Mapping
- `draft` -> `unpaid`
- `pending_payment` -> `pending`
- `paid` -> `paid`
- `active` -> `paid`
- `ended` -> `paid`
- `expired` -> `expired`
- `refunded` -> `refunded`
- `canceled` -> `canceled` (or `failed` when canceled after a failed payment signal)

## Allowed Transitions
- `draft -> pending_payment | canceled`
- `pending_payment -> paid | expired | canceled`
- `paid -> active | ended | refunded | canceled`
- `active -> ended | refunded | canceled`
- `ended -> refunded`

All transitions are validated by centralized state machine helpers in `server/modules/appointments/stateMachine.ts`.

## Visit Permission Rule (V2)
`ensureAppointmentStatusAllowsVisitV2` allows room access only when:
- `paymentStatus === paid`
- `status in (paid, active)`

For `pending_payment`, `ended`, `expired`, `refunded`, `canceled`, access is rejected with unified code:
- `APPOINTMENT_NOT_ALLOWED`

## Event Logging
Every legal status transition writes one row to `appointment_status_events`.

Illegal transition attempts are also recorded as an event with reason `illegal_transition_attempt` and payload including attempted target state.

## Settlement Idempotency
`settleStripePaymentBySessionId` is idempotent by `stripeSessionId` + state guard:
- Only `pending_payment/pending` can transition to `paid/paid`.
- Replayed webhooks for an already settled session return `alreadySettled=true`.
- Replays do not re-issue appointment tokens.
- Replays do not resend patient email link.

Webhook event-level idempotency is enforced by `stripe_webhook_events.eventId` unique key.

## Re-init Payment and Session Rotation
When re-initiating payment (`appointments.resendPaymentLink` / `payments.createCheckoutSessionForAppointment`):
- A new `stripeSessionId` is generated and stored.
- Previous active appointment tokens are revoked (defensive cleanup).
- Transition is recorded (`payment_reinitiated`).
- Old Stripe session IDs can no longer settle this appointment.

## Refund Handling
For refund webhooks (`charge.refunded` and successful `refund.updated`):
- Appointment transitions to `refunded/refunded` from `paid|active|ended`.
- All appointment tokens are revoked.
- Transition event is persisted.
