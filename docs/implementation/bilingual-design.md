# MediBridge bilingual data plan

## Goals
- Support en and zh display for dynamic data (hospitals, departments, doctors).
- Default language is auto (follow user input), with manual override.
- English mode must not show Chinese.
- Translations are offline batch jobs that write into English mirror columns.

## Chosen consistency strategy
- Record-level publishing with translation status.
- Each record has `translationStatus` (pending/done/failed).
- English mode uses English mirror fields only. If a required English field is missing, use a single global placeholder string: "Translation in progress".
- A refresh action re-fetches the record after background translation completes.

## Missing-translation policy
- Strategy: option (a) placeholder + refresh.
- The placeholder is shown for any missing English mirror fields and for any record with `translationStatus` != done.
- No Chinese fallback is allowed in English mode.

## Language detection and selection
- Client language mode: `auto | en | zh`.
- Auto detection: if user input contains CJK characters, use zh; otherwise en.
- Manual selection overrides auto. Mode is persisted in local storage.

## Search fallback
- Primary search uses the detected language fields.
- If `lang=en` and results are below the minimum threshold, translate the English keywords to Chinese and run a secondary Chinese search.
- Merge results by `doctor.id`, keeping the best rank.

## Translation pipeline
- New or updated Chinese fields compute `sourceHash` and set `translationStatus=pending`.
- Offline worker translates pending records in batches.
- Translation is idempotent and retryable: only records where `translationStatus in (pending, failed)` and `sourceHash` matches current source fields are processed.
- Output is JSON schema validated. Translation style: patient-friendly, faithful, no new facts, no medical advice.

## Field mapping (existing vs missing)

### Hospitals
- name -> nameEn (exists)
- city -> cityEn (missing)
- level -> levelEn (missing)
- address -> addressEn (missing)
- description -> descriptionEn (missing)

### Departments
- name -> nameEn (exists)
- description -> descriptionEn (missing)

### Doctors
- name -> nameEn (exists)
- title -> titleEn (missing)
- specialty -> specialtyEn (exists)
- expertise -> expertiseEn (exists)
- onlineConsultation -> onlineConsultationEn (missing)
- appointmentAvailable -> appointmentAvailableEn (missing)
- satisfactionRate -> satisfactionRateEn (missing)
- attitudeScore -> attitudeScoreEn (missing)

### Translation metadata (all three entities)
- sourceHash (sha256 of stable JSON of source fields)
- translationStatus (pending | done | failed)
- translatedAt (timestamp)
- lastTranslationError (text)
- translationProvider (varchar)

## Hashing rules
- Stable JSON ordering per table, fields trimmed and null-normalized.
- Only Chinese source fields are hashed.
- If hash changes, status resets to pending and `translatedAt` cleared.

## Offline translation worker
- Supports hospitals, departments, doctors.
- Configurable batch size, concurrency, and rate limits.
- Exponential backoff with max retry count.
- Writes translated fields and sets `translationStatus=done` or `failed`.

## LLM usage
- Reuse server `_core/llm.ts` wrapper.
- Use JSON schema response format for all translation outputs.
- Doctor name translation rule: do not translate into Western name; use pinyin or "Dr. + pinyin".
- Department name style: "Department of ...".

## API contract changes
- Add `lang` to hospital, department, doctor fetches and search.
- `lang=en` returns English mirror fields and translation status.
- `lang=zh` returns Chinese fields.
- Chat endpoints detect language, adjust prompts, and use language-aware search and ranking.

## Frontend changes
- Add language context with auto/en/zh and a switcher.
- Central helper to pick fields for display.
- Replace all direct `name/specialty/expertise` usage with the helper.
