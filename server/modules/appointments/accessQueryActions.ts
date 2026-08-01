import { invokeLLM } from "../../_core/llm";

type TriageIntakeRecord = Record<string, string | undefined>;
type TriageLocalizationCacheValue = {
  summary: string | null;
  intake: TriageIntakeRecord | null;
};
type EnglishFallbackMode = "source" | "empty";
type MedicalSummaryLocalizationInput = {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
};

const triageContentTranslationCache = new Map<
  string,
  TriageLocalizationCacheValue
>();
const medicalSummaryTranslationCache = new Map<
  string,
  MedicalSummaryLocalizationInput
>();
const TRIAGE_TRANSLATION_CACHE_LIMIT = 200;
const MEDICAL_SUMMARY_SECTION_KEYS = [
  "chiefComplaint",
  "historyOfPresentIllness",
  "pastMedicalHistory",
  "assessmentDiagnosis",
  "planRecommendations",
] as const satisfies ReadonlyArray<keyof MedicalSummaryLocalizationInput>;

function readAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map(item =>
      item &&
      typeof item === "object" &&
      "type" in item &&
      (item as { type?: string }).type === "text"
        ? String((item as { text?: unknown }).text ?? "")
        : ""
    )
    .join("")
    .trim();
}

function normalizeSummary(summary: string | null | undefined): string | null {
  const normalized = summary?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeIntake<TIntake extends TriageIntakeRecord | null>(
  intake: TIntake
): TIntake {
  if (!intake) {
    return intake;
  }

  const normalized: TriageIntakeRecord = { ...intake };
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === "string") {
      normalized[key] = value.trim();
    }
  }
  return normalized as TIntake;
}

function needsTranslationForTargetLanguage(
  value: string,
  targetLang: "en" | "zh"
) {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const hasZh = /[\u4e00-\u9fff]/.test(normalized);
  const hasEn = /[A-Za-z]/.test(normalized);
  if (targetLang === "en") {
    return hasZh;
  }
  return hasEn;
}

function shouldTranslateIntake(
  intake: TriageIntakeRecord | null,
  targetLang: "en" | "zh"
) {
  if (!intake) {
    return false;
  }
  return Object.values(intake).some(
    value =>
      typeof value === "string" &&
      needsTranslationForTargetLanguage(value, targetLang)
  );
}

function resolveLocalizedSummary(input: {
  current: string | null;
  localized: string | null;
  targetLang: "en" | "zh";
  englishFallbackMode: EnglishFallbackMode;
}) {
  if (!input.current) {
    return null;
  }

  if (!needsTranslationForTargetLanguage(input.current, input.targetLang)) {
    return input.current;
  }

  if (
    input.localized &&
    !needsTranslationForTargetLanguage(input.localized, input.targetLang)
  ) {
    return input.localized;
  }

  if (input.targetLang === "en" && input.englishFallbackMode === "empty") {
    return null;
  }

  return input.current;
}

function setTranslationCache<T>(cache: Map<string, T>, key: string, value: T) {
  cache.set(key, value);
  if (cache.size > TRIAGE_TRANSLATION_CACHE_LIMIT) {
    const first = cache.keys().next().value;
    if (typeof first === "string") {
      cache.delete(first);
    }
  }
}

function normalizeMedicalSummaryContent<
  TSummary extends MedicalSummaryLocalizationInput,
>(summary: TSummary): TSummary {
  const normalized = {
    ...summary,
  } as TSummary;

  for (const key of MEDICAL_SUMMARY_SECTION_KEYS) {
    normalized[key] = summary[key].trim();
  }

  return normalized;
}

function shouldTranslateMedicalSummaryContent(
  summary: MedicalSummaryLocalizationInput,
  targetLang: "en" | "zh"
) {
  return MEDICAL_SUMMARY_SECTION_KEYS.some(key =>
    needsTranslationForTargetLanguage(summary[key], targetLang)
  );
}

function parseLocalizedMedicalSummary(
  input: unknown
): MedicalSummaryLocalizationInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const parsed = input as Record<string, unknown>;

  return {
    chiefComplaint:
      typeof parsed.chiefComplaint === "string"
        ? parsed.chiefComplaint.trim()
        : "",
    historyOfPresentIllness:
      typeof parsed.historyOfPresentIllness === "string"
        ? parsed.historyOfPresentIllness.trim()
        : "",
    pastMedicalHistory:
      typeof parsed.pastMedicalHistory === "string"
        ? parsed.pastMedicalHistory.trim()
        : "",
    assessmentDiagnosis:
      typeof parsed.assessmentDiagnosis === "string"
        ? parsed.assessmentDiagnosis.trim()
        : "",
    planRecommendations:
      typeof parsed.planRecommendations === "string"
        ? parsed.planRecommendations.trim()
        : "",
  };
}

function mergeLocalizedMedicalSummary<
  TSummary extends MedicalSummaryLocalizationInput,
>(input: {
  current: TSummary;
  localized: MedicalSummaryLocalizationInput | null;
  targetLang: "en" | "zh";
}): TSummary {
  const merged = {
    ...input.current,
  } as TSummary;

  for (const key of MEDICAL_SUMMARY_SECTION_KEYS) {
    const currentValue = input.current[key];
    if (!needsTranslationForTargetLanguage(currentValue, input.targetLang)) {
      merged[key] = currentValue;
      continue;
    }

    const localizedValue = input.localized?.[key] ?? "";
    if (
      localizedValue.length > 0 &&
      !needsTranslationForTargetLanguage(localizedValue, input.targetLang)
    ) {
      merged[key] = localizedValue;
      continue;
    }

    merged[key] = input.targetLang === "en" ? "" : currentValue;
  }

  return merged;
}

function parseTranslatedIntake(input: unknown): TriageIntakeRecord | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const translated: TriageIntakeRecord = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      translated[key] = value.trim();
    }
  }

  return Object.keys(translated).length > 0 ? translated : null;
}

function mergeLocalizedIntake<TIntake extends TriageIntakeRecord | null>(
  current: TIntake,
  localized: TriageIntakeRecord | null,
  input: {
    targetLang: "en" | "zh";
    englishFallbackMode: EnglishFallbackMode;
  }
): TIntake {
  if (!current) {
    return current;
  }

  const merged: TriageIntakeRecord = { ...current };
  for (const [key, value] of Object.entries(current)) {
    if (typeof value !== "string") {
      continue;
    }

    if (!needsTranslationForTargetLanguage(value, input.targetLang)) {
      merged[key] = value;
      continue;
    }

    const localizedValue = localized?.[key] ?? "";
    if (
      localizedValue.length > 0 &&
      !needsTranslationForTargetLanguage(localizedValue, input.targetLang)
    ) {
      merged[key] = localizedValue;
      continue;
    }

    merged[key] =
      input.targetLang === "en" && input.englishFallbackMode === "empty"
        ? ""
        : value;
  }

  if (!localized) {
    return merged as TIntake;
  }

  for (const [key, value] of Object.entries(localized)) {
    if (typeof value === "string" && !(key in merged)) {
      merged[key] = value;
    }
  }
  return merged as TIntake;
}

export async function localizeTriageContent<
  TIntake extends TriageIntakeRecord | null,
>(input: {
  summary: string | null | undefined;
  intake: TIntake;
  targetLang: "en" | "zh";
  englishFallbackMode?: EnglishFallbackMode;
}): Promise<{ summary: string | null; intake: TIntake }> {
  const normalizedSummary = normalizeSummary(input.summary);
  const normalizedIntake = normalizeIntake(input.intake);
  const englishFallbackMode = input.englishFallbackMode ?? "source";

  const shouldTranslateSummary = normalizedSummary
    ? needsTranslationForTargetLanguage(normalizedSummary, input.targetLang)
    : false;
  const shouldTranslateAnyIntake = shouldTranslateIntake(
    normalizedIntake,
    input.targetLang
  );

  if (!shouldTranslateSummary && !shouldTranslateAnyIntake) {
    return {
      summary: normalizedSummary,
      intake: normalizedIntake,
    };
  }

  const cacheKey = `${input.targetLang}:${normalizedSummary ?? ""}:${JSON.stringify(
    normalizedIntake ?? {}
  )}`;
  const cached = triageContentTranslationCache.get(cacheKey);
  if (cached) {
    return {
      summary: resolveLocalizedSummary({
        current: normalizedSummary,
        localized: cached.summary,
        targetLang: input.targetLang,
        englishFallbackMode,
      }),
      intake: mergeLocalizedIntake(normalizedIntake, cached.intake, {
        targetLang: input.targetLang,
        englishFallbackMode,
      }),
    };
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            input.targetLang === "en"
              ? 'Translate the medical triage payload into natural English. Return strict JSON only: {"summary": string|null, "intake": object}. Keep intake keys unchanged and only translate values.'
              : '将医疗分诊信息翻译成自然中文。只返回严格 JSON：{"summary": string|null, "intake": object}。保留 intake 的键名不变，只翻译值。',
        },
        {
          role: "user",
          content: JSON.stringify({
            summary: normalizedSummary,
            intake: normalizedIntake ?? {},
          }),
        },
      ],
      maxTokens: 800,
      responseFormat: { type: "text" },
    });

    const translatedRaw = readAssistantText(
      response.choices?.[0]?.message?.content
    ).trim();
    if (!translatedRaw) {
      return {
        summary: resolveLocalizedSummary({
          current: normalizedSummary,
          localized: null,
          targetLang: input.targetLang,
          englishFallbackMode,
        }),
        intake: mergeLocalizedIntake(normalizedIntake, null, {
          targetLang: input.targetLang,
          englishFallbackMode,
        }),
      };
    }

    const parsed = JSON.parse(translatedRaw) as {
      summary?: unknown;
      intake?: unknown;
    };
    const localizedSummary =
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : null;
    const localizedIntake = parseTranslatedIntake(parsed.intake);
    const mergedIntake = mergeLocalizedIntake(
      normalizedIntake,
      localizedIntake,
      {
        targetLang: input.targetLang,
        englishFallbackMode,
      }
    );

    setTranslationCache(triageContentTranslationCache, cacheKey, {
      summary: localizedSummary,
      intake: localizedIntake,
    });

    return {
      summary: resolveLocalizedSummary({
        current: normalizedSummary,
        localized: localizedSummary,
        targetLang: input.targetLang,
        englishFallbackMode,
      }),
      intake: mergedIntake,
    };
  } catch (error) {
    console.warn("[appointments] triage content localization failed:", error);
    return {
      summary: resolveLocalizedSummary({
        current: normalizedSummary,
        localized: null,
        targetLang: input.targetLang,
        englishFallbackMode,
      }),
      intake: mergeLocalizedIntake(normalizedIntake, null, {
        targetLang: input.targetLang,
        englishFallbackMode,
      }),
    };
  }
}

export async function localizeMedicalSummaryContent<
  TSummary extends MedicalSummaryLocalizationInput,
>(input: { summary: TSummary; targetLang: "en" | "zh" }): Promise<TSummary> {
  const normalizedSummary = normalizeMedicalSummaryContent(input.summary);

  if (
    !shouldTranslateMedicalSummaryContent(normalizedSummary, input.targetLang)
  ) {
    return normalizedSummary;
  }

  const cacheKey = `${input.targetLang}:${JSON.stringify(normalizedSummary)}`;
  const cached = medicalSummaryTranslationCache.get(cacheKey);
  if (cached) {
    return mergeLocalizedMedicalSummary({
      current: normalizedSummary,
      localized: cached,
      targetLang: input.targetLang,
    });
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            input.targetLang === "en"
              ? "Translate the medical summary into natural English. Return strict JSON only with exactly these keys: chiefComplaint, historyOfPresentIllness, pastMedicalHistory, assessmentDiagnosis, planRecommendations. Do not add facts. If any field cannot be translated safely, return an empty string for that field."
              : "将医疗小结翻译成自然中文。只返回严格 JSON，且必须保留这五个键：chiefComplaint、historyOfPresentIllness、pastMedicalHistory、assessmentDiagnosis、planRecommendations。不要补充新事实。若某字段无法安全翻译，请返回空字符串。",
        },
        {
          role: "user",
          content: JSON.stringify(normalizedSummary),
        },
      ],
      maxTokens: 1200,
      responseFormat: { type: "text" },
    });

    const translatedRaw = readAssistantText(
      response.choices?.[0]?.message?.content
    ).trim();
    if (!translatedRaw) {
      return mergeLocalizedMedicalSummary({
        current: normalizedSummary,
        localized: null,
        targetLang: input.targetLang,
      });
    }

    const localized = parseLocalizedMedicalSummary(JSON.parse(translatedRaw));
    const merged = mergeLocalizedMedicalSummary({
      current: normalizedSummary,
      localized,
      targetLang: input.targetLang,
    });

    setTranslationCache(medicalSummaryTranslationCache, cacheKey, merged);

    return merged;
  } catch (error) {
    console.warn("[appointments] medical summary localization failed:", error);
    return mergeLocalizedMedicalSummary({
      current: normalizedSummary,
      localized: null,
      targetLang: input.targetLang,
    });
  }
}

export async function translateTriageSummary(
  summary: string,
  targetLang: "en" | "zh"
): Promise<string> {
  const localized = await localizeTriageContent({
    summary,
    intake: null,
    targetLang,
  });
  return localized.summary ?? summary.trim();
}

type SafeParseResult<T> = { success: true; data: T } | { success: false };

export function parseIntakeFromNotes<T>(
  notes: string | null | undefined,
  safeParse: (input: unknown) => SafeParseResult<T>
): T | null {
  const normalized = notes?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    const result = safeParse(parsed);
    if (!result.success) {
      return null;
    }

    const hasAnyField = Object.values(
      result.data as Record<string, unknown>
    ).some(value => typeof value === "string" && value.trim().length > 0);
    return hasAnyField ? result.data : null;
  } catch {
    return null;
  }
}
