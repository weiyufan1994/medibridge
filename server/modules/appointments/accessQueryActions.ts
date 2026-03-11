import { invokeLLM } from "../../_core/llm";

type TriageIntakeRecord = Record<string, string | undefined>;
type TriageLocalizationCacheValue = {
  summary: string | null;
  intake: TriageIntakeRecord | null;
};

const triageContentTranslationCache = new Map<string, TriageLocalizationCacheValue>();
const TRIAGE_TRANSLATION_CACHE_LIMIT = 200;

function readAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map(item =>
      item && typeof item === "object" && "type" in item && (item as { type?: string }).type === "text"
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

function normalizeIntake<TIntake extends TriageIntakeRecord | null>(intake: TIntake): TIntake {
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

function needsTranslationForTargetLanguage(value: string, targetLang: "en" | "zh") {
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

function setTranslationCache(key: string, value: TriageLocalizationCacheValue) {
  triageContentTranslationCache.set(key, value);
  if (triageContentTranslationCache.size > TRIAGE_TRANSLATION_CACHE_LIMIT) {
    const first = triageContentTranslationCache.keys().next().value;
    if (typeof first === "string") {
      triageContentTranslationCache.delete(first);
    }
  }
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
  localized: TriageIntakeRecord | null
): TIntake {
  if (!current) {
    return current;
  }

  const merged: TriageIntakeRecord = { ...current };
  if (!localized) {
    return merged as TIntake;
  }

  for (const [key, value] of Object.entries(localized)) {
    if (typeof value === "string") {
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
}): Promise<{ summary: string | null; intake: TIntake }> {
  const normalizedSummary = normalizeSummary(input.summary);
  const normalizedIntake = normalizeIntake(input.intake);

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
      summary: cached.summary,
      intake: mergeLocalizedIntake(normalizedIntake, cached.intake),
    };
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            input.targetLang === "en"
              ? "Translate the medical triage payload into natural English. Return strict JSON only: {\"summary\": string|null, \"intake\": object}. Keep intake keys unchanged and only translate values."
              : "将医疗分诊信息翻译成自然中文。只返回严格 JSON：{\"summary\": string|null, \"intake\": object}。保留 intake 的键名不变，只翻译值。",
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

    const translatedRaw = readAssistantText(response.choices?.[0]?.message?.content).trim();
    if (!translatedRaw) {
      return {
        summary: normalizedSummary,
        intake: normalizedIntake,
      };
    }

    const parsed = JSON.parse(translatedRaw) as {
      summary?: unknown;
      intake?: unknown;
    };
    const localizedSummary =
      typeof parsed.summary === "string" && parsed.summary.trim().length > 0
        ? parsed.summary.trim()
        : normalizedSummary;
    const localizedIntake = parseTranslatedIntake(parsed.intake);
    const mergedIntake = mergeLocalizedIntake(normalizedIntake, localizedIntake);

    setTranslationCache(cacheKey, {
      summary: localizedSummary,
      intake: localizedIntake,
    });

    return {
      summary: localizedSummary,
      intake: mergedIntake,
    };
  } catch (error) {
    console.warn("[appointments] triage content localization failed:", error);
    return {
      summary: normalizedSummary,
      intake: normalizedIntake,
    };
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

    const hasAnyField = Object.values(result.data as Record<string, unknown>).some(
      value => typeof value === "string" && value.trim().length > 0
    );
    return hasAnyField ? result.data : null;
  } catch {
    return null;
  }
}
