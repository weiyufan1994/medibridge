import "../server/_core/loadEnv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { invokeLLM } from "../server/_core/llm";
import { departments, doctors, hospitals } from "../drizzle/schema";
import { extractAffectedRows } from "../server/_core/dbCompat";
import {
  HOSPITAL_CITY_TRANSLATIONS,
  HOSPITAL_LEVEL_TRANSLATIONS,
  clampText,
  computeSourceHash,
  delay,
  isFilled,
  missingTranslatedFields,
  normalizeSourceText,
  parseArgs,
  pickEnglish,
  readMessageText,
  sanitizeTranslatedText,
} from "./translate-bilingual-core";
import {
  createEntityRunStats,
  createWorkerPool,
  getErrorMessage,
  logApiCall,
  printEntitySummary,
  printRunSummary,
  recordFailure,
  splitToChunks,
  withRetry,
  type EntityRunStats,
} from "./translate-bilingual-runtime";
import { parseDoctorBatchResponse } from "./translate-bilingual-parsers";
import {
  translateDepartment as translateDepartmentViaAdapter,
  translateDepartmentBatch as translateDepartmentBatchViaAdapter,
  translateDepartmentNameOnly as translateDepartmentNameOnlyViaAdapter,
  translateHospital as translateHospitalViaAdapter,
  translateHospitalBatch as translateHospitalBatchViaAdapter,
  type DepartmentBatchInput,
  type HospitalBatchInput,
} from "./translate-bilingual-hospital-department-llm";

const DEFAULT_TRANSLATION_PROVIDER = "forge/gemini-2.5-flash";
let translationModelOverride: string | undefined;

const getTranslationProviderName = () =>
  translationModelOverride?.trim() || DEFAULT_TRANSLATION_PROVIDER;

type HospitalRow = typeof hospitals.$inferSelect;
type DepartmentRow = typeof departments.$inferSelect;
type DoctorRow = typeof doctors.$inferSelect;

const createTranslationDb = (pool: Pool) => drizzle(pool);
type TranslationDb = ReturnType<typeof createTranslationDb>;

const reconcileInconsistentDoneRows = async (
  pool: Pool,
  entities: string[]
) => {
  const updates: Array<{ entity: string; affectedRows: number }> = [];

  if (entities.includes("hospitals")) {
    const result = await pool.query(
      `
      UPDATE hospitals
      SET "translationStatus" = 'pending', "translatedAt" = NULL, "lastTranslationError" = 'Requeued: incomplete English fields'
      WHERE "translationStatus" = 'done'
        AND (
          (name IS NOT NULL AND TRIM(name) <> '' AND ("nameEn" IS NULL OR TRIM("nameEn") = '' OR "nameEn" ~ '[一-龥]'))
          OR (city IS NOT NULL AND TRIM(city) <> '' AND ("cityEn" IS NULL OR TRIM("cityEn") = '' OR "cityEn" ~ '[一-龥]'))
          OR (level IS NOT NULL AND TRIM(level) <> '' AND ("levelEn" IS NULL OR TRIM("levelEn") = '' OR "levelEn" ~ '[一-龥]'))
          OR (address IS NOT NULL AND TRIM(address) <> '' AND ("addressEn" IS NULL OR TRIM("addressEn") = '' OR "addressEn" ~ '[一-龥]'))
          OR (description IS NOT NULL AND TRIM(description) <> '' AND ("descriptionEn" IS NULL OR TRIM("descriptionEn") = '' OR "descriptionEn" ~ '[一-龥]'))
        )
      `
    );
    updates.push({
      entity: "hospitals",
      affectedRows: extractAffectedRows(result),
    });
  }

  if (entities.includes("departments")) {
    const result = await pool.query(
      `
      UPDATE departments
      SET "translationStatus" = 'pending', "translatedAt" = NULL, "lastTranslationError" = 'Requeued: incomplete English fields'
      WHERE "translationStatus" = 'done'
        AND (
          (name IS NOT NULL AND TRIM(name) <> '' AND ("nameEn" IS NULL OR TRIM("nameEn") = '' OR "nameEn" ~ '[一-龥]'))
          OR (description IS NOT NULL AND TRIM(description) <> '' AND ("descriptionEn" IS NULL OR TRIM("descriptionEn") = '' OR "descriptionEn" ~ '[一-龥]'))
        )
      `
    );
    updates.push({
      entity: "departments",
      affectedRows: extractAffectedRows(result),
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

type HospitalBatchTranslation = {
  id: number;
  sourceHash: string;
  nameEn: string | null;
  cityEn: string | null;
  levelEn: string | null;
  addressEn: string | null;
  descriptionEn: string | null;
};

const departmentTranslationIsComplete = (
  row: Pick<DepartmentRow, "description">,
  translated: Pick<DepartmentBatchTranslation, "nameEn" | "descriptionEn">
) =>
  isFilled(translated.nameEn) &&
  (!row.description || isFilled(translated.descriptionEn));

type DepartmentBatchTranslation = {
  id: number;
  sourceHash: string;
  nameEn: string | null;
  descriptionEn: string | null;
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

const translateDoctorFieldText = async (
  field: DoctorTranslatedField,
  sourceValue: string
) => {
  const fieldInstructions: Record<DoctorTranslatedField, string> = {
    nameEn:
      "Translate the Chinese doctor's name into English using pinyin or the format 'Dr. + pinyin'. Return plain text only.",
    titleEn:
      "Translate the Chinese medical title into concise English. Return plain text only.",
    specialtyEn:
      "Translate the Chinese specialty or department into patient-friendly English. Return plain text only.",
    expertiseEn:
      "Translate the Chinese doctor expertise summary into concise patient-friendly English. Return plain text only.",
    onlineConsultationEn:
      "Translate the Chinese online consultation field into concise English. Return plain text only. If unavailable, return an empty string.",
    appointmentAvailableEn:
      "Translate the Chinese appointment availability field into concise English. Return plain text only. If unavailable, return an empty string.",
    satisfactionRateEn:
      "Translate the Chinese satisfaction-rate field into concise English. Return plain text only. If unavailable, return an empty string.",
    attitudeScoreEn:
      "Translate the Chinese attitude-score field into concise English. Return plain text only. If unavailable, return an empty string.",
  };

  const response = await invokeLLM({
    model: translationModelOverride,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Return plain English text only. Do not add notes, placeholders, or explanations.",
      },
      {
        role: "user",
        content: `${fieldInstructions[field]}\n\n${sourceValue}`,
      },
    ],
    response_format: {
      type: "text",
    },
    max_tokens: 512,
  });

  return sanitizeTranslatedText(
    readMessageText(response.choices[0].message.content)
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
  (!source.sourceOnlineConsultation ||
    isFilled(translated.onlineConsultationEn)) &&
  (!source.sourceAppointmentAvailable ||
    isFilled(translated.appointmentAvailableEn)) &&
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

  return parseDoctorBatchResponse(
    readMessageText(response.choices[0].message.content)
  );
};

const markHospitalFailed = async (
  db: TranslationDb,
  id: number,
  error: unknown
) => {
  await db
    .update(hospitals)
    .set({
      translationStatus: "failed",
      lastTranslationError: getErrorMessage(error),
    })
    .where(eq(hospitals.id, id));
};

const markDepartmentFailed = async (
  db: TranslationDb,
  id: number,
  error: unknown
) => {
  await db
    .update(departments)
    .set({
      translationStatus: "failed",
      lastTranslationError: getErrorMessage(error),
    })
    .where(eq(departments.id, id));
};

const markDoctorFailed = async (
  db: TranslationDb,
  id: number,
  error: unknown
) => {
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
  const descriptionEn = pickEnglish(
    row.descriptionEn,
    translated.descriptionEn
  );
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
  const descriptionEn = pickEnglish(
    row.descriptionEn,
    translated.descriptionEn
  );
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
  {
    sourceKey: "sourceExpertise",
    inputKey: "expertise",
    translatedKey: "expertiseEn",
  },
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

const doctorTranslationKeys = DOCTOR_TRANSLATION_FIELDS.map(
  field => field.translatedKey
);

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
  const attitudeScoreEn = pickEnglish(
    row.attitudeScoreEn,
    translated.attitudeScoreEn
  );
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
      nameEn: clampText(nameEn, 100),
      titleEn: clampText(titleEn, 100),
      specialtyEn,
      expertiseEn,
      onlineConsultationEn: clampText(onlineConsultationEn, 50),
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
      translateHospitalViaAdapter(
        {
          name: row.name,
          city: row.city,
          level: row.level,
          address: row.address,
          description: row.description,
        },
        translationModelOverride
      ),
    config.maxRetries,
    () => {
      stats.fallbackCalls += 1;
      stats.llmCalls += 1;
      stats.rowsPerCallTotal += 1;
    }
  );

  return {
    nameEn: pickEnglish(current.nameEn, fallback.nameEn),
    cityEn: pickEnglish(
      current.cityEn,
      fallback.cityEn ??
        (row.city ? (HOSPITAL_CITY_TRANSLATIONS[row.city] ?? null) : null)
    ),
    levelEn: pickEnglish(
      current.levelEn,
      fallback.levelEn ??
        (row.level ? (HOSPITAL_LEVEL_TRANSLATIONS[row.level] ?? null) : null)
    ),
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

  if (!current.nameEn) {
    const translatedName = await withRetry(
      () =>
        translateDepartmentNameOnlyViaAdapter(
          row.name,
          translationModelOverride
        ),
      config.maxRetries,
      () => {
        stats.fallbackCalls += 1;
        stats.llmCalls += 1;
        stats.rowsPerCallTotal += 1;
      }
    );
    current.nameEn = pickEnglish(current.nameEn, translatedName);
  }

  if (departmentTranslationIsComplete(row, current)) {
    return current;
  }

  const fallback = await withRetry(
    () =>
      translateDepartmentViaAdapter(
        {
          name: row.name,
          description: row.description,
        },
        translationModelOverride
      ),
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
    satisfactionRateEn: pickEnglish(
      row.satisfactionRateEn,
      translated.satisfactionRateEn
    ),
    attitudeScoreEn: pickEnglish(
      row.attitudeScoreEn,
      translated.attitudeScoreEn
    ),
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
    if (!merged[field]) {
      const sourceField = DOCTOR_TRANSLATION_FIELDS.find(
        candidate => candidate.translatedKey === field
      );
      const sourceValue = sourceField ? source[sourceField.sourceKey] : null;
      if (sourceValue) {
        const translatedText = await withRetry(
          () => translateDoctorFieldText(field, sourceValue),
          config.maxRetries,
          () => {
            stats.fallbackCalls += 1;
            stats.llmCalls += 1;
            stats.rowsPerCallTotal += 1;
          }
        );
        merged = {
          ...merged,
          [field]: pickEnglish(merged[field], translatedText),
        };
      }
    }
    await delay(config.rateLimitMs);
  }

  const remainingFields = getMissingDoctorFields(source, merged);
  if (remainingFields.length > 0) {
    throw new Error(
      `Incomplete doctor translation after field retries: ${remainingFields.join(", ")}`
    );
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
        (${doctors.name} IS NOT NULL AND TRIM(${doctors.name}) <> '' AND (${doctors.nameEn} IS NULL OR TRIM(${doctors.nameEn}) = '' OR ${doctors.nameEn} ~ '[一-龥]'))
        OR (${doctors.title} IS NOT NULL AND TRIM(${doctors.title}) <> '' AND (${doctors.titleEn} IS NULL OR TRIM(${doctors.titleEn}) = '' OR ${doctors.titleEn} ~ '[一-龥]'))
        OR (${doctors.specialty} IS NOT NULL AND TRIM(${doctors.specialty}) <> '' AND (${doctors.specialtyEn} IS NULL OR TRIM(${doctors.specialtyEn}) = '' OR ${doctors.specialtyEn} ~ '[一-龥]'))
        OR (${doctors.expertise} IS NOT NULL AND TRIM(${doctors.expertise}) <> '' AND (${doctors.expertiseEn} IS NULL OR TRIM(${doctors.expertiseEn}) = '' OR ${doctors.expertiseEn} ~ '[一-龥]'))
        OR (${doctors.onlineConsultation} IS NOT NULL AND TRIM(${doctors.onlineConsultation}) <> '' AND (${doctors.onlineConsultationEn} IS NULL OR TRIM(${doctors.onlineConsultationEn}) = '' OR ${doctors.onlineConsultationEn} ~ '[一-龥]'))
        OR (${doctors.appointmentAvailable} IS NOT NULL AND TRIM(${doctors.appointmentAvailable}) <> '' AND (${doctors.appointmentAvailableEn} IS NULL OR TRIM(${doctors.appointmentAvailableEn}) = '' OR ${doctors.appointmentAvailableEn} ~ '[一-龥]'))
        OR (${doctors.satisfactionRate} IS NOT NULL AND TRIM(${doctors.satisfactionRate}) <> '' AND (${doctors.satisfactionRateEn} IS NULL OR TRIM(${doctors.satisfactionRateEn}) = '' OR ${doctors.satisfactionRateEn} ~ '[一-龥]'))
        OR (${doctors.attitudeScore} IS NOT NULL AND TRIM(${doctors.attitudeScore}) <> '' AND (${doctors.attitudeScoreEn} IS NULL OR TRIM(${doctors.attitudeScoreEn}) = '' OR ${doctors.attitudeScoreEn} ~ '[一-龥]'))
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

        const isDone =
          row.translationStatus === "done" && row.sourceHash === sourceHash;
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
          () =>
            translateHospitalBatchViaAdapter(
              toTranslate,
              translationModelOverride
            ),
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
                    translateHospitalViaAdapter(
                      {
                        name: row.name,
                        city: row.city,
                        level: row.level,
                        address: row.address,
                        description: row.description,
                      },
                      translationModelOverride
                    ),
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
                await applyHospitalTranslation(
                  db,
                  row,
                  fallbackTranslated,
                  stats
                );
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
            {
              source: completionCandidate.level,
              translated: translated.levelEn,
            },
            {
              source: completionCandidate.address,
              translated: translated.addressEn,
            },
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
                  translateHospitalViaAdapter(
                    {
                      name: row.name,
                      city: row.city,
                      level: row.level,
                      address: row.address,
                      description: row.description,
                    },
                    translationModelOverride
                  ),
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
              await applyHospitalTranslation(
                db,
                row,
                fallbackTranslated,
                stats
              );
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

        const isDone =
          row.translationStatus === "done" && row.sourceHash === sourceHash;
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
          () =>
            translateDepartmentBatchViaAdapter(
              toTranslate,
              translationModelOverride
            ),
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
                    translateDepartmentViaAdapter(
                      {
                        name: row.name,
                        description: row.description,
                      },
                      translationModelOverride
                    ),
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
                await applyDepartmentTranslation(
                  db,
                  row,
                  fallbackTranslated,
                  stats
                );
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
                  translateDepartmentViaAdapter(
                    {
                      name: row.name,
                      description: row.description,
                    },
                    translationModelOverride
                  ),
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
              await applyDepartmentTranslation(
                db,
                row,
                fallbackTranslated,
                stats
              );
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
      .where(and(gt(doctors.id, cursor), doctorNeedsTranslationCondition))
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
        const sourceOnlineConsultation = normalizeSourceText(
          row.onlineConsultation
        );
        const sourceAppointmentAvailable = normalizeSourceText(
          row.appointmentAvailable
        );
        const sourceSatisfactionRate = normalizeSourceText(
          row.satisfactionRate
        );
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

        const isDone =
          row.translationStatus === "done" && row.sourceHash === sourceHash;
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
          await applyDoctorTranslation(
            db,
            row,
            cached,
            {
              sourceName: sourceName || row.name,
              sourceTitle,
              sourceSpecialty,
              sourceExpertise,
              sourceOnlineConsultation,
              sourceAppointmentAvailable,
              sourceSatisfactionRate,
              sourceAttitudeScore,
            },
            stats
          );
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
                await applyDoctorTranslation(
                  db,
                  row,
                  fallbackTranslated,
                  source,
                  stats
                );
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
            {
              source: source.sourceName ?? completionCandidate.name,
              translated: translated.nameEn,
            },
            { source: source.sourceTitle, translated: translated.titleEn },
            {
              source: source.sourceSpecialty,
              translated: translated.specialtyEn,
            },
            {
              source: source.sourceExpertise,
              translated: translated.expertiseEn,
            },
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
            await applyDoctorTranslation(
              db,
              row,
              finalTranslated,
              source,
              stats
            );
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
              await applyDoctorTranslation(
                db,
                row,
                fallbackTranslated,
                source,
                stats
              );
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
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? "",
  });
  await pool.query("SET TIME ZONE 'UTC'");
  const db = createTranslationDb(pool);
  const runStats: EntityRunStats[] = [];

  try {
    if (translationModelOverride) {
      console.log(
        `[Config] Translation model override: ${translationModelOverride}`
      );
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

    const failedTotal = runStats.reduce(
      (total, stats) => total + stats.failed,
      0
    );
    const pendingTotal = runStats.reduce(
      (total, stats) => total + stats.pending,
      0
    );
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
      console.log(
        "\n✅ Translation finished with all processed records complete."
      );
    }
  } finally {
    await pool.end();
  }
};

run().catch(error => {
  console.error("Translation worker failed:", error);
  process.exit(1);
});
