# MediBridge I18n Layering Guidelines

## Purpose
This document defines where bilingual text should live so MediBridge avoids:

- English pages leaking Chinese content
- backend enums or error codes reaching patient UI
- duplicated business copy split between frontend and backend

## Layering Rules
### `ui_copy`
Store pure UI text in frontend `copy.ts` modules or UI-facing helpers.

Examples:
- buttons
- form labels and placeholders
- empty states
- toast messages
- panel titles and help text

Rule:
- UI copy must not be added to API responses.
- New UI work should not add inline `resolved === "zh"` branches in JSX when a copy/helper can own the text.

### `business_content`
Store reusable business content in backend modules, schemas, or database fields.

Examples:
- triage safety interruption messages
- appointment package titles and descriptions
- visit summary API payloads
- doctor / hospital / department bilingual content
- visit summaries and email bodies

Rule:
- Business content should be returned as structured bilingual data, preferably `LocalizedText`.
- Business content should not depend on frontend-maintained code maps as the source of truth.

### `presentation_fallback`
Frontend may keep temporary fallbacks for rendering safety.

Examples:
- fallback interruption text keyed by `riskCodes`
- placeholders when English content is still missing

Rule:
- Fallbacks are transitional.
- Fallbacks must not become the primary source of business messaging.

## Shared Interface
Use this shared shape for new bilingual business content:

```ts
type LocalizedText = {
  zh: string;
  en: string;
};
```

Preferred API style:

```ts
{
  title: { zh: "...", en: "..." },
  description: { zh: "...", en: "..." }
}
```

Avoid introducing new flat pairs such as `titleZh` / `titleEn` for new interfaces.

## Current Project Defaults
- Frontend owns `client/src/features/*/copy.ts`.
- Backend owns triage safety rule messages and package catalog business content.
- Backend owns visit summary business content, even when storage still uses `summaryZh` / `summaryEn`.
- Frontend should use shared selectors like `getLocalizedField` / `getLocalizedText` instead of open-coded language fallbacks.

## Tracking
Use the inline branch scan to measure cleanup progress:

```bash
pnpm check:i18n:inline
```

This scan reports `client/src` files that still contain inline `lang/resolved === "zh"` branches outside `copy.ts`.
