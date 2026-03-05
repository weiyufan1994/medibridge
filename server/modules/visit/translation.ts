import { invokeLLM } from "../../_core/llm";

export type MessageTranslationInput = {
  content: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export type MessageTranslationResult = {
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationProvider: string;
};

const LANGUAGE_ALIASES: Record<string, string> = {
  zh: "zh",
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-hant": "zh",
  cn: "zh",
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  english: "en",
  chinese: "zh",
  auto: "auto",
};

function normalizeLanguage(input: string | null | undefined): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) {
    return "auto";
  }
  return LANGUAGE_ALIASES[raw] ?? raw;
}

function detectLanguageFromText(text: string): "zh" | "en" {
  return /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
}

function resolveSourceLanguage(input: MessageTranslationInput): string {
  const normalizedSource = normalizeLanguage(input.sourceLanguage);
  if (normalizedSource !== "auto") {
    return normalizedSource;
  }
  return detectLanguageFromText(input.content);
}

function resolveTargetLanguage(input: MessageTranslationInput, sourceLanguage: string): string {
  const normalizedTarget = normalizeLanguage(input.targetLanguage);
  if (normalizedTarget !== "auto") {
    return normalizedTarget;
  }
  return sourceLanguage === "zh" ? "en" : "zh";
}

function readAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
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

export async function translateVisitMessage(
  input: MessageTranslationInput
): Promise<MessageTranslationResult> {
  const originalContent = input.content.trim();
  if (!originalContent) {
    return {
      originalContent,
      translatedContent: originalContent,
      sourceLanguage: "auto",
      targetLanguage: "auto",
      translationProvider: "identity",
    };
  }

  const sourceLanguage = resolveSourceLanguage(input);
  const targetLanguage = resolveTargetLanguage(input, sourceLanguage);

  if (sourceLanguage === targetLanguage) {
    return {
      originalContent,
      translatedContent: originalContent,
      sourceLanguage,
      targetLanguage,
      translationProvider: "identity",
    };
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            targetLanguage === "zh"
              ? "将输入内容翻译成自然中文，只输出翻译文本。"
              : "Translate input to natural English. Output translation text only.",
        },
        {
          role: "user",
          content: originalContent,
        },
      ],
      maxTokens: 300,
      responseFormat: { type: "text" },
    });

    const translated = readAssistantText(response.choices?.[0]?.message?.content);
    if (!translated) {
      return {
        originalContent,
        translatedContent: originalContent,
        sourceLanguage,
        targetLanguage,
        translationProvider: "identity",
      };
    }

    return {
      originalContent,
      translatedContent: translated,
      sourceLanguage,
      targetLanguage,
      translationProvider: "llm",
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[visit] message translation failed, fallback to original", error);
    }
    return {
      originalContent,
      translatedContent: originalContent,
      sourceLanguage,
      targetLanguage,
      translationProvider: "identity",
    };
  }
}
