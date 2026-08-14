# ADR 0005: Restrict Fixed OTP to Explicit Non-Production Runtimes

- Status: Accepted
- Date: 2026-08-14

## Context

The public experience server needs a temporary login path before transactional
email delivery is connected. Returning OTP values from the API or writing them
to CLI logs would reverse the secret-handling hardening. Trusting only a shared
server environment flag is also unsafe because the same host may later run a
`main` release while retaining old environment values.

## Decision

The release package records the dispatched Git ref in a `.release-channel`
artifact. The runtime reads that file and overwrites any environment-provided
release channel. Missing, empty, or non-`dev` channels fail closed.

A fixed demo OTP is accepted only when all of these conditions hold:

- the immutable release channel is exactly `dev`;
- `DEMO_OTP_ENABLED` is exactly `true` after normalization;
- the normalized email appears in `DEMO_OTP_EMAILS`;
- `DEMO_OTP_CODE` is exactly six digits; and
- the user first requested an OTP that has not expired or been consumed.

Local development uses a separate fixed OTP profile. It is accepted only when:

- `NODE_ENV` is exactly `development`;
- `MEDIBRIDGE_RELEASE_CHANNEL` is exactly `local`, as set by `pnpm dev`;
- `LOCAL_OTP_ENABLED` is exactly `true` after normalization;
- the normalized email appears in `LOCAL_OTP_EMAILS`; and
- `LOCAL_OTP_CODE` is exactly six digits.

The local and deployed demo profiles use separate variables. A `dev` or `main`
artifact marker cannot activate the local profile, even if local variables are
present in a shared environment.

The deployed `dev` experience may also enable a single administrator test
credential through a third, independent profile:

- the immutable release channel must be exactly `dev`;
- `DEV_ADMIN_OTP_ENABLED` must be exactly `true` after normalization;
- `DEV_ADMIN_OTP_EMAIL` must contain exactly one normalized email;
- `DEV_ADMIN_OTP_CODE` must be exactly six digits;
- the administrator email must not appear in `DEMO_OTP_EMAILS`; and
- the administrator code must differ from `DEMO_OTP_CODE`.

Any overlap between the public demo and administrator profile fails closed for
both fixed credentials. A `main`, local, feature, missing, or unknown release
channel cannot activate the administrator profile. Account roles remain owned
by persisted authorization data; fixed OTP configuration never grants a role.

The OTP remains server-only. The API contract, browser payloads, logs, session
cookie behavior, ten-minute expiry, and one-time consumption semantics do not
change.

## Consequences

- Testers can use an explicitly shared demo credential on the `dev` experience
  deployment without an email provider.
- Developers can complete local OTP flows without logging or returning OTP
  values and without pretending the local process is a deployed `dev` release.
- Authorized testers can exercise the existing admin account on `dev` without
  sharing the public demo credential or changing role assignment behavior.
- A `main`, feature-branch, locally packaged, or legacy release cannot enable
  the fixed OTP even if demo variables remain on the host.
- This is an authentication bypass for a non-production environment. Keep the
  allowlist minimal, never grant the demo user elevated roles, and remove the
  feature after transactional OTP email is available.
