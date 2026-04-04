import "../server/_core/loadEnv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  hospitalReferenceGeneralRankings,
  hospitalReferenceHospitals,
  hospitalReferenceSpecialties,
  hospitalReferenceSpecialtyRankings,
  hospitalReferenceStemRankings,
  hospitals,
} from "../drizzle/schema";
import {
  loadHospitalReferenceSeedData,
  normalizeHospitalReferenceText,
  TRIAGE_HOSPITAL_REFERENCE_YEAR,
} from "../server/modules/ai/hospitalReferenceData";

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

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  return process.env.DATABASE_URL;
}

async function main() {
  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
  });
  const db = drizzle(pool);

  const { specialtyRows, generalRows, stemRows } = loadHospitalReferenceSeedData();
  const allLocalHospitals = await db
    .select({
      id: hospitals.id,
      name: hospitals.name,
      nameEn: hospitals.nameEn,
      city: hospitals.city,
      cityEn: hospitals.cityEn,
    })
    .from(hospitals);

  const localHospitalByNormalizedName = new Map(
    allLocalHospitals.map(hospital => [
      normalizeHospitalReferenceText(hospital.name),
      hospital,
    ])
  );

  const hospitalSeeds = new Map<
    string,
    {
      name: string;
      nameEn: string | null;
      normalizedName: string;
      city: string | null;
      cityEn: string | null;
      localHospitalId: number | null;
    }
  >();

  for (const hospitalName of [
    ...specialtyRows.map(row => row.hospitalName),
    ...generalRows.map(row => row.hospitalName),
    ...stemRows.map(row => row.hospitalName),
  ]) {
    const normalizedName = normalizeHospitalReferenceText(hospitalName);
    if (!normalizedName || hospitalSeeds.has(normalizedName)) {
      continue;
    }

    const localHospital = localHospitalByNormalizedName.get(normalizedName) ?? null;
    hospitalSeeds.set(normalizedName, {
      name: hospitalName,
      nameEn: localHospital?.nameEn ?? null,
      normalizedName,
      city: localHospital?.city ?? null,
      cityEn: localHospital?.cityEn ?? null,
      localHospitalId: localHospital?.id ?? null,
    });
  }

  const specialtySeeds = new Map<
    string,
    {
      name: string;
      nameEn: string | null;
      normalizedName: string;
    }
  >();
  for (const row of specialtyRows) {
    const normalizedName = normalizeHospitalReferenceText(row.specialtyName);
    if (!normalizedName || specialtySeeds.has(normalizedName)) {
      continue;
    }

    specialtySeeds.set(normalizedName, {
      name: row.specialtyName,
      nameEn: KNOWN_SPECIALTY_NAME_EN_BY_ZH[row.specialtyName] ?? null,
      normalizedName,
    });
  }

  console.log(
    `Importing triage hospital reference data: ${hospitalSeeds.size} hospitals, ${specialtySeeds.size} specialties, ${specialtyRows.length} specialty rankings, ${generalRows.length} general rankings, ${stemRows.length} STEM rankings`
  );

  await db.transaction(async tx => {
    const hospitalValues = Array.from(hospitalSeeds.values());
    if (hospitalValues.length > 0) {
      await tx
        .insert(hospitalReferenceHospitals)
        .values(hospitalValues)
        .onConflictDoUpdate({
          target: hospitalReferenceHospitals.normalizedName,
          set: {
            name: sql`excluded."name"`,
            nameEn: sql`coalesce(excluded."nameEn", "hospital_reference_hospitals"."nameEn")`,
            city: sql`coalesce(excluded."city", "hospital_reference_hospitals"."city")`,
            cityEn: sql`coalesce(excluded."cityEn", "hospital_reference_hospitals"."cityEn")`,
            localHospitalId: sql`coalesce(excluded."localHospitalId", "hospital_reference_hospitals"."localHospitalId")`,
            updatedAt: new Date(),
          },
        });
    }

    const specialtyValues = Array.from(specialtySeeds.values());
    if (specialtyValues.length > 0) {
      await tx
        .insert(hospitalReferenceSpecialties)
        .values(specialtyValues)
        .onConflictDoUpdate({
          target: hospitalReferenceSpecialties.normalizedName,
          set: {
            name: sql`excluded."name"`,
            nameEn: sql`coalesce(excluded."nameEn", "hospital_reference_specialties"."nameEn")`,
            updatedAt: new Date(),
          },
        });
    }

    const persistedHospitals = await tx
      .select({
        id: hospitalReferenceHospitals.id,
        normalizedName: hospitalReferenceHospitals.normalizedName,
      })
      .from(hospitalReferenceHospitals);
    const hospitalIdByNormalizedName = new Map(
      persistedHospitals.map(row => [row.normalizedName, row.id])
    );

    const persistedSpecialties = await tx
      .select({
        id: hospitalReferenceSpecialties.id,
        normalizedName: hospitalReferenceSpecialties.normalizedName,
      })
      .from(hospitalReferenceSpecialties);
    const specialtyIdByNormalizedName = new Map(
      persistedSpecialties.map(row => [row.normalizedName, row.id])
    );

    await tx
      .delete(hospitalReferenceSpecialtyRankings)
      .where(
        eq(
          hospitalReferenceSpecialtyRankings.sourceYear,
          TRIAGE_HOSPITAL_REFERENCE_YEAR
        )
      );
    await tx
      .delete(hospitalReferenceGeneralRankings)
      .where(
        eq(
          hospitalReferenceGeneralRankings.sourceYear,
          TRIAGE_HOSPITAL_REFERENCE_YEAR
        )
      );
    await tx
      .delete(hospitalReferenceStemRankings)
      .where(
        eq(hospitalReferenceStemRankings.sourceYear, TRIAGE_HOSPITAL_REFERENCE_YEAR)
      );

    if (specialtyRows.length > 0) {
      await tx.insert(hospitalReferenceSpecialtyRankings).values(
        specialtyRows.flatMap(row => {
          const hospitalReferenceId = hospitalIdByNormalizedName.get(
            normalizeHospitalReferenceText(row.hospitalName)
          );
          const specialtyReferenceId = specialtyIdByNormalizedName.get(
            normalizeHospitalReferenceText(row.specialtyName)
          );

          if (!hospitalReferenceId || !specialtyReferenceId) {
            return [];
          }

          return [
            {
              hospitalReferenceId,
              specialtyReferenceId,
              sourceYear: TRIAGE_HOSPITAL_REFERENCE_YEAR,
              specialtyRank: row.specialtyRank,
              specialtyScore: row.specialtyScore,
            },
          ];
        })
      );
    }

    if (generalRows.length > 0) {
      await tx.insert(hospitalReferenceGeneralRankings).values(
        generalRows.flatMap(row => {
          const hospitalReferenceId = hospitalIdByNormalizedName.get(
            normalizeHospitalReferenceText(row.hospitalName)
          );
          if (!hospitalReferenceId) {
            return [];
          }

          return [
            {
              hospitalReferenceId,
              sourceYear: TRIAGE_HOSPITAL_REFERENCE_YEAR,
              rankOrder: row.generalRankOrder,
              grade: row.generalGrade,
            },
          ];
        })
      );
    }

    if (stemRows.length > 0) {
      await tx.insert(hospitalReferenceStemRankings).values(
        stemRows.flatMap(row => {
          const hospitalReferenceId = hospitalIdByNormalizedName.get(
            normalizeHospitalReferenceText(row.hospitalName)
          );
          if (!hospitalReferenceId) {
            return [];
          }

          return [
            {
              hospitalReferenceId,
              sourceYear: TRIAGE_HOSPITAL_REFERENCE_YEAR,
              stemRank: row.stemRank,
            },
          ];
        })
      );
    }
  });

  const [hospitalCount, specialtyCount, specialtyRankingCount, generalRankingCount, stemRankingCount] =
    await Promise.all([
      db.select().from(hospitalReferenceHospitals),
      db.select().from(hospitalReferenceSpecialties),
      db.select().from(hospitalReferenceSpecialtyRankings),
      db.select().from(hospitalReferenceGeneralRankings),
      db.select().from(hospitalReferenceStemRankings),
    ]);

  console.log("Import completed:", {
    hospitals: hospitalCount.length,
    specialties: specialtyCount.length,
    specialtyRankings: specialtyRankingCount.length,
    generalRankings: generalRankingCount.length,
    stemRankings: stemRankingCount.length,
  });

  await pool.end();
}

main().catch(error => {
  console.error("[import-triage-hospital-reference] failed:", error);
  process.exit(1);
});
