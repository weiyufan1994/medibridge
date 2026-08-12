export const DEFAULT_BATCH_SIZE = 6;
export const DEFAULT_TRANSLATION_PROVIDER = "forge/gemini-2.5-flash";
export const DEFAULT_TIMEOUT_MS = 60_000;

export const resolveTranslationModel = () =>
  process.env.TRANSLATION_LLM_MODEL?.trim() ||
  process.env.LLM_MODEL?.trim() ||
  DEFAULT_TRANSLATION_PROVIDER;

export const KNOWN_CITY_EN_BY_ZH: Record<string, string> = {
  北京: "Beijing",
  上海: "Shanghai",
  广州: "Guangzhou",
  深圳: "Shenzhen",
  天津: "Tianjin",
  重庆: "Chongqing",
  杭州: "Hangzhou",
  南京: "Nanjing",
  苏州: "Suzhou",
  无锡: "Wuxi",
  宁波: "Ningbo",
  武汉: "Wuhan",
  成都: "Chengdu",
  西安: "Xi'an",
  长沙: "Changsha",
  郑州: "Zhengzhou",
  济南: "Jinan",
  青岛: "Qingdao",
  福州: "Fuzhou",
  厦门: "Xiamen",
  哈尔滨: "Harbin",
  沈阳: "Shenyang",
  大连: "Dalian",
  昆明: "Kunming",
  南宁: "Nanning",
  合肥: "Hefei",
  南昌: "Nanchang",
  石家庄: "Shijiazhuang",
  太原: "Taiyuan",
  长春: "Changchun",
  兰州: "Lanzhou",
  贵阳: "Guiyang",
  海口: "Haikou",
  呼和浩特: "Hohhot",
  乌鲁木齐: "Urumqi",
};

export const KNOWN_SPECIALTY_NAME_EN_BY_ZH: Record<string, string> = {
  心血管病: "Cardiovascular Disease",
  呼吸科: "Respiratory Medicine",
  消化科: "Gastroenterology",
  皮肤科: "Dermatology",
  神经内科: "Neurology",
  骨科: "Orthopedics",
  妇产科: "Obstetrics and Gynecology",
  小儿内科: "Pediatric Internal Medicine",
  全科医学: "General Medicine",
  口腔科: "Stomatology",
  风湿科: "Rheumatology",
  运动医学: "Sports Medicine",
};

export function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  return process.env.DATABASE_URL;
}

export const hasCjk = (value: string | null | undefined) =>
  Boolean(value && /[\u4e00-\u9fff]/.test(value));

export const sanitizeTranslatedText = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

export const pickEnglish = (
  existing: string | null | undefined,
  translated: string | null | undefined
) => {
  if (existing && !hasCjk(existing)) return existing.trim();
  if (translated && !hasCjk(translated)) return translated.trim();
  return null;
};

export const splitToChunks = <T>(items: T[], chunkSize: number): T[][] => {
  const normalizedChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }
  return chunks;
};

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
