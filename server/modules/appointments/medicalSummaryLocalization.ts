import { invokeLLM } from "../../_core/llm";
import { createLogger } from "../../_core/logger";

const logger = createLogger("medical-summary-localization");

type MedicalSummaryLocalizationInput = {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
};

const medicalSummaryTranslationCache = new Map<
  string,
  MedicalSummaryLocalizationInput
>();
const MEDICAL_SUMMARY_TRANSLATION_CACHE_LIMIT = 200;
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

function setTranslationCache(
  cache: Map<string, MedicalSummaryLocalizationInput>,
  key: string,
  value: MedicalSummaryLocalizationInput
) {
  cache.set(key, value);
  if (cache.size > MEDICAL_SUMMARY_TRANSLATION_CACHE_LIMIT) {
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
    logger.warn("translation_failed", {
      targetLang: input.targetLang,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return mergeLocalizedMedicalSummary({
      current: normalizedSummary,
      localized: null,
      targetLang: input.targetLang,
    });
  }
}
