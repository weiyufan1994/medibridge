# MedicalTripChina Project Kickoff (Shanghai MVP)

## Why start here
This kickoff focuses on the smallest set of capabilities that satisfy your goals while keeping the product explicitly non-diagnostic. The first release is scoped to Shanghai so we can:
- Build a high-quality, verified hospital directory before scaling.
- Establish a reliable paid video triage flow with bilingual doctors.
- Validate patient demand and operational workflows without overbuilding.

## MVP goals (Shanghai-only)
1. **Hospital directory and search** for Shanghai-based 三甲 hospitals and key specialties.
2. **AI chat intake** that collects a user’s description, then **suggests hospitals** based on published specialties and location preference (no diagnosis or treatment advice).
3. **Paid video triage booking** with bilingual doctors (Chinese/English).
4. **Medical trip plan generator** that outputs logistics and documentation steps after a doctor consult.

## MVP user flow
1. **Browse/Search** Shanghai hospital directory.
2. **AI intake chat** (non-diagnostic) → hospital suggestions + suggested departments.
3. **Doctor search** → select appointment time → **paid booking**.
4. **Video consult** (doctor-led, informational intake only).
5. **Trip plan** generated with travel checklist, appointment details, and document list.

## Data requirements (Shanghai)
- Hospital name, address, contact, website, and hospital level (三甲).
- Departments and specialties (as published by the hospital).
- Key physician profiles (public bio, languages, clinic hours).
- Verification timestamp and source link for every data record.

## Compliance and safety guardrails
- AI chat **must not** provide diagnosis, treatment, or risk scoring.
- All responses use disclaimers and reinforce that final medical decisions are with licensed clinicians.
- Video triage is framed as **pre-consultation/intake** for cross-border care.
- User consent + privacy notices before uploads and video calls.

## Monetization approach (paid triage)
- Per-appointment pricing in USD (North America) with clear refund policy.
- Optional service fees for travel coordination in later phases.

## Team and responsibilities (lean MVP)
- **Product**: define workflows, hospital data structure, and disclaimers.
- **Ops**: onboard Shanghai hospitals and bilingual doctors.
- **Engineering**: build mobile app, backend, admin console.
- **Legal/Compliance**: review scope, consent, and cross-border telehealth constraints.

## Technical approach (recommended)
### Mobile app
- **React Native** for iOS/Android in one codebase.
- Focus on fast iteration for a consumer-facing app.

### Backend
- REST or GraphQL API for hospital data, booking, and trip plans.
- Secure document storage (encrypted at rest) for uploads.
- Payment provider integration (e.g., Stripe).

### AI layer (strictly informational)
- Retrieval-based responses from the hospital directory.
- Tightly scoped prompt templates with refusal rules for diagnosis.
- Audit logs for prompts and model outputs.

## Phase 1 milestones (4–6 weeks)
1. Finalize hospital list and data schema (Shanghai).
2. Define the AI chat prompt rules and disclaimers.
3. Design UX flows for search, chat, booking, and trip plan.
4. Build backend endpoints and admin tools for data entry.

## Phase 2 milestones (6–10 weeks)
1. Build mobile app screens and connect APIs.
2. Implement payments and booking confirmations.
3. Pilot with a small set of bilingual doctors.
4. Launch private beta with early users.

## Phase 3 milestones (post-MVP)
- Expand to other cities and add more hospitals.
- Add insurance guidance and concierge logistics.
- Refine matching using user preferences and outcomes feedback.
