# Doctor Account Binding

## Goal

Keep the existing email OTP login flow, but grant doctor workbench access through an explicit admin-controlled invite and binding model.

## Core Decisions

- Authentication stays unified under `users`
- Doctor identity does not come from `users.role`
- Workbench access comes from `doctor_user_bindings`
- First release uses single invite sends from admin / ops
- Canonical doctor workbench entry is `/doctor/workbench`

## Data Model

- `doctor_account_invites`
  - Tracks doctor invite lifecycle, invite email, hashed token, expiry, and claim state
- `doctor_user_bindings`
  - Tracks which logged-in user is allowed to act as which doctor

## Flow

1. Admin enters `doctorId + email` in admin console
2. System creates or refreshes an invite token and emails the claim link
3. Doctor opens `/doctor/claim?token=...`
4. If not logged in, doctor signs in with the invited email
5. Claim succeeds only when the logged-in email matches the invite email
6. System creates an active doctor binding
7. Doctor accesses `/doctor/workbench`

## Authorization Rules

- Doctor self-service endpoints resolve doctor identity from `ctx.user.id -> active binding`
- Admin / ops can still inspect by `doctorId`
- Doctors cannot issue room links for appointments outside their own bound doctor
- Legacy `/doctor/:id/workbench` remains compatibility-only and rejects mismatched bindings
