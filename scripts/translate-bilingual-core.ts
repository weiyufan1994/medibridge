import { createHash } from "crypto";

export const DEFAULT_BATCH_SIZE = 20;
export const DEFAULT_CONCURRENCY = 4;
export const DEFAULT_RATE_LIMIT_MS = 80;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_LLM_BATCH_SIZE = 8;
export const DEFAULT_CACHE_ENABLED = true;
export const DEFAULT_API_CALL_LOG_INTERVAL = 25;

const SOURCE_EMPTY_MARKERS = new Set([
  "（页面未显示）",
  "(页面未显示)",
  "页面未显示",
  "暂无统计",
  "暂无",
  "无",
  "未知",
  "N/A",
  "NA",
  "n/a",
  "-",
  "--",
]);

const TRANSLATED_EMPTY_PATTERNS = [
  /<empty/i,
  /missing value/i,
  /not specified/i,
  /cannot be determined/i,
  /not available/i,
  /no information provided/i,
  /empty_string_value_please_do_not_replace/i,
];

export const HOSPITAL_CITY_TRANSLATIONS: Record<string, string> = {
  上海: "Shanghai",
};

export const HOSPITAL_LEVEL_TRANSLATIONS: Record<string, string> = {
  三级甲等: "Grade III Class A",
  三级乙等: "Grade III Class B",
  二级甲等: "Grade II Class A",
  二级乙等: "Grade II Class B",
};

export const parsePositiveInt = (
  value: string | number | undefined,
  fallback: number
) => {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized))
    return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(normalized))
    return false;
  return fallback;
};

export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

export const normalizeSourceText = (value: string | null | undefined) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (SOURCE_EMPTY_MARKERS.has(trimmed)) return null;
  return trimmed;
};

export const normalizeValue = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    return normalizeSourceText(value);
  }
  return value;
};

export const hasCjk = (value: string | null | undefined) =>
  Boolean(value && /[\u4e00-\u9fff]/.test(value));

export const computeSourceHash = (payload: Record<string, unknown>) => {
  const normalized = Object.fromEntries(
    Object.entries(payload).map(([key, val]) => [key, normalizeValue(val)])
  );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};

export const pickEnglish = (
  existing: string | null | undefined,
  translated: string | null | undefined
) => {
  if (existing && !hasCjk(existing)) return existing;
  if (translated && !hasCjk(translated)) return translated;
  return null;
};

export const isFilled = (value: string | null | undefined) =>
  Boolean(value && !hasCjk(value));

export const missingTranslatedFields = (
  fields: Array<{
    source: string | null | undefined;
    translated: string | null | undefined;
  }>
) =>
  fields.reduce((count, field) => {
    if (!field.source) return count;
    return count + (isFilled(field.translated) ? 0 : 1);
  }, 0);

export const readMessageText = (content: string | unknown) => {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map(item => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          const textValue = (item as { text?: unknown }).text;
          return typeof textValue === "string" ? textValue : "";
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  if (
    content &&
    typeof content === "object" &&
    "text" in (content as { text?: unknown })
  ) {
    const textValue = (content as { text: unknown }).text;
    if (typeof textValue === "string") {
      return textValue;
    }
  }
  return "";
};

export const sanitizeTranslatedText = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    if (TRANSLATED_EMPTY_PATTERNS.some(pattern => pattern.test(trimmed))) {
      return null;
    }
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

export const clampText = (
  value: string | null | undefined,
  maxLength: number
) => {
  if (!value) return null;
  return value.length <= maxLength ? value : value.slice(0, maxLength);
};

export const parseArgs = (args = process.argv.slice(2)) => {
  const config: Record<string, string> = {};
  for (const arg of args) {
    const [key, value] = arg.split("=");
    if (key && value) {
      config[key.replace(/^--/, "")] = value;
    }
  }
  const entities = (config.entities || "hospitals,departments,doctors")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  return {
    entities,
    batchSize: parsePositiveInt(config.batchSize, DEFAULT_BATCH_SIZE),
    concurrency: parsePositiveInt(config.concurrency, DEFAULT_CONCURRENCY),
    rateLimitMs: parsePositiveInt(config.rateLimitMs, DEFAULT_RATE_LIMIT_MS),
    maxRetries: parsePositiveInt(config.maxRetries, DEFAULT_MAX_RETRIES),
    llmBatchSize: parsePositiveInt(config.llmBatchSize, DEFAULT_LLM_BATCH_SIZE),
    cacheEnabled: parseBoolean(config.cacheEnabled, DEFAULT_CACHE_ENABLED),
    apiCallsLogInterval: parsePositiveInt(
      config.apiCallsLogInterval,
      DEFAULT_API_CALL_LOG_INTERVAL
    ),
    translationModel:
      config.model?.trim() ||
      process.env.TRANSLATION_LLM_MODEL?.trim() ||
      undefined,
  };
};

export type TranslationConfig = ReturnType<typeof parseArgs>;
