# Database ownership reference

Medibridge uses PostgreSQL through Drizzle. The executable schema is
[`drizzle/schema.ts`](../../drizzle/schema.ts); ordered SQL migrations under
[`drizzle/`](../../drizzle/) are the deployment history. This document records
logical ownership so new code does not bypass module boundaries. It is not a
replacement for the schema or migrations.

## Ownership model

- A table has a primary owning module even when workflows relate it to records
  owned by another module.
- Domain code accesses its owned repository. Cross-domain orchestration uses
  module `publicApi.ts` contracts from `server/workflows/*`.
- Routers do not query Drizzle directly.
- Foreign-key relationships do not authorize cross-module repository imports.
- Schema or migration changes remain high risk and require an explicit rollout
  and rollback plan.

## Table groups

Names below are Drizzle schema exports; physical PostgreSQL identifiers remain
defined by each `pgTable(...)` declaration.

| Primary owner                 | Schema exports                                                                                                                                                                                                                                            | Purpose and boundary notes                                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                          | `users`, `patientSessions`                                                                                                                                                                                                                                | Identity, roles, guest/formal user state, and authenticated sessions. Auth/session/cookie behavior remains in the auth and `_core` boundaries.                                                                                                             |
| Hospital and doctor directory | `hospitals`, `departments`, `hospitalReferenceHospitals`, `hospitalReferenceSpecialties`, `hospitalReferenceSpecialtyRankings`, `hospitalReferenceGeneralRankings`, `hospitalReferenceStemRankings`, `doctors`, `doctorEmbeddings`, `doctorSpecialtyTags` | Search and reference catalog data. `doctorEmbeddings` uses pgvector; business consumers use doctor/hospital public APIs rather than direct table reads.                                                                                                    |
| Referrals                     | `referralContacts`, `referralOrders`, `referralOrderStatusEvents`, `referralOrderOperations`, `refundRequests`, `referralNotificationOutbox`                                                                                                              | Referral coordination, immutable progress/audit events, refund review, and notification delivery. Payment-provider results enter through referral workflows.                                                                                               |
| Doctor accounts               | `doctorUserBindings`, `doctorAccountInvites`                                                                                                                                                                                                              | Doctor-user binding and invitation lifecycle. Permission checks belong to the doctor account module.                                                                                                                                                       |
| AI and triage knowledge       | `aiChatSessions`, `aiChatMessages`, `triageKnowledgeDocuments`, `triageKnowledgeChunks`, `triageRiskEvents`, `triageSessionFlags`, `triageConsents`                                                                                                       | Triage conversation history, knowledge retrieval, risk signals, and consent provenance. Knowledge chunks use pgvector. Safety events and source/derivation metadata must be preserved.                                                                     |
| Scheduling                    | `doctorScheduleRules`, `doctorScheduleExceptions`, `doctorSlots`                                                                                                                                                                                          | Slot generation, overrides, and occupancy. Appointment workflows consume the scheduling public API.                                                                                                                                                        |
| Chat                          | `consultationMessages`                                                                                                                                                                                                                                    | General consultation message persistence outside the appointment visit-room stream.                                                                                                                                                                        |
| Appointments and visit        | `appointments`, `appointmentTokens`, `appointmentMessages`, `appointmentStatusEvents`, `appointmentVisitSummaries`, `appointmentMedicalSummaries`                                                                                                         | Booking/payment state, hashed access credentials, visit messages, transition audit, bilingual summaries, and signed structured medical summaries. Appointment/visit workflows coordinate state; source text and derivation metadata must not be discarded. |
| Payment webhook audit         | `stripeWebhookEvents`                                                                                                                                                                                                                                     | Provider-neutral persisted webhook idempotency/audit records despite the historical table name. Payment adapters normalize provider results before workflows update appointments or referrals.                                                             |
| Admin retention               | `visitRetentionPolicies`, `retentionCleanupAudits`                                                                                                                                                                                                        | Configurable visit-message retention policy and cleanup audit history. Runtime scheduling and safe activation are documented in [`../ops/retention_cleanup.md`](../ops/retention_cleanup.md).                                                              |

## Important relationships

- `appointments.triageSessionId` links booking to the originating AI triage
  session; deletion is restricted.
- `appointments.userId` can be reassigned during the audited guest-upgrade
  workflow without transferring ownership of auth persistence.
- `appointments.slotId` associates a booking with scheduling capacity; the
  booking workflow owns cross-domain coordination and conflict handling.
- Appointment tokens are stored as hashes. Scoped visit chat tokens are
  short-lived signed credentials and are not persisted as reusable plaintext.
- Appointment messages preserve original/translated content and language and
  provider metadata used by bilingual visit behavior.
- Status-event, webhook-event, referral-operation, risk-event, and cleanup-audit
  tables are audit records; callers must not replace them with untracked state
  changes.

## PostgreSQL extensions and migrations

Doctor and triage knowledge embeddings depend on pgvector and HNSW indexes.
Extension/index setup is represented by the checked-in `0002` migrations and
the vector columns in `drizzle/schema.ts`. Do not infer current database state
from historical migration audit documents alone.

Never hand-edit `drizzle/meta/**`. Before a schema change, follow the repository
approval rules and verify the migration chain with the approved database
workflow. This reference does not authorize generating migrations or running
them against any environment.
