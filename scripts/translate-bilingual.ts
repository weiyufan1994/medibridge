import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { createHash } from "crypto";
import { invokeLLM } from "../server/_core/llm";
import { departments, doctors, hospitals } from "../drizzle/schema";

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_RATE_LIMIT_MS = 200;
const DEFAULT_MAX_RETRIES = 3;
const PROVIDER_NAME = "forge/gemini-2.5-flash";

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

const pickEnglish = (existing: string | null | undefined, translated: string | null | undefined) => {
  if (existing && !hasCjk(existing)) return existing;
  if (translated && !hasCjk(translated)) return translated;
  return null;
};

const isFilled = (value: string | null | undefined) => Boolean(value && !hasCjk(value));

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
    batchSize: Number(config.batchSize || DEFAULT_BATCH_SIZE),
    concurrency: Number(config.concurrency || DEFAULT_CONCURRENCY),
    rateLimitMs: Number(config.rateLimitMs || DEFAULT_RATE_LIMIT_MS),
    maxRetries: Number(config.maxRetries || DEFAULT_MAX_RETRIES),
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
    const [result] = await pool.query(
      `
      UPDATE doctors
      SET translationStatus = 'pending', translatedAt = NULL, lastTranslationError = 'Requeued: incomplete English fields'
      WHERE translationStatus = 'done'
        AND (
          (name IS NOT NULL AND TRIM(name) <> '' AND (nameEn IS NULL OR TRIM(nameEn) = '' OR nameEn REGEXP '[一-龥]'))
          OR (title IS NOT NULL AND TRIM(title) <> '' AND (titleEn IS NULL OR TRIM(titleEn) = '' OR titleEn REGEXP '[一-龥]'))
          OR (specialty IS NOT NULL AND TRIM(specialty) <> '' AND (specialtyEn IS NULL OR TRIM(specialtyEn) = '' OR specialtyEn REGEXP '[一-龥]'))
          OR (expertise IS NOT NULL AND TRIM(expertise) <> '' AND (expertiseEn IS NULL OR TRIM(expertiseEn) = '' OR expertiseEn REGEXP '[一-龥]'))
          OR (onlineConsultation IS NOT NULL AND TRIM(onlineConsultation) <> '' AND (onlineConsultationEn IS NULL OR TRIM(onlineConsultationEn) = '' OR onlineConsultationEn REGEXP '[一-龥]'))
          OR (appointmentAvailable IS NOT NULL AND TRIM(appointmentAvailable) <> '' AND (appointmentAvailableEn IS NULL OR TRIM(appointmentAvailableEn) = '' OR appointmentAvailableEn REGEXP '[一-龥]'))
          OR (satisfactionRate IS NOT NULL AND TRIM(satisfactionRate) <> '' AND (satisfactionRateEn IS NULL OR TRIM(satisfactionRateEn) = '' OR satisfactionRateEn REGEXP '[一-龥]'))
          OR (attitudeScore IS NOT NULL AND TRIM(attitudeScore) <> '' AND (attitudeScoreEn IS NULL OR TRIM(attitudeScoreEn) = '' OR attitudeScoreEn REGEXP '[一-龥]'))
        )
      `
    );
    updates.push({
      entity: "doctors",
      affectedRows: Number((result as mysql.ResultSetHeader).affectedRows ?? 0),
    });
  }

  for (const update of updates) {
    console.log(`[Precheck] ${update.entity}: requeued ${update.affectedRows} inconsistent done rows`);
  }
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
  errorCounts: Map<string, number>;
};

const createEntityRunStats = (
  entity: EntityRunStats["entity"]
): EntityRunStats => ({
  entity,
  batches: 0,
  scanned: 0,
  attempted: 0,
  skippedUpToDate: 0,
  done: 0,
  pending: 0,
  failed: 0,
  errorCounts: new Map<string, number>(),
});

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const recordFailure = (stats: EntityRunStats, error: unknown) => {
  stats.failed += 1;
  const message = getErrorMessage(error).trim().slice(0, 280) || "Unknown error";
  stats.errorCounts.set(message, (stats.errorCounts.get(message) ?? 0) + 1);
};

const printEntitySummary = (stats: EntityRunStats) => {
  console.log(`\n[Summary:${stats.entity}] batches=${stats.batches}, scanned=${stats.scanned}, attempted=${stats.attempted}, done=${stats.done}, pending=${stats.pending}, failed=${stats.failed}, skippedUpToDate=${stats.skippedUpToDate}`);

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
    console.log(
      `- ${stats.entity}: done=${stats.done}, pending=${stats.pending}, failed=${stats.failed}, attempted=${stats.attempted}, scanned=${stats.scanned}`
    );
  }

  const totals = statsList.reduce(
    (acc, stats) => {
      acc.done += stats.done;
      acc.pending += stats.pending;
      acc.failed += stats.failed;
      acc.attempted += stats.attempted;
      acc.scanned += stats.scanned;
      return acc;
    },
    { done: 0, pending: 0, failed: 0, attempted: 0, scanned: 0 }
  );

  console.log(
    `Total: done=${totals.done}, pending=${totals.pending}, failed=${totals.failed}, attempted=${totals.attempted}, scanned=${totals.scanned}`
  );
};

const withRetry = async <T>(fn: () => Promise<T>, maxRetries: number) => {
  let attempt = 0;
  let delayMs = 500;
  while (true) {
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

  return JSON.parse(response.choices[0].message.content as string) as {
    nameEn: string | null;
    cityEn: string | null;
    levelEn: string | null;
    addressEn: string | null;
    descriptionEn: string | null;
  };
};

const translateDepartment = async (input: {
  name: string;
  description: string | null;
}) => {
  const response = await invokeLLM({
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

  return JSON.parse(response.choices[0].message.content as string) as {
    nameEn: string | null;
    descriptionEn: string | null;
  };
};

const translateDoctor = async (input: {
  name: string;
  title: string | null;
  specialty: string | null;
  expertise: string | null;
  onlineConsultation: string | null;
  appointmentAvailable: string | null;
  satisfactionRate: string | null;
  attitudeScore: string | null;
}) => {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese doctor information into patient-friendly English. Do not add facts or medical advice. Doctor names must not be translated into Western names; use pinyin or 'Dr. + pinyin'. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following doctor fields. Return empty string for missing values.\n\n${JSON.stringify(
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
          properties: {
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
  });

  return JSON.parse(response.choices[0].message.content as string) as {
    nameEn: string | null;
    titleEn: string | null;
    specialtyEn: string | null;
    expertiseEn: string | null;
    onlineConsultationEn: string | null;
    appointmentAvailableEn: string | null;
    satisfactionRateEn: string | null;
    attitudeScoreEn: string | null;
  };
};

const createWorkerPool = async <T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) => {
  let index = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await handler(current);
    }
  });
  await Promise.all(workers);
};

const translateHospitals = async (
  db: TranslationDb,
  config: ReturnType<typeof parseArgs>
): Promise<EntityRunStats> => {
  console.log("\n[Translate] Hospitals");
  const stats = createEntityRunStats("hospitals");
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
    console.log(`[Hospitals] processing batch size=${rows.length}, scanned=${stats.scanned}, cursor=${cursor}`);

    await createWorkerPool(rows, config.concurrency, async (row) => {
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
        return;
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

      try {
        const translated = await withRetry(
          () =>
            translateHospital({
              name: row.name,
              city: row.city,
              level: row.level,
              address: row.address,
              description: row.description,
            }),
          config.maxRetries
        );

        const nameEn = pickEnglish(row.nameEn, translated.nameEn);
        const cityEn = pickEnglish(row.cityEn, translated.cityEn);
        const levelEn = pickEnglish(row.levelEn, translated.levelEn);
        const addressEn = pickEnglish(row.addressEn, translated.addressEn);
        const descriptionEn = pickEnglish(row.descriptionEn, translated.descriptionEn);
        const isComplete =
          isFilled(nameEn) &&
          (!row.city || isFilled(cityEn)) &&
          (!row.level || isFilled(levelEn)) &&
          (!row.address || isFilled(addressEn)) &&
          (!row.description || isFilled(descriptionEn));

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
            translationProvider: PROVIDER_NAME,
          })
          .where(eq(hospitals.id, row.id));

        if (isComplete) {
          stats.done += 1;
        } else {
          stats.pending += 1;
        }

        await delay(config.rateLimitMs);
      } catch (error) {
        recordFailure(stats, error);
        await db
          .update(hospitals)
          .set({
            translationStatus: "failed",
            lastTranslationError: getErrorMessage(error),
          })
          .where(eq(hospitals.id, row.id));
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
  const stats = createEntityRunStats("departments");
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
    console.log(`[Departments] processing batch size=${rows.length}, scanned=${stats.scanned}, cursor=${cursor}`);

    await createWorkerPool(rows, config.concurrency, async (row) => {
      const sourceHash = computeSourceHash({
        name: row.name,
        description: row.description,
      });

      const isDone = row.translationStatus === "done" && row.sourceHash === sourceHash;
      if (isDone) {
        stats.skippedUpToDate += 1;
        return;
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

      try {
        const translated = await withRetry(
          () =>
            translateDepartment({
              name: row.name,
              description: row.description,
            }),
          config.maxRetries
        );

        const nameEn = pickEnglish(row.nameEn, translated.nameEn);
        const descriptionEn = pickEnglish(row.descriptionEn, translated.descriptionEn);
        const isComplete = isFilled(nameEn) && (!row.description || isFilled(descriptionEn));

        await db
          .update(departments)
          .set({
            nameEn,
            descriptionEn,
            translationStatus: isComplete ? "done" : "pending",
            translatedAt: isComplete ? new Date() : null,
            lastTranslationError: isComplete ? null : "Missing English fields",
            translationProvider: PROVIDER_NAME,
          })
          .where(eq(departments.id, row.id));

        if (isComplete) {
          stats.done += 1;
        } else {
          stats.pending += 1;
        }

        await delay(config.rateLimitMs);
      } catch (error) {
        recordFailure(stats, error);
        await db
          .update(departments)
          .set({
            translationStatus: "failed",
            lastTranslationError: getErrorMessage(error),
          })
          .where(eq(departments.id, row.id));
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
  const stats = createEntityRunStats("doctors");
  let cursor = 0;
  while (true) {
    const rows = await db
      .select()
      .from(doctors)
      .where(
        and(
          gt(doctors.id, cursor),
          or(
            eq(doctors.translationStatus, "pending"),
            eq(doctors.translationStatus, "failed"),
            isNull(doctors.translationStatus)
          )
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
    console.log(`[Doctors] processing batch size=${rows.length}, scanned=${stats.scanned}, cursor=${cursor}`);

    await createWorkerPool(rows, config.concurrency, async (row) => {
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
        return;
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

      try {
        const translated = await withRetry(
          () =>
            translateDoctor({
              name: sourceName || row.name,
              title: sourceTitle,
              specialty: sourceSpecialty,
              expertise: sourceExpertise,
              onlineConsultation: sourceOnlineConsultation,
              appointmentAvailable: sourceAppointmentAvailable,
              satisfactionRate: sourceSatisfactionRate,
              attitudeScore: sourceAttitudeScore,
            }),
          config.maxRetries
        );

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
        const isComplete =
          isFilled(nameEn) &&
          (!sourceTitle || isFilled(titleEn)) &&
          (!sourceSpecialty || isFilled(specialtyEn)) &&
          (!sourceExpertise || isFilled(expertiseEn)) &&
          (!sourceOnlineConsultation || isFilled(onlineConsultationEn)) &&
          (!sourceAppointmentAvailable || isFilled(appointmentAvailableEn)) &&
          (!sourceSatisfactionRate || isFilled(satisfactionRateEn)) &&
          (!sourceAttitudeScore || isFilled(attitudeScoreEn));

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
            lastTranslationError: isComplete ? null : "Missing English fields",
            translationProvider: PROVIDER_NAME,
          })
          .where(eq(doctors.id, row.id));

        if (isComplete) {
          stats.done += 1;
        } else {
          stats.pending += 1;
        }

        await delay(config.rateLimitMs);
      } catch (error) {
        recordFailure(stats, error);
        await db
          .update(doctors)
          .set({
            translationStatus: "failed",
            lastTranslationError: getErrorMessage(error),
          })
          .where(eq(doctors.id, row.id));
      }
    });
  }

  printEntitySummary(stats);
  return stats;
};

const run = async () => {
  const config = parseArgs();
  const pool = mysql.createPool(process.env.DATABASE_URL ?? "");
  const db = createTranslationDb(pool);
  const runStats: EntityRunStats[] = [];

  try {
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
      console.error(`\n❌ Translation finished with ${failedTotal} failed records. Check summary above for failure reasons.`);
      process.exitCode = 2;
    } else if (pendingTotal > 0) {
      console.warn(`\n⚠️ Translation finished with ${pendingTotal} pending records (incomplete English fields). Placeholder text may still appear until these records are completed.`);
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
