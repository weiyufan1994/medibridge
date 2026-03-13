import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { invokeLLM } from "../server/_core/llm";
import { departments, doctors, hospitals } from "../drizzle/schema";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_RATE_LIMIT_MS = 80;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_LLM_BATCH_SIZE = 8;
const DEFAULT_CACHE_ENABLED = true;
const DEFAULT_API_CALL_LOG_INTERVAL = 25;
const DEFAULT_TRANSLATION_PROVIDER = "forge/gemini-2.5-flash";
let translationModelOverride: string | undefined;

const getTranslationProviderName = () =>
  translationModelOverride?.trim() || DEFAULT_TRANSLATION_PROVIDER;

type HospitalRow = typeof hospitals.$inferSelect;
type DepartmentRow = typeof departments.$inferSelect;
type DoctorRow = typeof doctors.$inferSelect;

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

const createTranslationDb = (pool: mysql.Pool) => drizzle(pool);
type TranslationDb = ReturnType<typeof createTranslationDb>;

const parsePositiveInt = (value: string | number | undefined, fallback: number) => {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (["1", "true", "yes", "y", "on", "enabled"].includes(normalized))
    return true;
  if (["0", "false", "no", "n", "off", "disabled"].includes(normalized))
    return false;
  return fallback;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeSourceText = (value: string | null | undefined) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (SOURCE_EMPTY_MARKERS.has(trimmed)) return null;
  return trimmed;
};

const normalizeValue = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    return normalizeSourceText(value);
  }
  return value;
};

const hasCjk = (value: string | null | undefined) =>
  Boolean(value && /[\u4e00-\u9fff]/.test(value));

const computeSourceHash = (payload: Record<string, unknown>) => {
  const normalized = Object.fromEntries(
    Object.entries(payload).map(([key, val]) => [key, normalizeValue(val)])
  );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
};

const pickEnglish = (
  existing: string | null | undefined,
  translated: string | null | undefined
) => {
  if (existing && !hasCjk(existing)) return existing;
  if (translated && !hasCjk(translated)) return translated;
  return null;
};

const isFilled = (value: string | null | undefined) => Boolean(value && !hasCjk(value));

const missingTranslatedFields = (
  fields: Array<{ source: string | null | undefined; translated: string | null | undefined }>
) =>
  fields.reduce((count, field) => {
    if (!field.source) return count;
    return count + (isFilled(field.translated) ? 0 : 1);
  }, 0);

const readMessageText = (content: string | unknown) => {
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

const sanitizeTranslatedText = (value: unknown) => {
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

type EntityRunStats = {
  entity: "hospitals" | "departments" | "doctors";
  batches: number;
  scanned: number;
  attempted: number;
  skippedUpToDate: number;
  done: number;
  pending: number;
  failed: number;
  batchedApplied: number;
  fallbackCalls: number;
  cacheHits: number;
  llmCalls: number;
  rowsPerCallTotal: number;
  parseFailures: number;
  apiCallsLogInterval: number;
  errorCounts: Map<string, number>;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
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
      config.model?.trim() || process.env.TRANSLATION_LLM_MODEL?.trim() || undefined,
  };
};

const reconcileInconsistentDoneRows = async (
  pool: mysql.Pool,
  entities: string[]
) => {
  const updates: Array<{ entity: string; affectedRows: number }> = [];

  if (entities.includes("hospitals")) {
    const [result] = await pool.query(
      `
      UPDATE hospitals
      SET translationStatus = 'pending', translatedAt = NULL, lastTranslationError = 'Requeued: incomplete English fields'
      WHERE translationStatus = 'done'
        AND (
          (name IS NOT NULL AND TRIM(name) <> '' AND (nameEn IS NULL OR TRIM(nameEn) = '' OR nameEn REGEXP '[一-龥]'))
          OR (city IS NOT NULL AND TRIM(city) <> '' AND (cityEn IS NULL OR TRIM(cityEn) = '' OR cityEn REGEXP '[一-龥]'))
          OR (level IS NOT NULL AND TRIM(level) <> '' AND (levelEn IS NULL OR TRIM(levelEn) = '' OR levelEn REGEXP '[一-龥]'))
          OR (address IS NOT NULL AND TRIM(address) <> '' AND (addressEn IS NULL OR TRIM(addressEn) = '' OR addressEn REGEXP '[一-龥]'))
          OR (description IS NOT NULL AND TRIM(description) <> '' AND (descriptionEn IS NULL OR TRIM(descriptionEn) = '' OR descriptionEn REGEXP '[一-龥]'))
        )
      `
    );
    updates.push({
      entity: "hospitals",
      affectedRows: Number((result as mysql.ResultSetHeader).affectedRows ?? 0),
    });
  }

  if (entities.includes("departments")) {
    const [result] = await pool.query(
      `
      UPDATE departments
      SET translationStatus = 'pending', translatedAt = NULL, lastTranslationError = 'Requeued: incomplete English fields'
      WHERE translationStatus = 'done'
        AND (
          (name IS NOT NULL AND TRIM(name) <> '' AND (nameEn IS NULL OR TRIM(nameEn) = '' OR nameEn REGEXP '[一-龥]'))
          OR (description IS NOT NULL AND TRIM(description) <> '' AND (descriptionEn IS NULL OR TRIM(descriptionEn) = '' OR descriptionEn REGEXP '[一-龥]'))
        )
      `
    );
    updates.push({
      entity: "departments",
      affectedRows: Number((result as mysql.ResultSetHeader).affectedRows ?? 0),
    });
  }

  if (entities.includes("doctors")) {
    updates.push({
      entity: "doctors",
      affectedRows: 0,
    });
  }

  for (const update of updates) {
    console.log(
      `[Precheck] ${update.entity}: requeued ${update.affectedRows} inconsistent done rows`
    );
  }
};

const createEntityRunStats = (
  entity: EntityRunStats["entity"],
  config: ReturnType<typeof parseArgs>
): EntityRunStats => ({
  entity,
  batches: 0,
  scanned: 0,
  attempted: 0,
  skippedUpToDate: 0,
  done: 0,
  pending: 0,
  failed: 0,
  batchedApplied: 0,
  fallbackCalls: 0,
  cacheHits: 0,
  llmCalls: 0,
  rowsPerCallTotal: 0,
  parseFailures: 0,
  apiCallsLogInterval: config.apiCallsLogInterval,
  errorCounts: new Map<string, number>(),
});

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const recordFailure = (stats: EntityRunStats, error: unknown) => {
  stats.failed += 1;
  const message = getErrorMessage(error).trim().slice(0, 280) || "Unknown error";
  stats.errorCounts.set(message, (stats.errorCounts.get(message) ?? 0) + 1);
};

const logApiCall = (stats: EntityRunStats) => {
  if (stats.apiCallsLogInterval > 0 && stats.llmCalls % stats.apiCallsLogInterval === 0) {
    const avgRowsPerCall =
      stats.llmCalls === 0
        ? 0
        : Number((stats.rowsPerCallTotal / stats.llmCalls).toFixed(2));
    console.log(
      `[${stats.entity}] API calls=${stats.llmCalls}, avgRowsPerCall=${avgRowsPerCall}, batchedApplied=${stats.batchedApplied}, fallbackCalls=${stats.fallbackCalls}, cacheHits=${stats.cacheHits}, parseFailures=${stats.parseFailures}`
    );
  }
};

const printEntitySummary = (stats: EntityRunStats) => {
  const avgRowsPerCall =
    stats.llmCalls === 0
      ? 0
      : Number((stats.rowsPerCallTotal / stats.llmCalls).toFixed(2));
  console.log(
    `\n[Summary:${stats.entity}] batches=${stats.batches}, scanned=${stats.scanned}, attempted=${stats.attempted}, done=${stats.done}, pending=${stats.pending}, failed=${stats.failed}, skippedUpToDate=${stats.skippedUpToDate}, llmCalls=${stats.llmCalls}, avgRowsPerCall=${avgRowsPerCall}, batchedApplied=${stats.batchedApplied}, fallbackCalls=${stats.fallbackCalls}, cacheHits=${stats.cacheHits}, parseFailures=${stats.parseFailures}`
  );

  if (stats.errorCounts.size > 0) {
    const topErrors = Array.from(stats.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    console.log(`[Summary:${stats.entity}] Top failure reasons:`);
    for (const [message, count] of topErrors) {
      console.log(`  - x${count}: ${message}`);
    }
  }
};

const printRunSummary = (statsList: EntityRunStats[]) => {
  console.log("\n========== Translation Run Summary ==========");
  for (const stats of statsList) {
    const avgRowsPerCall =
      stats.llmCalls === 0
        ? 0
        : Number((stats.rowsPerCallTotal / stats.llmCalls).toFixed(2));
    console.log(
      `- ${stats.entity}: done=${stats.done}, pending=${stats.pending}, failed=${stats.failed}, attempted=${stats.attempted}, scanned=${stats.scanned}, llmCalls=${stats.llmCalls}, avgRowsPerCall=${avgRowsPerCall}, batchedApplied=${stats.batchedApplied}, fallbackCalls=${stats.fallbackCalls}, parseFailures=${stats.parseFailures}`
    );
  }

  const totals = statsList.reduce(
    (acc, stats) => {
      acc.done += stats.done;
      acc.pending += stats.pending;
      acc.failed += stats.failed;
      acc.attempted += stats.attempted;
      acc.scanned += stats.scanned;
      acc.llmCalls += stats.llmCalls;
      acc.rowsPerCallTotal += stats.rowsPerCallTotal;
      acc.batchedApplied += stats.batchedApplied;
      acc.fallbackCalls += stats.fallbackCalls;
      acc.parseFailures += stats.parseFailures;
      return acc;
    },
    {
      done: 0,
      pending: 0,
      failed: 0,
      attempted: 0,
      scanned: 0,
      llmCalls: 0,
      rowsPerCallTotal: 0,
      batchedApplied: 0,
      fallbackCalls: 0,
      parseFailures: 0,
    }
  );
  const avgRowsPerCall =
    totals.llmCalls === 0
      ? 0
      : Number((totals.rowsPerCallTotal / totals.llmCalls).toFixed(2));
  console.log(
    `Total: done=${totals.done}, pending=${totals.pending}, failed=${totals.failed}, attempted=${totals.attempted}, scanned=${totals.scanned}, llmCalls=${totals.llmCalls}, avgRowsPerCall=${avgRowsPerCall}, batchedApplied=${totals.batchedApplied}, fallbackCalls=${totals.fallbackCalls}, parseFailures=${totals.parseFailures}`
  );
};

const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number,
  onAttempt?: () => void
) => {
  let attempt = 0;
  let delayMs = 500;
  while (true) {
    onAttempt?.();
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
      await delay(delayMs);
      delayMs *= 2;
      attempt += 1;
    }
  }
};

const translateHospital = async (input: {
  name: string;
  city: string | null;
  level: string | null;
  address: string | null;
  description: string | null;
}) => {
  const response = await invokeLLM({
    model: translationModelOverride,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese hospital information into patient-friendly English. Do not add facts or medical advice. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following hospital fields. Return empty string for missing values.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "hospital_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            nameEn: { type: ["string", "null"] },
            cityEn: { type: ["string", "null"] },
            levelEn: { type: ["string", "null"] },
            addressEn: { type: ["string", "null"] },
            descriptionEn: { type: ["string", "null"] },
          },
          required: [
            "nameEn",
            "cityEn",
            "levelEn",
            "addressEn",
            "descriptionEn",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(readMessageText(response.choices[0].message.content));
  return parsed as {
    nameEn: string | null;
    cityEn: string | null;
    levelEn: string | null;
    addressEn: string | null;
    descriptionEn: string | null;
  };
};

const hospitalTranslationIsComplete = (
  row: Pick<HospitalRow, "city" | "level" | "address" | "description">,
  translated: Pick<
    HospitalBatchTranslation,
    "nameEn" | "cityEn" | "levelEn" | "addressEn" | "descriptionEn"
  >
) =>
  isFilled(translated.nameEn) &&
  (!row.city || isFilled(translated.cityEn)) &&
  (!row.level || isFilled(translated.levelEn)) &&
  (!row.address || isFilled(translated.addressEn)) &&
  (!row.description || isFilled(translated.descriptionEn));

type HospitalBatchInput = {
  id: number;
  sourceHash: string;
  name: string;
  city: string | null;
  level: string | null;
  address: string | null;
  description: string | null;
};

type HospitalBatchTranslation = {
  id: number;
  sourceHash: string;
  nameEn: string | null;
  cityEn: string | null;
  levelEn: string | null;
  addressEn: string | null;
  descriptionEn: string | null;
};

const parseHospitalBatchResponse = (text: string) => {
  const parsed = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new Error("[Hospitals] Invalid batch response format");
  }

  const items = (parsed as { items: unknown[] }).items;
  const results = new Map<string, HospitalBatchTranslation>();
  let invalidEntries = 0;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      invalidEntries += 1;
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const sourceHash = typeof item.sourceHash === "string" ? item.sourceHash.trim() : "";
    const id = typeof item.id === "number" ? item.id : Number.parseInt(String(item.id), 10);
    if (!sourceHash || !Number.isFinite(id) || id <= 0) {
      invalidEntries += 1;
      continue;
    }

    results.set(sourceHash, {
      id,
      sourceHash,
      nameEn: sanitizeTranslatedText(item.nameEn),
      cityEn: sanitizeTranslatedText(item.cityEn),
      levelEn: sanitizeTranslatedText(item.levelEn),
      addressEn: sanitizeTranslatedText(item.addressEn),
      descriptionEn: sanitizeTranslatedText(item.descriptionEn),
    });
  }

  return { items: results, invalidEntries };
};

const translateHospitalBatch = async (input: HospitalBatchInput[]) => {
  const response = await invokeLLM({
    model: translationModelOverride,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese hospital information into patient-friendly English. Do not add facts or medical advice. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following hospital list. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "hospital_batch_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  sourceHash: { type: "string" },
                  nameEn: { type: ["string", "null"] },
                  cityEn: { type: ["string", "null"] },
                  levelEn: { type: ["string", "null"] },
                  addressEn: { type: ["string", "null"] },
                  descriptionEn: { type: ["string", "null"] },
                },
                required: [
                  "id",
                  "sourceHash",
                  "nameEn",
                  "cityEn",
                  "levelEn",
                  "addressEn",
                  "descriptionEn",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 4096,
  });

  return parseHospitalBatchResponse(readMessageText(response.choices[0].message.content));
};

const translateDepartment = async (input: {
  name: string;
  description: string | null;
}) => {
  const response = await invokeLLM({
    model: translationModelOverride,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese department names and descriptions into patient-friendly English. Use the style 'Department of ...' for names. Do not add facts or medical advice. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following department fields. Return empty string for missing values.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "department_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            nameEn: { type: ["string", "null"] },
            descriptionEn: { type: ["string", "null"] },
          },
          required: ["nameEn", "descriptionEn"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(readMessageText(response.choices[0].message.content));
  return parsed as {
    nameEn: string | null;
    descriptionEn: string | null;
  };
};

const departmentTranslationIsComplete = (
  row: Pick<DepartmentRow, "description">,
  translated: Pick<DepartmentBatchTranslation, "nameEn" | "descriptionEn">
) => isFilled(translated.nameEn) && (!row.description || isFilled(translated.descriptionEn));

type DepartmentBatchInput = {
  id: number;
  sourceHash: string;
  name: string;
  description: string | null;
};

type DepartmentBatchTranslation = {
  id: number;
  sourceHash: string;
  nameEn: string | null;
  descriptionEn: string | null;
};

const parseDepartmentBatchResponse = (text: string) => {
  const parsed = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new Error("[Departments] Invalid batch response format");
  }

  const items = (parsed as { items: unknown[] }).items;
  const results = new Map<string, DepartmentBatchTranslation>();
  let invalidEntries = 0;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      invalidEntries += 1;
      continue;
    }
    const item = rawItem as Record<string, unknown>;
    const sourceHash = typeof item.sourceHash === "string" ? item.sourceHash.trim() : "";
    const id = typeof item.id === "number" ? item.id : Number.parseInt(String(item.id), 10);
    if (!sourceHash || !Number.isFinite(id) || id <= 0) {
      invalidEntries += 1;
      continue;
    }

    results.set(sourceHash, {
      id,
      sourceHash,
      nameEn: sanitizeTranslatedText(item.nameEn),
      descriptionEn: sanitizeTranslatedText(item.descriptionEn),
    });
  }

  return { items: results, invalidEntries };
};

const translateDepartmentBatch = async (input: DepartmentBatchInput[]) => {
  const response = await invokeLLM({
    model: translationModelOverride,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese department names and descriptions into patient-friendly English. Use the style 'Department of ...' for names. Do not add facts or medical advice. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following department list. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "department_batch_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  sourceHash: { type: "string" },
                  nameEn: { type: ["string", "null"] },
                  descriptionEn: { type: ["string", "null"] },
                },
                required: ["id", "sourceHash", "nameEn", "descriptionEn"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 2048,
  });

  return parseDepartmentBatchResponse(readMessageText(response.choices[0].message.content));
};

const translateDoctor = async (
  input: DoctorPartialInput,
  requestedFields: DoctorTranslatedField[] = doctorTranslationKeys
) => {
  const schemaProperties = Object.fromEntries(
    requestedFields.map(field => [field, { type: ["string", "null"] }])
  );
  const response = await invokeLLM({
    model: translationModelOverride,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese doctor information into patient-friendly English. Do not add facts or medical advice. Doctor names must not be translated into Western names; use pinyin or 'Dr. + pinyin'. Only return the requested English fields in JSON.",
      },
      {
        role: "user",
        content: `Translate the following doctor fields. Return only these English keys: ${requestedFields.join(
          ", "
        )}. Return empty string for missing values.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "doctor_translation",
        strict: true,
        schema: {
          type: "object",
          properties: schemaProperties,
          required: requestedFields,
          additionalProperties: false,
        },
      },
    },
  });

  return parseDoctorPartialResponse(
    readMessageText(response.choices[0].message.content),
    requestedFields
  );
};

const doctorTranslationIsComplete = (
  source: Omit<DoctorSourceText, "sourceName">,
  translated: Pick<
    DoctorBatchTranslation,
    | "nameEn"
    | "titleEn"
    | "specialtyEn"
    | "expertiseEn"
    | "onlineConsultationEn"
    | "appointmentAvailableEn"
    | "satisfactionRateEn"
    | "attitudeScoreEn"
  >
) =>
  isFilled(translated.nameEn) &&
  (!source.sourceTitle || isFilled(translated.titleEn)) &&
  (!source.sourceSpecialty || isFilled(translated.specialtyEn)) &&
  (!source.sourceExpertise || isFilled(translated.expertiseEn)) &&
  (!source.sourceOnlineConsultation || isFilled(translated.onlineConsultationEn)) &&
  (!source.sourceAppointmentAvailable || isFilled(translated.appointmentAvailableEn)) &&
  (!source.sourceSatisfactionRate || isFilled(translated.satisfactionRateEn)) &&
  (!source.sourceAttitudeScore || isFilled(translated.attitudeScoreEn));

type DoctorBatchInput = {
  id: number;
  sourceHash: string;
  name: string;
  title: string | null;
  specialty: string | null;
  expertise: string | null;
  onlineConsultation: string | null;
  appointmentAvailable: string | null;
  satisfactionRate: string | null;
  attitudeScore: string | null;
};

type DoctorBatchTranslation = {
  id: number;
  sourceHash: string;
  nameEn: string | null;
  titleEn: string | null;
  specialtyEn: string | null;
  expertiseEn: string | null;
  onlineConsultationEn: string | null;
  appointmentAvailableEn: string | null;
  satisfactionRateEn: string | null;
  attitudeScoreEn: string | null;
};

const parseDoctorBatchResponse = (text: string) => {
  const parsed = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new Error("[Doctors] Invalid batch response format");
  }

  const items = (parsed as { items: unknown[] }).items;
  const results = new Map<string, DoctorBatchTranslation>();
  let invalidEntries = 0;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      invalidEntries += 1;
      continue;
    }
    const item = rawItem as Record<string, unknown>;
    const sourceHash = typeof item.sourceHash === "string" ? item.sourceHash.trim() : "";
    const id = typeof item.id === "number" ? item.id : Number.parseInt(String(item.id), 10);
    if (!sourceHash || !Number.isFinite(id) || id <= 0) {
      invalidEntries += 1;
      continue;
    }

    results.set(sourceHash, {
      id,
      sourceHash,
      nameEn: sanitizeTranslatedText(item.nameEn),
      titleEn: sanitizeTranslatedText(item.titleEn),
      specialtyEn: sanitizeTranslatedText(item.specialtyEn),
      expertiseEn: sanitizeTranslatedText(item.expertiseEn),
      onlineConsultationEn: sanitizeTranslatedText(item.onlineConsultationEn),
      appointmentAvailableEn: sanitizeTranslatedText(item.appointmentAvailableEn),
      satisfactionRateEn: sanitizeTranslatedText(item.satisfactionRateEn),
      attitudeScoreEn: sanitizeTranslatedText(item.attitudeScoreEn),
    });
  }

  return { items: results, invalidEntries };
};

const translateDoctorBatch = async (input: DoctorBatchInput[]) => {
  const response = await invokeLLM({
    model: translationModelOverride,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese doctor information into patient-friendly English. Do not add facts or medical advice. Doctor names must not be translated into Western names; use pinyin or 'Dr. + pinyin'. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following doctor list. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "doctor_batch_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  sourceHash: { type: "string" },
                  nameEn: { type: ["string", "null"] },
                  titleEn: { type: ["string", "null"] },
                  specialtyEn: { type: ["string", "null"] },
                  expertiseEn: { type: ["string", "null"] },
                  onlineConsultationEn: { type: ["string", "null"] },
                  appointmentAvailableEn: { type: ["string", "null"] },
                  satisfactionRateEn: { type: ["string", "null"] },
                  attitudeScoreEn: { type: ["string", "null"] },
                },
                required: [
                  "id",
                  "sourceHash",
                  "nameEn",
                  "titleEn",
                  "specialtyEn",
                  "expertiseEn",
                  "onlineConsultationEn",
                  "appointmentAvailableEn",
                  "satisfactionRateEn",
                  "attitudeScoreEn",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 4096,
  });

  return parseDoctorBatchResponse(readMessageText(response.choices[0].message.content));
};

const createWorkerPool = async <T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) => {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await handler(current);
    }
  });
  await Promise.all(workers);
};

const splitToChunks = <T>(items: T[], chunkSize: number): T[][] => {
  const normalizedChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += normalizedChunkSize) {
    chunks.push(items.slice(i, i + normalizedChunkSize));
  }
  return chunks;
};

const markHospitalFailed = async (db: TranslationDb, id: number, error: unknown) => {
  await db
    .update(hospitals)
    .set({
      translationStatus: "failed",
      lastTranslationError: getErrorMessage(error),
    })
    .where(eq(hospitals.id, id));
};

const markDepartmentFailed = async (db: TranslationDb, id: number, error: unknown) => {
  await db
    .update(departments)
    .set({
      translationStatus: "failed",
      lastTranslationError: getErrorMessage(error),
    })
    .where(eq(departments.id, id));
};

const markDoctorFailed = async (db: TranslationDb, id: number, error: unknown) => {
  await db
    .update(doctors)
    .set({
      translationStatus: "failed",
      lastTranslationError: getErrorMessage(error),
    })
    .where(eq(doctors.id, id));
};

const applyHospitalTranslation = async (
  db: TranslationDb,
  row: HospitalRow,
  translated: HospitalBatchTranslation,
  stats: EntityRunStats
) => {
  const nameEn = pickEnglish(row.nameEn, translated.nameEn);
  const cityEn = pickEnglish(row.cityEn, translated.cityEn);
  const levelEn = pickEnglish(row.levelEn, translated.levelEn);
  const addressEn = pickEnglish(row.addressEn, translated.addressEn);
  const descriptionEn = pickEnglish(row.descriptionEn, translated.descriptionEn);
  const isComplete = hospitalTranslationIsComplete(row, {
    nameEn,
    cityEn,
    levelEn,
    addressEn,
    descriptionEn,
  });

  await db
    .update(hospitals)
    .set({
      nameEn,
      cityEn,
      levelEn,
      addressEn,
      descriptionEn,
      translationStatus: isComplete ? "done" : "pending",
      translatedAt: isComplete ? new Date() : null,
      lastTranslationError: isComplete ? null : "Missing English fields",
      translationProvider: getTranslationProviderName(),
    })
    .where(eq(hospitals.id, row.id));

  if (isComplete) {
    stats.done += 1;
  } else {
    stats.pending += 1;
  }
};

const applyDepartmentTranslation = async (
  db: TranslationDb,
  row: DepartmentRow,
  translated: DepartmentBatchTranslation,
  stats: EntityRunStats
) => {
  const nameEn = pickEnglish(row.nameEn, translated.nameEn);
  const descriptionEn = pickEnglish(row.descriptionEn, translated.descriptionEn);
  const isComplete = departmentTranslationIsComplete(row, {
    nameEn,
    descriptionEn,
  });

  await db
    .update(departments)
    .set({
      nameEn,
      descriptionEn,
      translationStatus: isComplete ? "done" : "pending",
      translatedAt: isComplete ? new Date() : null,
      lastTranslationError: isComplete ? null : "Missing English fields",
      translationProvider: getTranslationProviderName(),
    })
    .where(eq(departments.id, row.id));

  if (isComplete) {
    stats.done += 1;
  } else {
    stats.pending += 1;
  }
};

type DoctorSourceText = {
  sourceName: string | null;
  sourceTitle: string | null;
  sourceSpecialty: string | null;
  sourceExpertise: string | null;
  sourceOnlineConsultation: string | null;
  sourceAppointmentAvailable: string | null;
  sourceSatisfactionRate: string | null;
  sourceAttitudeScore: string | null;
};

type DoctorTranslatedField =
  | "nameEn"
  | "titleEn"
  | "specialtyEn"
  | "expertiseEn"
  | "onlineConsultationEn"
  | "appointmentAvailableEn"
  | "satisfactionRateEn"
  | "attitudeScoreEn";

type DoctorTranslationSnapshot = Pick<
  DoctorBatchTranslation,
  DoctorTranslatedField
>;

type DoctorPartialInput = Partial<{
  name: string | null;
  title: string | null;
  specialty: string | null;
  expertise: string | null;
  onlineConsultation: string | null;
  appointmentAvailable: string | null;
  satisfactionRate: string | null;
  attitudeScore: string | null;
}>;

const DOCTOR_TRANSLATION_FIELDS: Array<{
  sourceKey: keyof DoctorSourceText;
  inputKey: keyof DoctorPartialInput;
  translatedKey: DoctorTranslatedField;
}> = [
  { sourceKey: "sourceName", inputKey: "name", translatedKey: "nameEn" },
  { sourceKey: "sourceTitle", inputKey: "title", translatedKey: "titleEn" },
  {
    sourceKey: "sourceSpecialty",
    inputKey: "specialty",
    translatedKey: "specialtyEn",
  },
  { sourceKey: "sourceExpertise", inputKey: "expertise", translatedKey: "expertiseEn" },
  {
    sourceKey: "sourceOnlineConsultation",
    inputKey: "onlineConsultation",
    translatedKey: "onlineConsultationEn",
  },
  {
    sourceKey: "sourceAppointmentAvailable",
    inputKey: "appointmentAvailable",
    translatedKey: "appointmentAvailableEn",
  },
  {
    sourceKey: "sourceSatisfactionRate",
    inputKey: "satisfactionRate",
    translatedKey: "satisfactionRateEn",
  },
  {
    sourceKey: "sourceAttitudeScore",
    inputKey: "attitudeScore",
    translatedKey: "attitudeScoreEn",
  },
];

const doctorTranslationKeys = DOCTOR_TRANSLATION_FIELDS.map(field => field.translatedKey);

const emptyDoctorTranslationSnapshot = (): DoctorTranslationSnapshot => ({
  nameEn: null,
  titleEn: null,
  specialtyEn: null,
  expertiseEn: null,
  onlineConsultationEn: null,
  appointmentAvailableEn: null,
  satisfactionRateEn: null,
  attitudeScoreEn: null,
});

const getMissingDoctorFields = (
  source: DoctorSourceText,
  translated: DoctorTranslationSnapshot
) =>
  DOCTOR_TRANSLATION_FIELDS.filter(field => {
    const sourceValue = source[field.sourceKey];
    if (!sourceValue) return false;
    return !isFilled(translated[field.translatedKey]);
  }).map(field => field.translatedKey);

const buildDoctorPartialInput = (
  source: DoctorSourceText,
  fields: DoctorTranslatedField[]
): DoctorPartialInput => {
  const input: DoctorPartialInput = {};
  for (const field of DOCTOR_TRANSLATION_FIELDS) {
    if (!fields.includes(field.translatedKey)) continue;
    input[field.inputKey] = source[field.sourceKey];
  }
  return input;
};

const parseDoctorPartialResponse = (
  text: string,
  fields: DoctorTranslatedField[]
): Partial<DoctorTranslationSnapshot> => {
  const parsed = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("[Doctors] Invalid partial response format");
  }

  const record = parsed as Record<string, unknown>;
  const result: Partial<DoctorTranslationSnapshot> = {};
  for (const field of fields) {
    result[field] = sanitizeTranslatedText(record[field]);
  }
  return result;
};

const applyDoctorTranslation = async (
  db: TranslationDb,
  row: DoctorRow,
  translated: DoctorBatchTranslation,
  source: DoctorSourceText,
  stats: EntityRunStats
) => {
  const nameEn = pickEnglish(row.nameEn, translated.nameEn);
  const titleEn = pickEnglish(row.titleEn, translated.titleEn);
  const specialtyEn = pickEnglish(row.specialtyEn, translated.specialtyEn);
  const expertiseEn = pickEnglish(row.expertiseEn, translated.expertiseEn);
  const onlineConsultationEn = pickEnglish(
    row.onlineConsultationEn,
    translated.onlineConsultationEn
  );
  const appointmentAvailableEn = pickEnglish(
    row.appointmentAvailableEn,
    translated.appointmentAvailableEn
  );
  const satisfactionRateEn = pickEnglish(
    row.satisfactionRateEn,
    translated.satisfactionRateEn
  );
  const attitudeScoreEn = pickEnglish(row.attitudeScoreEn, translated.attitudeScoreEn);
  const snapshot = {
    nameEn,
    titleEn,
    specialtyEn,
    expertiseEn,
    onlineConsultationEn,
    appointmentAvailableEn,
    satisfactionRateEn,
    attitudeScoreEn,
  };
  const isComplete = doctorTranslationIsComplete(source, snapshot);
  const missingFields = getMissingDoctorFields(source, snapshot);

  await db
    .update(doctors)
    .set({
      nameEn,
      titleEn,
      specialtyEn,
      expertiseEn,
      onlineConsultationEn,
      appointmentAvailableEn,
      satisfactionRateEn,
      attitudeScoreEn,
      translationStatus: isComplete ? "done" : "pending",
      translatedAt: isComplete ? new Date() : null,
      lastTranslationError: isComplete
        ? null
        : `Missing English fields: ${missingFields.join(", ")}`,
      translationProvider: getTranslationProviderName(),
    })
    .where(eq(doctors.id, row.id));

  if (isComplete) {
    stats.done += 1;
  } else {
    stats.pending += 1;
  }
};

const completeHospitalTranslation = async (
  row: HospitalRow,
  translated: HospitalBatchTranslation,
  config: ReturnType<typeof parseArgs>,
  stats: EntityRunStats
) => {
  const current = {
    nameEn: pickEnglish(row.nameEn, translated.nameEn),
    cityEn: pickEnglish(row.cityEn, translated.cityEn),
    levelEn: pickEnglish(row.levelEn, translated.levelEn),
    addressEn: pickEnglish(row.addressEn, translated.addressEn),
    descriptionEn: pickEnglish(row.descriptionEn, translated.descriptionEn),
  };

  if (hospitalTranslationIsComplete(row, current)) {
    return current;
  }

  const fallback = await withRetry(
    () =>
      translateHospital({
        name: row.name,
        city: row.city,
        level: row.level,
        address: row.address,
        description: row.description,
      }),
    config.maxRetries,
    () => {
      stats.fallbackCalls += 1;
      stats.llmCalls += 1;
      stats.rowsPerCallTotal += 1;
    }
  );

  return {
    nameEn: pickEnglish(current.nameEn, fallback.nameEn),
    cityEn: pickEnglish(current.cityEn, fallback.cityEn),
    levelEn: pickEnglish(current.levelEn, fallback.levelEn),
    addressEn: pickEnglish(current.addressEn, fallback.addressEn),
    descriptionEn: pickEnglish(current.descriptionEn, fallback.descriptionEn),
  };
};

const completeDepartmentTranslation = async (
  row: DepartmentRow,
  translated: DepartmentBatchTranslation,
  config: ReturnType<typeof parseArgs>,
  stats: EntityRunStats
) => {
  const current = {
    nameEn: pickEnglish(row.nameEn, translated.nameEn),
    descriptionEn: pickEnglish(row.descriptionEn, translated.descriptionEn),
  };

  if (departmentTranslationIsComplete(row, current)) {
    return current;
  }

  const fallback = await withRetry(
    () =>
      translateDepartment({
        name: row.name,
        description: row.description,
      }),
    config.maxRetries,
    () => {
      stats.fallbackCalls += 1;
      stats.llmCalls += 1;
      stats.rowsPerCallTotal += 1;
    }
  );

  return {
    nameEn: pickEnglish(current.nameEn, fallback.nameEn),
    descriptionEn: pickEnglish(current.descriptionEn, fallback.descriptionEn),
  };
};

const completeDoctorTranslation = async (
  row: DoctorRow,
  source: DoctorSourceText,
  translated: DoctorBatchTranslation,
  config: ReturnType<typeof parseArgs>,
  stats: EntityRunStats
) => {
  const current: DoctorTranslationSnapshot = {
    nameEn: pickEnglish(row.nameEn, translated.nameEn),
    titleEn: pickEnglish(row.titleEn, translated.titleEn),
    specialtyEn: pickEnglish(row.specialtyEn, translated.specialtyEn),
    expertiseEn: pickEnglish(row.expertiseEn, translated.expertiseEn),
    onlineConsultationEn: pickEnglish(
      row.onlineConsultationEn,
      translated.onlineConsultationEn
    ),
    appointmentAvailableEn: pickEnglish(
      row.appointmentAvailableEn,
      translated.appointmentAvailableEn
    ),
    satisfactionRateEn: pickEnglish(row.satisfactionRateEn, translated.satisfactionRateEn),
    attitudeScoreEn: pickEnglish(row.attitudeScoreEn, translated.attitudeScoreEn),
  };

  const missingFields = getMissingDoctorFields(source, current);
  if (missingFields.length === 0) {
    return current;
  }

  let merged = { ...current };
  for (const field of missingFields) {
    const partialInput = buildDoctorPartialInput(source, [field]);
    const partial = await withRetry(
      () => translateDoctor(partialInput, [field]),
      config.maxRetries,
      () => {
        stats.fallbackCalls += 1;
        stats.llmCalls += 1;
        stats.rowsPerCallTotal += 1;
      }
    );
    merged = {
      ...merged,
      [field]: pickEnglish(merged[field], partial[field] ?? null),
    };
    await delay(config.rateLimitMs);
  }

  const remainingFields = getMissingDoctorFields(source, merged);
  if (remainingFields.length > 0) {
    throw new Error(`Incomplete doctor translation after field retries: ${remainingFields.join(", ")}`);
  }

  return merged;
};

const doctorNeedsTranslationCondition = sql`
  (
    ${doctors.translationStatus} IN ('pending', 'failed')
    OR ${doctors.translationStatus} IS NULL
    OR (
      ${doctors.translationStatus} = 'done'
      AND (
        (${doctors.name} IS NOT NULL AND TRIM(${doctors.name}) <> '' AND (${doctors.nameEn} IS NULL OR TRIM(${doctors.nameEn}) = '' OR ${doctors.nameEn} REGEXP '[一-龥]'))
        OR (${doctors.title} IS NOT NULL AND TRIM(${doctors.title}) <> '' AND (${doctors.titleEn} IS NULL OR TRIM(${doctors.titleEn}) = '' OR ${doctors.titleEn} REGEXP '[一-龥]'))
        OR (${doctors.specialty} IS NOT NULL AND TRIM(${doctors.specialty}) <> '' AND (${doctors.specialtyEn} IS NULL OR TRIM(${doctors.specialtyEn}) = '' OR ${doctors.specialtyEn} REGEXP '[一-龥]'))
        OR (${doctors.expertise} IS NOT NULL AND TRIM(${doctors.expertise}) <> '' AND (${doctors.expertiseEn} IS NULL OR TRIM(${doctors.expertiseEn}) = '' OR ${doctors.expertiseEn} REGEXP '[一-龥]'))
        OR (${doctors.onlineConsultation} IS NOT NULL AND TRIM(${doctors.onlineConsultation}) <> '' AND (${doctors.onlineConsultationEn} IS NULL OR TRIM(${doctors.onlineConsultationEn}) = '' OR ${doctors.onlineConsultationEn} REGEXP '[一-龥]'))
        OR (${doctors.appointmentAvailable} IS NOT NULL AND TRIM(${doctors.appointmentAvailable}) <> '' AND (${doctors.appointmentAvailableEn} IS NULL OR TRIM(${doctors.appointmentAvailableEn}) = '' OR ${doctors.appointmentAvailableEn} REGEXP '[一-龥]'))
        OR (${doctors.satisfactionRate} IS NOT NULL AND TRIM(${doctors.satisfactionRate}) <> '' AND (${doctors.satisfactionRateEn} IS NULL OR TRIM(${doctors.satisfactionRateEn}) = '' OR ${doctors.satisfactionRateEn} REGEXP '[一-龥]'))
        OR (${doctors.attitudeScore} IS NOT NULL AND TRIM(${doctors.attitudeScore}) <> '' AND (${doctors.attitudeScoreEn} IS NULL OR TRIM(${doctors.attitudeScoreEn}) = '' OR ${doctors.attitudeScoreEn} REGEXP '[一-龥]'))
      )
    )
  )
`;

const translateHospitals = async (
  db: TranslationDb,
  config: ReturnType<typeof parseArgs>
): Promise<EntityRunStats> => {
  console.log("\n[Translate] Hospitals");
  const stats = createEntityRunStats("hospitals", config);
  const cache = new Map<string, HospitalBatchTranslation>();
  let cursor = 0;

  while (true) {
    const rows = await db
      .select()
      .from(hospitals)
      .where(
        and(
          gt(hospitals.id, cursor),
          or(
            eq(hospitals.translationStatus, "pending"),
            eq(hospitals.translationStatus, "failed"),
            isNull(hospitals.translationStatus)
          )
        )
      )
      .orderBy(asc(hospitals.id))
      .limit(config.batchSize);

    if (rows.length === 0) {
      console.log("No pending hospitals.");
      break;
    }

    stats.batches += 1;
    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;
    console.log(
      `[Hospitals] processing batch size=${rows.length}, scanned=${stats.scanned}, cursor=${cursor}`
    );

    const llmChunks = splitToChunks(rows, config.llmBatchSize);
    await createWorkerPool(llmChunks, config.concurrency, async chunkRows => {
      const uniqueByHash = new Map<string, HospitalBatchInput>();
      const rowsByHash = new Map<string, HospitalRow[]>();
      for (const row of chunkRows) {
        const sourceHash = computeSourceHash({
          name: row.name,
          city: row.city,
          level: row.level,
          address: row.address,
          description: row.description,
        });

        const isDone = row.translationStatus === "done" && row.sourceHash === sourceHash;
        if (isDone) {
          stats.skippedUpToDate += 1;
          continue;
        }

        stats.attempted += 1;

        if (row.sourceHash !== sourceHash) {
          await db
            .update(hospitals)
            .set({
              sourceHash,
              translationStatus: "pending",
              translatedAt: null,
              lastTranslationError: null,
            })
            .where(eq(hospitals.id, row.id));
        }

        const cached = config.cacheEnabled ? cache.get(sourceHash) : undefined;
        if (cached) {
          await applyHospitalTranslation(db, row, cached, stats);
          stats.batchedApplied += 1;
          stats.cacheHits += 1;
          continue;
        }

        if (!uniqueByHash.has(sourceHash)) {
          uniqueByHash.set(sourceHash, {
            id: row.id,
            sourceHash,
            name: row.name,
            city: row.city,
            level: row.level,
            address: row.address,
            description: row.description,
          });
        }
        const group = rowsByHash.get(sourceHash) ?? [];
        group.push(row);
        rowsByHash.set(sourceHash, group);
      }

      if (uniqueByHash.size === 0) {
        return;
      }

      const toTranslate = Array.from(uniqueByHash.values());
      try {
        const { items, invalidEntries } = await withRetry(
          () => translateHospitalBatch(toTranslate),
          config.maxRetries,
          () => {
            stats.llmCalls += 1;
            stats.rowsPerCallTotal += toTranslate.length;
          }
        );
        if (invalidEntries > 0) {
          stats.parseFailures += invalidEntries;
        }

        for (const [sourceHash, group] of rowsByHash.entries()) {
          const translated = items.get(sourceHash);
          if (!translated) {
            for (const row of group) {
              stats.parseFailures += 1;
              try {
                const fallback = await withRetry(
                  () =>
                    translateHospital({
                      name: row.name,
                      city: row.city,
                      level: row.level,
                      address: row.address,
                      description: row.description,
                    }),
                  config.maxRetries,
                  () => {
                    stats.fallbackCalls += 1;
                    stats.llmCalls += 1;
                    stats.rowsPerCallTotal += 1;
                  }
                );
                const fallbackTranslated: HospitalBatchTranslation = {
                  id: row.id,
                  sourceHash,
                  nameEn: sanitizeTranslatedText(fallback.nameEn),
                  cityEn: sanitizeTranslatedText(fallback.cityEn),
                  levelEn: sanitizeTranslatedText(fallback.levelEn),
                  addressEn: sanitizeTranslatedText(fallback.addressEn),
                  descriptionEn: sanitizeTranslatedText(fallback.descriptionEn),
                };
                cache.set(sourceHash, fallbackTranslated);
                await applyHospitalTranslation(db, row, fallbackTranslated, stats);
              } catch (fallbackError) {
                recordFailure(stats, fallbackError);
                await markHospitalFailed(db, row.id, fallbackError);
              }
              await delay(config.rateLimitMs);
            }
            continue;
          }

          let finalTranslated: HospitalBatchTranslation = translated;
          const completionCandidate = group[0];
          const currentMissingFields = missingTranslatedFields([
            { source: completionCandidate.name, translated: translated.nameEn },
            { source: completionCandidate.city, translated: translated.cityEn },
            { source: completionCandidate.level, translated: translated.levelEn },
            { source: completionCandidate.address, translated: translated.addressEn },
            {
              source: completionCandidate.description,
              translated: translated.descriptionEn,
            },
          ]);
          if (currentMissingFields > 0) {
            const completed = await completeHospitalTranslation(
              completionCandidate,
              translated,
              config,
              stats
            );
            finalTranslated = {
              ...translated,
              ...completed,
            };
          }

          cache.set(sourceHash, finalTranslated);
          for (const row of group) {
            await applyHospitalTranslation(db, row, finalTranslated, stats);
            stats.batchedApplied += 1;
          }
        }

        logApiCall(stats);
        await delay(config.rateLimitMs);
      } catch (error) {
        stats.parseFailures += rowsByHash.size;
        for (const [sourceHash, group] of rowsByHash.entries()) {
          for (const row of group) {
            try {
              const fallback = await withRetry(
                () =>
                  translateHospital({
                    name: row.name,
                    city: row.city,
                    level: row.level,
                    address: row.address,
                    description: row.description,
                  }),
                config.maxRetries,
                () => {
                  stats.fallbackCalls += 1;
                  stats.llmCalls += 1;
                  stats.rowsPerCallTotal += 1;
                }
              );
              const fallbackTranslated: HospitalBatchTranslation = {
                id: row.id,
                sourceHash,
                nameEn: sanitizeTranslatedText(fallback.nameEn),
                cityEn: sanitizeTranslatedText(fallback.cityEn),
                levelEn: sanitizeTranslatedText(fallback.levelEn),
                addressEn: sanitizeTranslatedText(fallback.addressEn),
                descriptionEn: sanitizeTranslatedText(fallback.descriptionEn),
              };
              cache.set(sourceHash, fallbackTranslated);
              await applyHospitalTranslation(db, row, fallbackTranslated, stats);
            } catch (fallbackError) {
              recordFailure(stats, fallbackError);
              await markHospitalFailed(db, row.id, fallbackError);
            }
            await delay(config.rateLimitMs);
          }
        }
      }
    });
  }

  printEntitySummary(stats);
  return stats;
};

const translateDepartments = async (
  db: TranslationDb,
  config: ReturnType<typeof parseArgs>
): Promise<EntityRunStats> => {
  console.log("\n[Translate] Departments");
  const stats = createEntityRunStats("departments", config);
  const cache = new Map<string, DepartmentBatchTranslation>();
  let cursor = 0;

  while (true) {
    const rows = await db
      .select()
      .from(departments)
      .where(
        and(
          gt(departments.id, cursor),
          or(
            eq(departments.translationStatus, "pending"),
            eq(departments.translationStatus, "failed"),
            isNull(departments.translationStatus)
          )
        )
      )
      .orderBy(asc(departments.id))
      .limit(config.batchSize);

    if (rows.length === 0) {
      console.log("No pending departments.");
      break;
    }

    stats.batches += 1;
    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;
    console.log(
      `[Departments] processing batch size=${rows.length}, scanned=${stats.scanned}, cursor=${cursor}`
    );

    const llmChunks = splitToChunks(rows, config.llmBatchSize);
    await createWorkerPool(llmChunks, config.concurrency, async chunkRows => {
      const uniqueByHash = new Map<string, DepartmentBatchInput>();
      const rowsByHash = new Map<string, DepartmentRow[]>();
      for (const row of chunkRows) {
        const sourceHash = computeSourceHash({
          name: row.name,
          description: row.description,
        });

        const isDone = row.translationStatus === "done" && row.sourceHash === sourceHash;
        if (isDone) {
          stats.skippedUpToDate += 1;
          continue;
        }

        stats.attempted += 1;

        if (row.sourceHash !== sourceHash) {
          await db
            .update(departments)
            .set({
              sourceHash,
              translationStatus: "pending",
              translatedAt: null,
              lastTranslationError: null,
            })
            .where(eq(departments.id, row.id));
        }

        const cached = config.cacheEnabled ? cache.get(sourceHash) : undefined;
        if (cached) {
          await applyDepartmentTranslation(db, row, cached, stats);
          stats.batchedApplied += 1;
          stats.cacheHits += 1;
          continue;
        }

        if (!uniqueByHash.has(sourceHash)) {
          uniqueByHash.set(sourceHash, {
            id: row.id,
            sourceHash,
            name: row.name,
            description: row.description,
          });
        }
        const group = rowsByHash.get(sourceHash) ?? [];
        group.push(row);
        rowsByHash.set(sourceHash, group);
      }

      if (uniqueByHash.size === 0) {
        return;
      }

      const toTranslate = Array.from(uniqueByHash.values());
      try {
        const { items, invalidEntries } = await withRetry(
          () => translateDepartmentBatch(toTranslate),
          config.maxRetries,
          () => {
            stats.llmCalls += 1;
            stats.rowsPerCallTotal += toTranslate.length;
          }
        );
        if (invalidEntries > 0) {
          stats.parseFailures += invalidEntries;
        }

        for (const [sourceHash, group] of rowsByHash.entries()) {
          const translated = items.get(sourceHash);
          if (!translated) {
            for (const row of group) {
              stats.parseFailures += 1;
              try {
                const fallback = await withRetry(
                  () =>
                    translateDepartment({
                      name: row.name,
                      description: row.description,
                    }),
                  config.maxRetries,
                  () => {
                    stats.fallbackCalls += 1;
                    stats.llmCalls += 1;
                    stats.rowsPerCallTotal += 1;
                  }
                );
                const fallbackTranslated: DepartmentBatchTranslation = {
                  id: row.id,
                  sourceHash,
                  nameEn: sanitizeTranslatedText(fallback.nameEn),
                  descriptionEn: sanitizeTranslatedText(fallback.descriptionEn),
                };
                cache.set(sourceHash, fallbackTranslated);
                await applyDepartmentTranslation(db, row, fallbackTranslated, stats);
              } catch (fallbackError) {
                recordFailure(stats, fallbackError);
                await markDepartmentFailed(db, row.id, fallbackError);
              }
              await delay(config.rateLimitMs);
            }
            continue;
          }

          let finalTranslated: DepartmentBatchTranslation = translated;
          const completionCandidate = group[0];
          const currentMissingFields = missingTranslatedFields([
            { source: completionCandidate.name, translated: translated.nameEn },
            {
              source: completionCandidate.description,
              translated: translated.descriptionEn,
            },
          ]);
          if (currentMissingFields > 0) {
            const completed = await completeDepartmentTranslation(
              completionCandidate,
              translated,
              config,
              stats
            );
            finalTranslated = {
              ...translated,
              ...completed,
            };
          }

          cache.set(sourceHash, finalTranslated);
          for (const row of group) {
            await applyDepartmentTranslation(db, row, finalTranslated, stats);
            stats.batchedApplied += 1;
          }
        }

        logApiCall(stats);
        await delay(config.rateLimitMs);
      } catch (error) {
        stats.parseFailures += rowsByHash.size;
        for (const [sourceHash, group] of rowsByHash.entries()) {
          for (const row of group) {
            try {
              const fallback = await withRetry(
                () =>
                  translateDepartment({
                    name: row.name,
                    description: row.description,
                  }),
                config.maxRetries,
                () => {
                  stats.fallbackCalls += 1;
                  stats.llmCalls += 1;
                  stats.rowsPerCallTotal += 1;
                }
              );
              const fallbackTranslated: DepartmentBatchTranslation = {
                id: row.id,
                sourceHash,
                nameEn: sanitizeTranslatedText(fallback.nameEn),
                descriptionEn: sanitizeTranslatedText(fallback.descriptionEn),
              };
              cache.set(sourceHash, fallbackTranslated);
              await applyDepartmentTranslation(db, row, fallbackTranslated, stats);
            } catch (fallbackError) {
              recordFailure(stats, fallbackError);
              await markDepartmentFailed(db, row.id, fallbackError);
            }
            await delay(config.rateLimitMs);
          }
        }
      }
    });
  }

  printEntitySummary(stats);
  return stats;
};

const translateDoctors = async (
  db: TranslationDb,
  config: ReturnType<typeof parseArgs>
): Promise<EntityRunStats> => {
  console.log("\n[Translate] Doctors");
  const stats = createEntityRunStats("doctors", config);
  const cache = new Map<string, DoctorBatchTranslation>();
  let cursor = 0;

  while (true) {
    const rows = await db
      .select()
      .from(doctors)
      .where(
        and(
          gt(doctors.id, cursor),
          doctorNeedsTranslationCondition
        )
      )
      .orderBy(asc(doctors.id))
      .limit(config.batchSize);

    if (rows.length === 0) {
      console.log("No pending doctors.");
      break;
    }

    stats.batches += 1;
    cursor = rows[rows.length - 1].id;
    stats.scanned += rows.length;
    console.log(
      `[Doctors] processing batch size=${rows.length}, scanned=${stats.scanned}, cursor=${cursor}`
    );

    const llmChunks = splitToChunks(rows, config.llmBatchSize);
    await createWorkerPool(llmChunks, config.concurrency, async chunkRows => {
      const uniqueByHash = new Map<string, DoctorBatchInput>();
      const rowsByHash = new Map<string, DoctorRow[]>();
      const sourceByHash = new Map<string, DoctorSourceText>();

      for (const row of chunkRows) {
        const sourceName = normalizeSourceText(row.name);
        const sourceTitle = normalizeSourceText(row.title);
        const sourceSpecialty = normalizeSourceText(row.specialty);
        const sourceExpertise = normalizeSourceText(row.expertise);
        const sourceOnlineConsultation = normalizeSourceText(row.onlineConsultation);
        const sourceAppointmentAvailable = normalizeSourceText(row.appointmentAvailable);
        const sourceSatisfactionRate = normalizeSourceText(row.satisfactionRate);
        const sourceAttitudeScore = normalizeSourceText(row.attitudeScore);

        const sourceHash = computeSourceHash({
          name: sourceName,
          title: sourceTitle,
          specialty: sourceSpecialty,
          expertise: sourceExpertise,
          onlineConsultation: sourceOnlineConsultation,
          appointmentAvailable: sourceAppointmentAvailable,
          satisfactionRate: sourceSatisfactionRate,
          attitudeScore: sourceAttitudeScore,
        });

        const isDone = row.translationStatus === "done" && row.sourceHash === sourceHash;
        if (isDone) {
          stats.skippedUpToDate += 1;
          continue;
        }

        stats.attempted += 1;

        if (row.sourceHash !== sourceHash) {
          await db
            .update(doctors)
            .set({
              sourceHash,
              translationStatus: "pending",
              translatedAt: null,
              lastTranslationError: null,
            })
            .where(eq(doctors.id, row.id));
        }

        const cached = config.cacheEnabled ? cache.get(sourceHash) : undefined;
        if (cached) {
          await applyDoctorTranslation(db, row, cached, {
            sourceName: sourceName || row.name,
            sourceTitle,
            sourceSpecialty,
            sourceExpertise,
            sourceOnlineConsultation,
            sourceAppointmentAvailable,
            sourceSatisfactionRate,
            sourceAttitudeScore,
          }, stats);
          stats.batchedApplied += 1;
          stats.cacheHits += 1;
          continue;
        }

        if (!uniqueByHash.has(sourceHash)) {
          uniqueByHash.set(sourceHash, {
            id: row.id,
            sourceHash,
            name: sourceName || row.name,
            title: sourceTitle,
            specialty: sourceSpecialty,
            expertise: sourceExpertise,
            onlineConsultation: sourceOnlineConsultation,
            appointmentAvailable: sourceAppointmentAvailable,
            satisfactionRate: sourceSatisfactionRate,
            attitudeScore: sourceAttitudeScore,
          });
          sourceByHash.set(sourceHash, {
            sourceName: sourceName || row.name,
            sourceTitle,
            sourceSpecialty,
            sourceExpertise,
            sourceOnlineConsultation,
            sourceAppointmentAvailable,
            sourceSatisfactionRate,
            sourceAttitudeScore,
          });
        }
        const group = rowsByHash.get(sourceHash) ?? [];
        group.push(row);
        rowsByHash.set(sourceHash, group);
      }

      if (uniqueByHash.size === 0) {
        return;
      }

      const toTranslate = Array.from(uniqueByHash.values());
      try {
        const { items, invalidEntries } = await withRetry(
          () => translateDoctorBatch(toTranslate),
          config.maxRetries,
          () => {
            stats.llmCalls += 1;
            stats.rowsPerCallTotal += toTranslate.length;
          }
        );
        if (invalidEntries > 0) {
          stats.parseFailures += invalidEntries;
        }

        for (const [sourceHash, group] of rowsByHash.entries()) {
          const translated = items.get(sourceHash);
          if (!translated) {
            const source = sourceByHash.get(sourceHash);
            if (!source) continue;
            for (const row of group) {
              stats.parseFailures += 1;
              try {
                const fallback = await withRetry(
                  () =>
                    translateDoctor({
                      name: source.sourceName ?? row.name,
                      title: source.sourceTitle,
                      specialty: source.sourceSpecialty,
                      expertise: source.sourceExpertise,
                      onlineConsultation: source.sourceOnlineConsultation,
                      appointmentAvailable: source.sourceAppointmentAvailable,
                      satisfactionRate: source.sourceSatisfactionRate,
                      attitudeScore: source.sourceAttitudeScore,
                    }),
                  config.maxRetries,
                  () => {
                    stats.fallbackCalls += 1;
                    stats.llmCalls += 1;
                    stats.rowsPerCallTotal += 1;
                  }
                );
                const fallbackTranslated: DoctorBatchTranslation = {
                  id: row.id,
                  sourceHash,
                  ...emptyDoctorTranslationSnapshot(),
                  ...fallback,
                };
                cache.set(sourceHash, fallbackTranslated);
                await applyDoctorTranslation(db, row, fallbackTranslated, source, stats);
              } catch (fallbackError) {
                const enrichedError = new Error(
                  `[doctors:missing-batch-row] ${getErrorMessage(fallbackError)}`
                );
                recordFailure(stats, enrichedError);
                await markDoctorFailed(db, row.id, enrichedError);
              }
              await delay(config.rateLimitMs);
            }
            continue;
          }

          const source = sourceByHash.get(sourceHash);
          if (!source) continue;
          let finalTranslated: DoctorBatchTranslation = translated;
          const completionCandidate = group[0];
          const currentMissingFields = missingTranslatedFields([
            { source: source.sourceName ?? completionCandidate.name, translated: translated.nameEn },
            { source: source.sourceTitle, translated: translated.titleEn },
            { source: source.sourceSpecialty, translated: translated.specialtyEn },
            { source: source.sourceExpertise, translated: translated.expertiseEn },
            {
              source: source.sourceOnlineConsultation,
              translated: translated.onlineConsultationEn,
            },
            {
              source: source.sourceAppointmentAvailable,
              translated: translated.appointmentAvailableEn,
            },
            {
              source: source.sourceSatisfactionRate,
              translated: translated.satisfactionRateEn,
            },
            {
              source: source.sourceAttitudeScore,
              translated: translated.attitudeScoreEn,
            },
          ]);
          if (currentMissingFields > 0) {
            const completed = await completeDoctorTranslation(
              completionCandidate,
              source,
              translated,
              config,
              stats
            );
            finalTranslated = {
              ...translated,
              ...completed,
            };
          }

          cache.set(sourceHash, finalTranslated);
          for (const row of group) {
            await applyDoctorTranslation(db, row, finalTranslated, source, stats);
            stats.batchedApplied += 1;
          }
        }

        logApiCall(stats);
        await delay(config.rateLimitMs);
      } catch (error) {
        stats.parseFailures += rowsByHash.size;
        for (const [sourceHash, group] of rowsByHash.entries()) {
          const source = sourceByHash.get(sourceHash);
          if (!source) continue;
          for (const row of group) {
            try {
              const fallback = await withRetry(
                () =>
                  translateDoctor({
                    name: source.sourceName || row.name,
                    title: source.sourceTitle,
                    specialty: source.sourceSpecialty,
                    expertise: source.sourceExpertise,
                    onlineConsultation: source.sourceOnlineConsultation,
                    appointmentAvailable: source.sourceAppointmentAvailable,
                    satisfactionRate: source.sourceSatisfactionRate,
                    attitudeScore: source.sourceAttitudeScore,
                  }),
                config.maxRetries,
                () => {
                  stats.fallbackCalls += 1;
                  stats.llmCalls += 1;
                  stats.rowsPerCallTotal += 1;
                }
              );
              const fallbackTranslated: DoctorBatchTranslation = {
                id: row.id,
                sourceHash,
                ...emptyDoctorTranslationSnapshot(),
                ...fallback,
              };
              cache.set(sourceHash, fallbackTranslated);
              await applyDoctorTranslation(db, row, fallbackTranslated, source, stats);
            } catch (fallbackError) {
              const enrichedError = new Error(
                `[doctors:batch-fallback] ${getErrorMessage(fallbackError)}`
              );
              recordFailure(stats, enrichedError);
              await markDoctorFailed(db, row.id, enrichedError);
            }
            await delay(config.rateLimitMs);
          }
        }
      }
    });
  }

  printEntitySummary(stats);
  return stats;
};

const run = async () => {
  const config = parseArgs();
  translationModelOverride = config.translationModel;
  const pool = mysql.createPool(process.env.DATABASE_URL ?? "");
  const db = createTranslationDb(pool);
  const runStats: EntityRunStats[] = [];

  try {
    if (translationModelOverride) {
      console.log(`[Config] Translation model override: ${translationModelOverride}`);
    }
    await reconcileInconsistentDoneRows(pool, config.entities);

    if (config.entities.includes("hospitals")) {
      runStats.push(await translateHospitals(db, config));
    }
    if (config.entities.includes("departments")) {
      runStats.push(await translateDepartments(db, config));
    }
    if (config.entities.includes("doctors")) {
      runStats.push(await translateDoctors(db, config));
    }

    printRunSummary(runStats);

    const failedTotal = runStats.reduce((total, stats) => total + stats.failed, 0);
    const pendingTotal = runStats.reduce((total, stats) => total + stats.pending, 0);
    if (failedTotal > 0) {
      console.error(
        `\n❌ Translation finished with ${failedTotal} failed records. Check summary above for failure reasons.`
      );
      process.exitCode = 2;
    } else if (pendingTotal > 0) {
      console.warn(
        `\n⚠️ Translation finished with ${pendingTotal} pending records (incomplete English fields). Placeholder text may still appear until these records are completed.`
      );
    } else {
      console.log("\n✅ Translation finished with all processed records complete.");
    }
  } finally {
    await pool.end();
  }
};

run().catch(error => {
  console.error("Translation worker failed:", error);
  process.exit(1);
});
