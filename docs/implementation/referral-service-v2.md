# Referral Service v2

## Patient flow

The primary patient journey is:

`AI triage → ranked hospitals → hospital selection → MediBridge platform coordinator → email OTP → service agreement → CNY ¥199 payment → operations fulfillment → consultation arrangement`

The coordinator is always presented as a MediBridge platform representative,
not hospital staff. When no active coordinator exists for the recommended
hospital department, the patient may choose the MediBridge Coordination Team
fallback; the resulting order has no `contactId` and requires manual
assignment.

Doctor, appointment, scheduling, and visit-room routes remain available for
deep links and future use, but are not primary patient navigation.

## Order and payment guarantees

- New orders use agreement `referral_service_v2`, amount `19900`, and currency
  `cny`.
- `clientRequestId` is unique per patient and makes draft creation safe across
  login recovery, repeated clicks, and network retries.
- Guest users may triage and view selections but receive
  `FORMAL_ACCOUNT_REQUIRED` when attempting to create an order.
- Stripe Checkout metadata carries `resourceType=referral_order` and the order
  ID. The return page verifies provider state; URL parameters alone never mark
  an order paid.
- Stripe Webhooks and provider return verification converge on the same
  conditional payment transition.
- Full refunds use the order-scoped idempotency key
  `referral-order-{orderId}-full-refund`. Orders remain
  `refund_processing` until the provider confirms success.

Historical USD and `referral_service_v1` orders remain readable and are not
rewritten.

## Fulfillment SLA

Payment sets `fulfillmentDeadlineAt` to two Shanghai business days after the
provider-confirmed payment time. v1 skips Saturday and Sunday only.

The hourly fulfillment worker automatically starts a full refund when an order
is due in one of:

- `paid_pending_assignment`
- `assigned`
- `contacting`
- `booking_in_progress`

The dedicated “start time coordination” operation moves an order to
`time_coordination`, records that arrangeable feedback was obtained, and stops
the SLA refund. `time_coordination`, `scheduled`, `completed`, and refund
states are excluded.

## Notifications

Patient and operations email is written to
`referral_notification_outbox`. The notification worker claims rows
conditionally, retries transient failures, and marks the fifth failed attempt
terminal. Terminal failures appear in the referral operations detail.

Patient messages use the order agreement language and do not include the
triage summary. Consultation emails show time, time zone, and platform, but
keep the joining link on the authenticated order page.

Configure:

- `REFERRAL_OPS_EMAILS`
- `APP_BASE_URL`
- `RESEND_API_KEY`
- `RESEND_FROM` or `MAIL_FROM`

## Rollout

Schema changes are additive. Existing paid orders intentionally keep a null
SLA deadline so deployment cannot retroactively refund them. Generate and
apply the Drizzle migration only after explicit approval, then verify it with
`pnpm db:verify:migrations`.

Rollback should stop both referral workers first and roll application code back
before changing the schema. Restoring the old currency/agreement defaults is
safe; dropping the new outbox table or referral columns is destructive once v2
orders exist, so production rollback should normally leave those nullable
artifacts in place and remove them only after an audited export confirms they
contain no required payment, refund, arrangement, or notification history.
