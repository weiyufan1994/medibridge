import "../server/_core/loadEnv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { asc, eq, isNull, sql } from "drizzle-orm";
import { invokeLLM } from "../server/_core/llm";
import {
  hospitalReferenceHospitals,
  hospitalReferenceSpecialties,
  hospitals,
} from "../drizzle/schema";

const DEFAULT_BATCH_SIZE = 6;
const DEFAULT_TRANSLATION_PROVIDER = "forge/gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 60_000;
const resolveTranslationModel = () =>
  process.env.TRANSLATION_LLM_MODEL?.trim() ||
  process.env.LLM_MODEL?.trim() ||
  DEFAULT_TRANSLATION_PROVIDER;

const KNOWN_CITY_EN_BY_ZH: Record<string, string> = {
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

const KNOWN_SPECIALTY_NAME_EN_BY_ZH: Record<string, string> = {
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

type ReferenceHospitalRow = typeof hospitalReferenceHospitals.$inferSelect;
type LocalHospitalRow = typeof hospitals.$inferSelect;
type ReferenceSpecialtyRow = typeof hospitalReferenceSpecialties.$inferSelect;

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  return process.env.DATABASE_URL;
}

const hasCjk = (value: string | null | undefined) =>
  Boolean(value && /[\u4e00-\u9fff]/.test(value));

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

const pickEnglish = (
  existing: string | null | undefined,
  translated: string | null | undefined
) => {
  if (existing && !hasCjk(existing)) return existing.trim();
  if (translated && !hasCjk(translated)) return translated.trim();
  return null;
};

const splitToChunks = <T>(items: T[], chunkSize: number): T[][] => {
  const normalizedChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }
  return chunks;
};

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

async function translateHospitalBatch(
  input: Array<{ id: number; name: string; city: string | null }>
) {
  const response = await invokeLLM({
    model: resolveTranslationModel(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese hospital names and city names into concise patient-friendly English. Use official or widely accepted English names when known. Do not add facts. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following hospital references. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "triage_hospital_reference_translation",
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
                  nameEn: { type: ["string", "null"] },
                  cityEn: { type: ["string", "null"] },
                },
                required: ["id", "nameEn", "cityEn"],
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

  const parsed = JSON.parse(readMessageText(response.choices[0].message.content)) as
    | {
        items?: Array<{
          id: number;
          nameEn?: string | null;
          cityEn?: string | null;
          name?: string | null;
          city?: string | null;
        }>;
      }
    | Array<{
        id: number;
        nameEn?: string | null;
        cityEn?: string | null;
        name?: string | null;
        city?: string | null;
      }>;
  const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);

  return new Map(
    items.flatMap(item => {
      if (!Number.isFinite(item.id) || item.id <= 0) {
        return [];
      }

      return [
        [
          item.id,
          {
            nameEn: sanitizeTranslatedText(item.nameEn ?? item.name),
            cityEn: sanitizeTranslatedText(item.cityEn ?? item.city),
          },
        ] as const,
      ];
    })
  );
}

async function translateHospitalSingle(input: {
  name: string;
  city: string | null;
}) {
  const response = await invokeLLM({
    model: resolveTranslationModel(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate the Chinese hospital name and city into concise patient-friendly English. Use official or widely accepted English names when known. Return JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "single_triage_hospital_reference_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            nameEn: { type: ["string", "null"] },
            cityEn: { type: ["string", "null"] },
          },
          required: ["nameEn", "cityEn"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 512,
  });

  const parsed = JSON.parse(readMessageText(response.choices[0].message.content)) as {
    nameEn?: string | null;
    cityEn?: string | null;
    name?: string | null;
    city?: string | null;
  };

  return {
    nameEn: sanitizeTranslatedText(parsed.nameEn ?? parsed.name),
    cityEn: sanitizeTranslatedText(parsed.cityEn ?? parsed.city),
  };
}

async function translateSpecialtyBatch(
  input: Array<{ id: number; name: string }>
) {
  const response = await invokeLLM({
    model: resolveTranslationModel(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese medical specialty names into concise patient-friendly English. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following specialty names. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "triage_hospital_reference_specialty_translation",
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
                  nameEn: { type: ["string", "null"] },
                },
                required: ["id", "nameEn"],
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

  const parsed = JSON.parse(readMessageText(response.choices[0].message.content)) as
    | {
        items?: Array<{
          id: number;
          nameEn?: string | null;
          name?: string | null;
        }>;
      }
    | Array<{
        id: number;
        nameEn?: string | null;
        name?: string | null;
      }>;
  const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);

  return new Map(
    items.flatMap(item => {
      if (!Number.isFinite(item.id) || item.id <= 0) {
        return [];
      }

      return [
        [
          item.id,
          {
            nameEn: sanitizeTranslatedText(item.nameEn ?? item.name),
          },
        ] as const,
      ];
    })
  );
}

async function translateSpecialtySingle(input: { name: string }) {
  const response = await invokeLLM({
    model: resolveTranslationModel(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate the Chinese medical specialty name into concise patient-friendly English. Return JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "single_triage_hospital_reference_specialty_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            nameEn: { type: ["string", "null"] },
          },
          required: ["nameEn"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 256,
  });

  const parsed = JSON.parse(readMessageText(response.choices[0].message.content)) as {
    nameEn?: string | null;
    name?: string | null;
  };

  return {
    nameEn: sanitizeTranslatedText(parsed.nameEn ?? parsed.name),
  };
}

async function main() {
  const batchSize = Number.parseInt(process.env.TRIAGE_REF_TRANSLATE_BATCH_SIZE || "", 10);
  const effectiveBatchSize = Number.isFinite(batchSize) && batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE;

  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    options: "-c timezone=UTC",
  });
  const db = drizzle(pool);

  const [referenceHospitals, localHospitals, referenceSpecialties] = await Promise.all([
    db.select().from(hospitalReferenceHospitals).orderBy(asc(hospitalReferenceHospitals.id)),
    db.select().from(hospitals),
    db.select().from(hospitalReferenceSpecialties).orderBy(asc(hospitalReferenceSpecialties.id)),
  ]);

  const localHospitalById = new Map(localHospitals.map(row => [row.id, row] as const));

  let hospitalUpdated = 0;
  let specialtyUpdated = 0;

  const hospitalPrefillCandidates: ReferenceHospitalRow[] = [];
  const hospitalLlmCandidates: ReferenceHospitalRow[] = [];

  for (const row of referenceHospitals) {
    const local = row.localHospitalId
      ? (localHospitalById.get(row.localHospitalId) as LocalHospitalRow | undefined)
      : undefined;
    const localNameEn = local?.nameEn ?? null;
    const localCityEn = local?.cityEn ?? null;
    const mappedCityEn = row.city ? (KNOWN_CITY_EN_BY_ZH[row.city] ?? null) : null;
    const nextNameEn = pickEnglish(row.nameEn, localNameEn);
    const nextCityEn = pickEnglish(row.cityEn, localCityEn ?? mappedCityEn);

    if (nextNameEn !== row.nameEn || nextCityEn !== row.cityEn) {
      hospitalPrefillCandidates.push(row);
    } else if (!pickEnglish(row.nameEn, null) || (row.city && !pickEnglish(row.cityEn, null))) {
      hospitalLlmCandidates.push(row);
    }
  }

  for (const row of hospitalPrefillCandidates) {
    const local = row.localHospitalId
      ? (localHospitalById.get(row.localHospitalId) as LocalHospitalRow | undefined)
      : undefined;
    const localNameEn = local?.nameEn ?? null;
    const localCityEn = local?.cityEn ?? null;
    const mappedCityEn = row.city ? (KNOWN_CITY_EN_BY_ZH[row.city] ?? null) : null;
    const nextNameEn = pickEnglish(row.nameEn, localNameEn);
    const nextCityEn = pickEnglish(row.cityEn, localCityEn ?? mappedCityEn);

    await db
      .update(hospitalReferenceHospitals)
      .set({
        nameEn: nextNameEn,
        cityEn: nextCityEn,
        updatedAt: new Date(),
      })
      .where(eq(hospitalReferenceHospitals.id, row.id));
    hospitalUpdated += 1;
  }

  console.log(
    `[Hospitals] prefilled from local/static sources: ${hospitalPrefillCandidates.length}, remaining for LLM: ${hospitalLlmCandidates.length}`
  );

  const hospitalChunks = splitToChunks(hospitalLlmCandidates, effectiveBatchSize);
  for (const [chunkIndex, chunk] of hospitalChunks.entries()) {
    console.log(
      `[Hospitals] translating batch ${chunkIndex + 1}/${hospitalChunks.length} (${chunk.length} rows)`
    );
    let translatedById: Map<number, { nameEn: string | null; cityEn: string | null }>;
    try {
      translatedById = await translateHospitalBatch(
        chunk.map(row => ({
          id: row.id,
          name: row.name,
          city: row.city,
        }))
      );
    } catch (error) {
      console.warn(
        `[Hospitals] batch ${chunkIndex + 1} failed, retrying items one by one:`,
        error
      );
      translatedById = new Map();
      for (const row of chunk) {
        const translated = await translateHospitalSingle({
          name: row.name,
          city: row.city,
        });
        translatedById.set(row.id, translated);
      }
    }

    for (const row of chunk) {
      const translated = translatedById.get(row.id);
      const nextNameEn = pickEnglish(row.nameEn, translated?.nameEn ?? null);
      const nextCityEn = pickEnglish(
        row.cityEn,
        translated?.cityEn ?? (row.city ? KNOWN_CITY_EN_BY_ZH[row.city] ?? null : null)
      );

      if (nextNameEn === row.nameEn && nextCityEn === row.cityEn) {
        continue;
      }

      await db
        .update(hospitalReferenceHospitals)
        .set({
          nameEn: nextNameEn,
          cityEn: nextCityEn,
          updatedAt: new Date(),
        })
        .where(eq(hospitalReferenceHospitals.id, row.id));
      hospitalUpdated += 1;
    }
  }

  const specialtyDirectFill: ReferenceSpecialtyRow[] = [];
  const specialtyLlmCandidates: ReferenceSpecialtyRow[] = [];

  for (const row of referenceSpecialties) {
    const knownNameEn = KNOWN_SPECIALTY_NAME_EN_BY_ZH[row.name] ?? null;
    const nextNameEn = pickEnglish(row.nameEn, knownNameEn);
    if (nextNameEn !== row.nameEn) {
      specialtyDirectFill.push(row);
    } else if (!pickEnglish(row.nameEn, null)) {
      specialtyLlmCandidates.push(row);
    }
  }

  for (const row of specialtyDirectFill) {
    const nextNameEn = pickEnglish(row.nameEn, KNOWN_SPECIALTY_NAME_EN_BY_ZH[row.name] ?? null);
    await db
      .update(hospitalReferenceSpecialties)
      .set({
        nameEn: nextNameEn,
        updatedAt: new Date(),
      })
      .where(eq(hospitalReferenceSpecialties.id, row.id));
    specialtyUpdated += 1;
  }

  console.log(
    `[Specialties] prefilled from known mappings: ${specialtyDirectFill.length}, remaining for LLM: ${specialtyLlmCandidates.length}`
  );

  const specialtyChunks = splitToChunks(specialtyLlmCandidates, effectiveBatchSize);
  for (const [chunkIndex, chunk] of specialtyChunks.entries()) {
    console.log(
      `[Specialties] translating batch ${chunkIndex + 1}/${specialtyChunks.length} (${chunk.length} rows)`
    );
    let translatedById: Map<number, { nameEn: string | null }>;
    try {
      translatedById = await translateSpecialtyBatch(
        chunk.map(row => ({
          id: row.id,
          name: row.name,
        }))
      );
    } catch (error) {
      console.warn(
        `[Specialties] batch ${chunkIndex + 1} failed, retrying items one by one:`,
        error
      );
      translatedById = new Map();
      for (const row of chunk) {
        const translated = await translateSpecialtySingle({
          name: row.name,
        });
        translatedById.set(row.id, translated);
      }
    }

    for (const row of chunk) {
      const translated = translatedById.get(row.id);
      const nextNameEn = pickEnglish(row.nameEn, translated?.nameEn ?? null);
      if (nextNameEn === row.nameEn) {
        continue;
      }

      await db
        .update(hospitalReferenceSpecialties)
        .set({
          nameEn: nextNameEn,
          updatedAt: new Date(),
        })
        .where(eq(hospitalReferenceSpecialties.id, row.id));
      specialtyUpdated += 1;
    }
  }

  const [hospitalCoverage, specialtyCoverage] = await Promise.all([
    db.execute(sql`select
        count(*)::int as total,
        count(*) filter (where "nameEn" is not null and trim("nameEn") <> '' and "nameEn" !~ '[一-龥]')::int as name_en_filled,
        count(*) filter (where "city" is null or ("cityEn" is not null and trim("cityEn") <> '' and "cityEn" !~ '[一-龥]'))::int as city_en_ready
      from hospital_reference_hospitals`),
    db.execute(sql`select
        count(*)::int as total,
        count(*) filter (where "nameEn" is not null and trim("nameEn") <> '' and "nameEn" !~ '[一-龥]')::int as name_en_filled
      from hospital_reference_specialties`),
  ]);

  const remainingHospitals = await db
    .select({
      id: hospitalReferenceHospitals.id,
      name: hospitalReferenceHospitals.name,
      city: hospitalReferenceHospitals.city,
    })
    .from(hospitalReferenceHospitals)
    .where(isNull(hospitalReferenceHospitals.nameEn))
    .orderBy(asc(hospitalReferenceHospitals.id))
    .limit(20);

  const remainingSpecialties = await db
    .select({
      id: hospitalReferenceSpecialties.id,
      name: hospitalReferenceSpecialties.name,
    })
    .from(hospitalReferenceSpecialties)
    .where(isNull(hospitalReferenceSpecialties.nameEn))
    .orderBy(asc(hospitalReferenceSpecialties.id))
    .limit(20);

  console.log("Triage hospital reference translation completed:", {
    hospitalUpdated,
    specialtyUpdated,
    hospitals: hospitalCoverage.rows[0],
    specialties: specialtyCoverage.rows[0],
    remainingHospitals,
    remainingSpecialties,
  });

  await pool.end();
}

main().catch(error => {
  console.error("[translate-triage-hospital-reference] failed:", error);
  process.exit(1);
});
