# Visit Chat MVP Notes

## Current scope

- Visit chat access supports both patient and doctor magic links.
- The `/visit/:appointmentId?t=token` page supports text-only messaging.
- The browser exchanges the appointment link token for a visit-specific token
  before loading chat history or joining the realtime room.
- New messages are delivered over WebSocket; tRPC provides paginated history.
- Patient links can only send `senderType=patient`; doctor links can only send `senderType=doctor`.

## Realtime Chat Protocol

WebSocket endpoint: `/api/visit-room/ws`

### Client -> Server events

- `room.join`
  - payload: `{ token: string }`
  - note: the token is a visit-specific chat token; no `appointmentId` is
    trusted from the client payload
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

- Room join validates the scoped chat token, its source appointment token and
  the current appointment access policy:
  - allowed statuses: `paid`, `active` (and `paymentStatus=paid`)
- Message send adds extra rule on top of token validation:
  - only `active` can send (`paid` is read-only)
- When appointment becomes `ended/refunded/canceled/expired`, server pushes `room.status` and keeps room in read-only mode.

### History API

- tRPC: `visit.roomGetMessages`
- input: `{ token: visitChatToken, beforeCursor?, limit? }`
- output: `{ appointmentId, role, messages[], nextCursor, hasMore }`
- scope: returns only the appointment bound to the token

### Reliability

- Deduplication key: `appointmentMessages(appointmentId, clientMessageId)` unique index
- Server heartbeat: ping every 25s; stale sockets are closed
- Client reconnect: auto reconnect with backoff; reconnect triggers `room.join` again

## Scoped chat-token security

- `appointments.exchangeVisitChatToken` exchanges a valid appointment link
  token for a chat token with a maximum lifetime of 10 minutes.
- `appointments.refreshVisitChatToken` refreshes a valid chat token; the client
  refreshes 60 seconds before expiry.
- Chat token claims bind appointment, patient/doctor role, source token ID,
  issuer, audience and `visit_chat` purpose.
- The chat token cannot outlive the source appointment token. Every validation
  rechecks that the source token still exists and is neither revoked nor
  expired, then applies the current appointment access policy.
- WebSocket join/send and `visit.roomGetMessages` all require the scoped token.

## Data retention

- Configurable free and paid message-retention policies default to 7 and 180
  days. Inactive unbound guest accounts default to 30 days.
- Cleanup candidates and results are recorded in retention audits; admins can
  inspect policies, dry-run cleanup and export audit summaries.
- A daily worker is implemented but ships disabled. When scheduling is enabled,
  it still defaults to dry-run and requires a second explicit switch before
  deleting rows. See [`../ops/retention_cleanup.md`](../ops/retention_cleanup.md).
