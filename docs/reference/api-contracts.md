# API contract reference

This document is a navigation aid for the current public API surface. The
TypeScript routers, Zod schemas, and contract tests remain the executable source
of truth. Architecture and dependency rules are defined only in
[`../../.context/architecture.md`](../../.context/architecture.md).

## Transports

| Transport      | Public path                               | Contract owner                                                                             | Notes                                                                              |
| -------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| tRPC           | `/api/trpc`                               | [`server/routers/index.ts`](../../server/routers/index.ts)                                 | Client calls use `trpc.<namespace>.<procedure>` and SuperJSON serialization.       |
| Stripe webhook | `POST /api/payments/stripe/webhook`       | [`server/stripeWebhookRoute.ts`](../../server/stripeWebhookRoute.ts)                       | Registered before JSON middleware so signature verification receives the raw body. |
| PayPal webhook | `POST /api/payments/paypal/webhook`       | [`server/paypalWebhookRoute.ts`](../../server/paypalWebhookRoute.ts)                       | Registered before JSON middleware and verified by the PayPal adapter.              |
| OAuth callback | `GET /api/oauth/callback`                 | [`server/_core/oauth.ts`](../../server/_core/oauth.ts)                                     | Exchanges the provider callback and establishes the existing session cookie.       |
| Visit realtime | WebSocket upgrade at `/api/visit-room/ws` | [`server/modules/visit/realtimeGateway.ts`](../../server/modules/visit/realtimeGateway.ts) | Room operations require a scoped, short-lived visit chat token.                    |

The middleware registration order is protected by
[`server/_core/expressCompatibility.test.ts`](../../server/_core/expressCompatibility.test.ts).

## tRPC namespaces

| Namespace        | Router                                                                       | Primary responsibility                                                                  |
| ---------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `system`         | [`server/routers/system.ts`](../../server/routers/system.ts)                 | Health, metrics, and the stable `trpc.system.admin*` operations surface.                |
| `auth`           | [`server/routers/auth.ts`](../../server/routers/auth.ts)                     | Current user, OTP, magic-link verification, guest merge, and logout.                    |
| `ai`             | [`server/routers/ai.ts`](../../server/routers/ai.ts)                         | Triage sessions, messages, and usage summaries.                                         |
| `chat`           | [`server/routers/chat.ts`](../../server/routers/chat.ts)                     | General chat send/session operations.                                                   |
| `consultation`   | [`server/routers/consultation.ts`](../../server/routers/consultation.ts)     | Consultation history views backed by the AI module.                                     |
| `doctors`        | [`server/routers/doctors.ts`](../../server/routers/doctors.ts)               | Doctor directory search, detail, department lists, and recommendations.                 |
| `hospitals`      | [`server/routers/hospitals.ts`](../../server/routers/hospitals.ts)           | Hospital and department directory reads.                                                |
| `appointments`   | [`server/routers/appointments.ts`](../../server/routers/appointments.ts)     | Booking, access links, visit token exchange, workbench actions, and medical summaries.  |
| `scheduling`     | [`server/routers/scheduling.ts`](../../server/routers/scheduling.ts)         | Available slots and staff-managed schedule rules, exceptions, and slots.                |
| `doctorAccounts` | [`server/routers/doctorAccounts.ts`](../../server/routers/doctorAccounts.ts) | Doctor account binding and invitation lifecycle.                                        |
| `payments`       | [`server/routers/payments.ts`](../../server/routers/payments.ts)             | Checkout creation/result lookup and mock-provider confirmation.                         |
| `visit`          | [`server/routers/visit.ts`](../../server/routers/visit.ts)                   | Visit message history and token-authorized compatibility operations.                    |
| `referrals`      | [`server/routers/referrals.ts`](../../server/routers/referrals.ts)           | Patient referral orders plus staff assignment, progress, payment, and refund workflows. |

Procedure names, input schemas, and output types are declared beside each thin
router and its owned module `routerApi.ts`. Do not duplicate those shapes in
handwritten clients; consume the exported `AppRouter` type from
[`server/routers/index.ts`](../../server/routers/index.ts).

## Access levels

The common procedure constructors in
[`server/_core/trpc.ts`](../../server/_core/trpc.ts) attach one of four enforced
access levels:

| Access metadata | Requirement                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `public`        | No authenticated user is required; the procedure must perform any token or resource-specific validation itself. |
| `protected`     | A valid current user is required.                                                                               |
| `adminOrOps`    | The current user role must be `admin` or `ops`.                                                                 |
| `admin`         | The current user role must be `admin`.                                                                          |

Public does not mean unrestricted. Appointment links, visit chat tokens,
webhook signatures, idempotency keys, and resource ownership are validated at
their corresponding API/domain boundary.

## Frozen system contract

The public namespace remains `trpc.system.*`; admin procedures must not move to
another client path. Its 29 procedure names, query/mutation types, and access
metadata are asserted in
[`server/system.contract.test.ts`](../../server/system.contract.test.ts).
Bidirectional exact input/output type assertions live in
[`server/system.contract-types.ts`](../../server/system.contract-types.ts),
with expected shapes in `server/system.contract-inputs.ts` and
`server/system.contract-outputs.ts`.

Any intended change to this surface requires all of the following in the same
focused PR:

1. explicit compatibility and rollout notes;
2. updated router schemas and exact contract fixtures;
3. relevant permission and runtime result tests;
4. confirmation that existing client call paths still compile or a separately
   approved migration plan.

## Verification

Run the repository's mandatory checks from
[`../../.context/architecture.md`](../../.context/architecture.md). Changes to
routers or transport registration additionally require
`pnpm test:router-boundary` and the closest transport/permission tests.
