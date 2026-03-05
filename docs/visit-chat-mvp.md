# Visit Chat MVP Notes

## Current scope

- Visit chat access supports both patient and doctor magic links.
- The `/visit/:appointmentId?t=token` page supports text-only messaging.
- New messages are fetched by client polling every 2.5 seconds.
- Patient links can only send `senderType=patient`; doctor links can only send `senderType=doctor`.

## Realtime Chat Protocol

WebSocket endpoint: `/api/visit-room/ws`

### Client -> Server events

- `room.join`
  - payload: `{ token: string }`
  - note: token-only join, no `appointmentId` in client payload
- `message.send`
  - payload: `{ textOriginal: string, clientMessageId: string }`
  - `clientMessageId` is required for idempotent retry

### Server -> Client events

- `room.joined`
  - payload: `{ appointmentId, role, currentStatus, canSendMessage, recentCursor }`
- `message.new`
  - payload: `{ id, appointmentId, senderRole, textOriginal, textTranslated, createdAt, clientMessageId, ... }`
- `room.status`
  - payload: `{ appointmentId, role, currentStatus, canSendMessage }`
- `error`
  - payload: `{ code, message }`

### Permission model

- Room join uses existing token validation + `ensureAppointmentStatusAllowsVisitV2`:
  - allowed statuses: `paid`, `active` (and `paymentStatus=paid`)
- Message send adds extra rule on top of token validation:
  - only `active` can send (`paid` is read-only)
- When appointment becomes `ended/refunded/canceled/expired`, server pushes `room.status` and keeps room in read-only mode.

### History API

- tRPC: `visit.roomGetMessages`
- input: `{ token, beforeCursor?, limit? }`
- output: `{ appointmentId, role, messages[], nextCursor, hasMore }`
- scope: returns only the appointment bound to the token

### Reliability

- Deduplication key: `appointmentMessages(appointmentId, clientMessageId)` unique index
- Server heartbeat: ping every 25s; stale sockets are closed
- Client reconnect: auto reconnect with backoff; reconnect triggers `room.join` again

## Security follow-up

- The current appointment tokens grant visit message access for their whole validity period.
- A future hardening step should introduce a shorter-lived, visit-specific token for chat-room entry.

## Data retention follow-up

- Medical chat messages should have a retention policy.
- Current access policy: both patient and doctor links expire at `scheduledAt + 60 minutes + 7 days`.
- Recommended cleanup job: regularly delete expired appointment messages from `appointmentMessages`.
