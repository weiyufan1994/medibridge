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

const createTranslationDb = (pool: mysql.Pool) => drizzle(pool);
type TranslationDb = ReturnType<typeof createTranslationDb>;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeValue = (value: unknown) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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

const translateHospitals = async (db: TranslationDb, config: ReturnType<typeof parseArgs>) => {
  console.log("\n[Translate] Hospitals");
  let cursor = 0;
  let scanned = 0;
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

    cursor = rows[rows.length - 1].id;
    scanned += rows.length;
    console.log(`[Hospitals] processing batch size=${rows.length}, scanned=${scanned}, cursor=${cursor}`);

    await createWorkerPool(rows, config.concurrency, async (row) => {
      const sourceHash = computeSourceHash({
        name: row.name,
        city: row.city,
        level: row.level,
        address: row.address,
        description: row.description,
      });

      const isDone = row.translationStatus === "done" && row.sourceHash === sourceHash;
      if (isDone) return;

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

        await delay(config.rateLimitMs);
      } catch (error) {
        await db
          .update(hospitals)
          .set({
            translationStatus: "failed",
            lastTranslationError: String(error),
          })
          .where(eq(hospitals.id, row.id));
      }
    });
  }
};

const translateDepartments = async (
  db: TranslationDb,
  config: ReturnType<typeof parseArgs>
) => {
  console.log("\n[Translate] Departments");
  let cursor = 0;
  let scanned = 0;
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

    cursor = rows[rows.length - 1].id;
    scanned += rows.length;
    console.log(`[Departments] processing batch size=${rows.length}, scanned=${scanned}, cursor=${cursor}`);

    await createWorkerPool(rows, config.concurrency, async (row) => {
      const sourceHash = computeSourceHash({
        name: row.name,
        description: row.description,
      });

      const isDone = row.translationStatus === "done" && row.sourceHash === sourceHash;
      if (isDone) return;

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

        await delay(config.rateLimitMs);
      } catch (error) {
        await db
          .update(departments)
          .set({
            translationStatus: "failed",
            lastTranslationError: String(error),
          })
          .where(eq(departments.id, row.id));
      }
    });
  }
};

const translateDoctors = async (db: TranslationDb, config: ReturnType<typeof parseArgs>) => {
  console.log("\n[Translate] Doctors");
  let cursor = 0;
  let scanned = 0;
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

    cursor = rows[rows.length - 1].id;
    scanned += rows.length;
    console.log(`[Doctors] processing batch size=${rows.length}, scanned=${scanned}, cursor=${cursor}`);

    await createWorkerPool(rows, config.concurrency, async (row) => {
      const sourceHash = computeSourceHash({
        name: row.name,
        title: row.title,
        specialty: row.specialty,
        expertise: row.expertise,
        onlineConsultation: row.onlineConsultation,
        appointmentAvailable: row.appointmentAvailable,
        satisfactionRate: row.satisfactionRate,
        attitudeScore: row.attitudeScore,
      });

      const isDone = row.translationStatus === "done" && row.sourceHash === sourceHash;
      if (isDone) return;

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
              name: row.name,
              title: row.title,
              specialty: row.specialty,
              expertise: row.expertise,
              onlineConsultation: row.onlineConsultation,
              appointmentAvailable: row.appointmentAvailable,
              satisfactionRate: row.satisfactionRate,
              attitudeScore: row.attitudeScore,
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
          (!row.title || isFilled(titleEn)) &&
          (!row.specialty || isFilled(specialtyEn)) &&
          (!row.expertise || isFilled(expertiseEn)) &&
          (!row.onlineConsultation || isFilled(onlineConsultationEn)) &&
          (!row.appointmentAvailable || isFilled(appointmentAvailableEn)) &&
          (!row.satisfactionRate || isFilled(satisfactionRateEn)) &&
          (!row.attitudeScore || isFilled(attitudeScoreEn));

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

        await delay(config.rateLimitMs);
      } catch (error) {
        await db
          .update(doctors)
          .set({
            translationStatus: "failed",
            lastTranslationError: String(error),
          })
          .where(eq(doctors.id, row.id));
      }
    });
  }
};

const run = async () => {
  const config = parseArgs();
  const pool = mysql.createPool(process.env.DATABASE_URL ?? "");
  const db = createTranslationDb(pool);

  if (config.entities.includes("hospitals")) {
    await translateHospitals(db, config);
  }
  if (config.entities.includes("departments")) {
    await translateDepartments(db, config);
  }
  if (config.entities.includes("doctors")) {
    await translateDoctors(db, config);
  }

  await pool.end();
};

run().catch(error => {
  console.error("Translation worker failed:", error);
  process.exit(1);
});
