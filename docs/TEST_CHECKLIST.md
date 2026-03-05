# MediBridge Test Checklist

This checklist is for daily local validation after code changes.

## 1. Quick Start

1. Install dependencies
```bash
pnpm install
```
2. Apply migrations (if schema changed)
```bash
pnpm db:push
```
3. Run type check
```bash
pnpm check
```
4. Run tests
```bash
pnpm test
```
5. Start dev server
```bash
pnpm dev
```

## 2. Automated Regression Gate

Run these before manual QA:

```bash
pnpm check
pnpm test
```

Expected:
- Type check passes with no errors.
- Existing test suites pass (`auth`, `ai-billing`, `appointments`, `visit`, `doctors`, `appointmentToken`).
- E2E-style payment flow test passes:
  - `booking/payment -> webhook settlement -> issue links -> join room`
- Appointment state regression matrix is covered in tests:
  - `pending`, `paid`, `failed`, `refunded`, `expired`, `canceled`

## 3. Core E2E Flow (Manual)

### A. AI Triage Session

1. Open `/triage` as guest user.
2. Send first message.
3. Confirm triage session is created and assistant replies.
4. Continue chatting and verify behavior is stable.

Expected:
- No auth crash for guest.
- Conversation persists in current session.

### B. Message Limit Guardrail

1. Keep sending messages in the same triage session.
2. Reach the per-session cap.

Expected:
- At cap, system returns predefined closing reply.
- Session transitions to `completed`.
- Input is disabled on frontend.

### C. Doctor Recommendation + Booking

1. Complete triage and trigger recommendation list.
2. Select a doctor and create an appointment.

Expected:
- Appointment is created successfully.
- In development, `appointments.create` response includes:
  - `devLink` (patient link)
  - `devDoctorLink` (doctor link)

### D. Visit Room: Patient and Doctor Dual-Role Test

1. Open `devLink` in browser window A (patient role).
2. Open `devDoctorLink` in browser window B (doctor role).
3. Send a message from patient.
4. Confirm doctor receives it via polling.
5. Reply from doctor.
6. Confirm patient receives doctor message.

Expected:
- Both sides can read and send.
- Sender type is correct (`patient` / `doctor`).
- No duplicate message on retries (clientMessageId idempotency).

### E. Token Validation Scenarios

1. Modify `t` query param to an invalid value.
2. Access visit/appointment page with invalid token.

Expected:
- Returns authorization error.
- No data leak.

### F. Auth Upgrade (Guest -> Formal)

1. Use triage/appointment as guest.
2. Login with OTP.
3. Open dashboard.

Expected:
- Guest assets are merged into formal user.
- Session/appointment records remain accessible.

## 4. API Smoke Checklist

Run spot checks on these routers after related changes:

- `auth`: `requestOtp`, `verifyOtpAndMerge`, `verifyMagicLink`, `logout`
- `ai`: `createSession`, `sendMessage`, `getUsageSummary`, `listMySessions`
- `appointments`: `create`, `getByToken`, `rescheduleByToken`, `joinInfoByToken`, `resendLink`
- `visit`: `getMessagesByToken`, `sendMessageByToken`, `pollNewMessagesByToken`
- `doctors`: `recommend`, `getById`, `getByDepartment`
- `hospitals`: `getAll`, `getDepartments`

## 5. High-Risk Change Matrix

When these files change, run full checklist:

- `drizzle/schema.ts`
- `server/routers/ai.ts`
- `server/appointmentsRouter.ts`
- `server/visitRouter.ts`
- `server/modules/*/repo.ts`
- `server/_core/context.ts`
- `server/_core/llm.ts`

## 6. Common Failure Triage

1. `FORBIDDEN` on triage create session:
- Check guest/free quota rules.

2. Visit room works for patient but not doctor:
- Verify using `devDoctorLink` instead of `devLink`.

3. No response from model:
- Verify `.env` keys and `LLM_MODEL` / API base URL.

4. Data shape mismatch after DB changes:
- Re-run `pnpm db:push` and re-test affected flows.

## 7. Release Minimum Bar

Before merge/release:

1. `pnpm check` pass
2. `pnpm test` pass
3. Manual core flow pass:
- triage
- booking
- patient/doctor visit messaging
- OTP merge
4. No critical console/server errors in dev logs
