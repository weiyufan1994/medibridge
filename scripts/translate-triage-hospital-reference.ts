import "../server/_core/loadEnv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { asc, eq, isNull, sql } from "drizzle-orm";
import {
  hospitalReferenceHospitals,
  hospitalReferenceSpecialties,
  hospitals,
} from "../drizzle/schema";
import {
  DEFAULT_BATCH_SIZE,
  KNOWN_CITY_EN_BY_ZH,
  KNOWN_SPECIALTY_NAME_EN_BY_ZH,
  pickEnglish,
  requireDatabaseUrl,
  splitToChunks,
} from "./translate-triage-hospital-reference-helpers";
import {
  translateHospitalBatch,
  translateHospitalSingle,
  translateSpecialtyBatch,
  translateSpecialtySingle,
} from "./translate-triage-hospital-reference-llm";

type ReferenceHospitalRow = typeof hospitalReferenceHospitals.$inferSelect;
type LocalHospitalRow = typeof hospitals.$inferSelect;
type ReferenceSpecialtyRow = typeof hospitalReferenceSpecialties.$inferSelect;

async function main() {
  const batchSize = Number.parseInt(
    process.env.TRIAGE_REF_TRANSLATE_BATCH_SIZE || "",
    10
  );
  const effectiveBatchSize =
    Number.isFinite(batchSize) && batchSize > 0
      ? batchSize
      : DEFAULT_BATCH_SIZE;

  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    options: "-c timezone=UTC",
  });
  const db = drizzle(pool);

  const [referenceHospitals, localHospitals, referenceSpecialties] =
    await Promise.all([
      db
        .select()
        .from(hospitalReferenceHospitals)
        .orderBy(asc(hospitalReferenceHospitals.id)),
      db.select().from(hospitals),
      db
        .select()
        .from(hospitalReferenceSpecialties)
        .orderBy(asc(hospitalReferenceSpecialties.id)),
    ]);

  const localHospitalById = new Map(
    localHospitals.map(row => [row.id, row] as const)
  );

  let hospitalUpdated = 0;
  let specialtyUpdated = 0;

  const hospitalPrefillCandidates: ReferenceHospitalRow[] = [];
  const hospitalLlmCandidates: ReferenceHospitalRow[] = [];

  for (const row of referenceHospitals) {
    const local = row.localHospitalId
      ? (localHospitalById.get(row.localHospitalId) as
          | LocalHospitalRow
          | undefined)
      : undefined;
    const localNameEn = local?.nameEn ?? null;
    const localCityEn = local?.cityEn ?? null;
    const mappedCityEn = row.city
      ? (KNOWN_CITY_EN_BY_ZH[row.city] ?? null)
      : null;
    const nextNameEn = pickEnglish(row.nameEn, localNameEn);
    const nextCityEn = pickEnglish(row.cityEn, localCityEn ?? mappedCityEn);

    if (nextNameEn !== row.nameEn || nextCityEn !== row.cityEn) {
      hospitalPrefillCandidates.push(row);
    } else if (
      !pickEnglish(row.nameEn, null) ||
      (row.city && !pickEnglish(row.cityEn, null))
    ) {
      hospitalLlmCandidates.push(row);
    }
  }

  for (const row of hospitalPrefillCandidates) {
    const local = row.localHospitalId
      ? (localHospitalById.get(row.localHospitalId) as
          | LocalHospitalRow
          | undefined)
      : undefined;
    const localNameEn = local?.nameEn ?? null;
    const localCityEn = local?.cityEn ?? null;
    const mappedCityEn = row.city
      ? (KNOWN_CITY_EN_BY_ZH[row.city] ?? null)
      : null;
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

  const hospitalChunks = splitToChunks(
    hospitalLlmCandidates,
    effectiveBatchSize
  );
  for (const [chunkIndex, chunk] of hospitalChunks.entries()) {
    console.log(
      `[Hospitals] translating batch ${chunkIndex + 1}/${hospitalChunks.length} (${chunk.length} rows)`
    );
    let translatedById: Map<
      number,
      { nameEn: string | null; cityEn: string | null }
    >;
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
        translated?.cityEn ??
          (row.city ? (KNOWN_CITY_EN_BY_ZH[row.city] ?? null) : null)
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
    const nextNameEn = pickEnglish(
      row.nameEn,
      KNOWN_SPECIALTY_NAME_EN_BY_ZH[row.name] ?? null
    );
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

  const specialtyChunks = splitToChunks(
    specialtyLlmCandidates,
    effectiveBatchSize
  );
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
