# Visit Chat MVP Notes

## Current scope

- Visit chat access supports both patient and doctor magic links.
- The `/visit/:appointmentId?t=token` page supports text-only messaging.
- New messages are fetched by client polling every 2.5 seconds.
- Patient links can only send `senderType=patient`; doctor links can only send `senderType=doctor`.

## Security follow-up

- The current appointment tokens grant visit message access for their whole validity period.
- A future hardening step should introduce a shorter-lived, visit-specific token for chat-room entry.

## Data retention follow-up

- Medical chat messages should have a retention policy.
- Current access policy: both patient and doctor links expire at `scheduledAt + 60 minutes + 7 days`.
- Recommended cleanup job: regularly delete expired appointment messages from `appointmentMessages`.
