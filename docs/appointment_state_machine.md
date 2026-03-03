# Appointment State Machine

This file defines the canonical state transitions for `appointments.status` and `appointments.paymentStatus`.

## Canonical state combinations

| status | paymentStatus | Meaning |
|---|---|---|
| `draft` | `unpaid` | Appointment draft created, payment not started |
| `pending_payment` | `pending` | Checkout session created, waiting for Stripe completion |
| `paid` | `paid` | Payment settled, magic link generated |
| `confirmed` | `paid` | Appointment accepted/confirmed but not started |
| `in_session` | `paid` | Visit chat/session started |
| `completed` | `paid` | Visit finished |
| `expired` | `expired` | Expired and no longer usable |
| `refunded` | `refunded` | Refunded and closed |

Non-canonical combinations should be treated as invalid states and should not be produced by normal flows.

## Transition table

| Trigger | Actor | Preconditions | Transition result | status_events write | Frontend copy suggestion |
|---|---|---|---|---|---|
| `createAppointmentCheckout` | `patient/system` | Valid doctor + triage + schedule input | `draft/unpaid` (create) | `null -> draft`, reason `appointment_draft_created` | `Appointment draft created` |
| `createAppointmentCheckout` | `system` | Existing row in `draft/unpaid` with generated Stripe session | `draft/unpaid -> pending_payment/pending` | `draft -> pending_payment`, reason `checkout_session_created` | `Checkout created, waiting for payment` |
| `settleStripePaymentBySessionId` | `webhook` | `stripeSessionId` matches and row is exactly `pending_payment/pending` | `pending_payment/pending -> paid/paid` | `pending_payment -> paid`, reason `stripe_webhook_paid` | `Payment successful, access link sent` |
| `confirmMockCheckout` (non-prod) | `system` | Same as settle precondition | `pending_payment/pending -> paid/paid` | `pending_payment -> paid`, reason `mock_payment_paid` | `Payment marked as paid` |
| First `sendMessageByToken` that starts visit | `system` | current `status` is `paid` or `confirmed` | `paid/paid -> in_session/paid` OR `confirmed/paid -> in_session/paid` | write real `fromStatus` (`paid` or `confirmed`) to `in_session`, reason `first_visit_message` | `Visit started` |
| `admin confirm` (if enabled) | `admin/system` | current state `paid/paid` | `paid/paid -> confirmed/paid` | `paid -> confirmed`, reason e.g. `admin_confirmed` | `Appointment confirmed` |
| `admin complete` (if enabled) | `admin/system` | current state `in_session/paid` | `in_session/paid -> completed/paid` | `in_session -> completed`, reason e.g. `admin_completed` | `Visit completed` |
| `refund` | `admin/webhook` | current state in `paid/paid`, `confirmed/paid`, `in_session/paid`, `completed/paid` | `* -> refunded/refunded` | write actual `fromStatus` to `refunded`, reason e.g. `payment_refunded` | `Payment refunded` |
| `expire` | `system/admin` | pending timeout or policy timeout | `pending_payment/pending -> expired/expired` OR `paid/paid|confirmed/paid -> expired/expired` | write actual `fromStatus` to `expired`, reason e.g. `expired_by_timeout` | `Appointment expired, please rebook` |

## Logging integrity rules

1. `status_events.fromStatus` must always be the true previous status in DB, never a hard-coded value.
2. Transitions must be compare-and-swap style where possible (conditioned by current state), so repeated calls are idempotent.
3. If transition did not happen (`affectedRows = 0`), no new `status_events` row should be written.
4. For duplicated webhook/retry flows, return already-settled result and do not duplicate event rows.
