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

The OTP remains server-only. The API contract, browser payloads, logs, session
cookie behavior, ten-minute expiry, and one-time consumption semantics do not
change.

## Consequences

- Testers can use an explicitly shared demo credential on the `dev` experience
  deployment without an email provider.
- Developers can complete local OTP flows without logging or returning OTP
  values and without pretending the local process is a deployed `dev` release.
- A `main`, feature-branch, locally packaged, or legacy release cannot enable
  the fixed OTP even if demo variables remain on the host.
- This is an authentication bypass for a non-production environment. Keep the
  allowlist minimal, never grant the demo user elevated roles, and remove the
  feature after transactional OTP email is available.
