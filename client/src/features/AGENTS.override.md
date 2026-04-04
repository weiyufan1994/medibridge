## Feature-UI rules
- Keep route pages thin and feature modules reusable.
- Prefer feature-local `copy.ts` or shared i18n utilities for user-facing text.
- Do not add inline bilingual branches inside view components when a helper or copy resource should own the text.
- Keep locale-sensitive behavior deterministic and easy to test.
- Avoid broad visual rewrites during logic or data fixes.