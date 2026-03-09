import { invokeLLM } from "../../_core/llm";

const triageSummaryTranslationCache = new Map<string, string>();

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

export async function translateTriageSummary(
  summary: string,
  targetLang: "en" | "zh"
): Promise<string> {
  const normalized = summary.trim();
  if (!normalized) {
    return normalized;
  }

  const hasZh = /[\u4e00-\u9fff]/.test(normalized);
  const hasEn = /[A-Za-z]/.test(normalized);
  if ((targetLang === "en" && !hasZh) || (targetLang === "zh" && !hasEn)) {
    return normalized;
  }

  const cacheKey = `${targetLang}:${normalized}`;
  const cached = triageSummaryTranslationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            targetLang === "en"
              ? "Translate the medical triage summary to natural English. Keep the same fields and semicolon-separated structure. Output plain text only."
              : "将这段医疗分诊摘要翻译成自然中文。保留原有字段和分号分隔结构。只输出纯文本。",
        },
        { role: "user", content: normalized },
      ],
      maxTokens: 400,
      responseFormat: { type: "text" },
    });

    const translated = readAssistantText(response.choices?.[0]?.message?.content).trim();
    if (!translated) {
      return normalized;
    }

    triageSummaryTranslationCache.set(cacheKey, translated);
    if (triageSummaryTranslationCache.size > 200) {
      const first = triageSummaryTranslationCache.keys().next().value;
      if (typeof first === "string") {
        triageSummaryTranslationCache.delete(first);
      }
    }
    return translated;
  } catch (error) {
    console.warn("[appointments] triage summary translation failed:", error);
    return normalized;
  }
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
