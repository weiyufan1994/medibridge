import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { departments, doctors, hospitals } from "../drizzle/schema";
import { extractAffectedRows } from "../server/_core/dbCompat";
import { clampText, isFilled, pickEnglish } from "./translate-bilingual-core";
import {
  doctorTranslationIsComplete,
  getMissingDoctorFields,
  type DoctorBatchTranslation,
  type DoctorSourceText,
} from "./translate-bilingual-doctor-support";
import type {
  DepartmentBatchTranslation,
  HospitalBatchTranslation,
} from "./translate-bilingual-parsers";
import {
  getErrorMessage,
  type EntityRunStats,
} from "./translate-bilingual-runtime";

export type HospitalRow = typeof hospitals.$inferSelect;
export type DepartmentRow = typeof departments.$inferSelect;
export type DoctorRow = typeof doctors.$inferSelect;

export const createTranslationDb = (pool: Pool) => drizzle(pool);
export type TranslationDb = ReturnType<typeof createTranslationDb>;

export const reconcileInconsistentDoneRows = async (
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
    updates.push({ entity: "doctors", affectedRows: 0 });
  }

  for (const update of updates) {
    console.log(
      `[Precheck] ${update.entity}: requeued ${update.affectedRows} inconsistent done rows`
    );
  }
};

export const hospitalTranslationIsComplete = (
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

export const departmentTranslationIsComplete = (
  row: Pick<DepartmentRow, "description">,
  translated: Pick<DepartmentBatchTranslation, "nameEn" | "descriptionEn">
) =>
  isFilled(translated.nameEn) &&
  (!row.description || isFilled(translated.descriptionEn));

export const markHospitalFailed = async (
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

export const markDepartmentFailed = async (
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

export const markDoctorFailed = async (
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

export const applyHospitalTranslation = async (
  db: TranslationDb,
  row: HospitalRow,
  translated: HospitalBatchTranslation,
  stats: EntityRunStats,
  providerName: string
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
      translationProvider: providerName,
    })
    .where(eq(hospitals.id, row.id));

  stats[isComplete ? "done" : "pending"] += 1;
};

export const applyDepartmentTranslation = async (
  db: TranslationDb,
  row: DepartmentRow,
  translated: DepartmentBatchTranslation,
  stats: EntityRunStats,
  providerName: string
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
      translationProvider: providerName,
    })
    .where(eq(departments.id, row.id));

  stats[isComplete ? "done" : "pending"] += 1;
};

export const applyDoctorTranslation = async (
  db: TranslationDb,
  row: DoctorRow,
  translated: DoctorBatchTranslation,
  source: DoctorSourceText,
  stats: EntityRunStats,
  providerName: string
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
      translationProvider: providerName,
    })
    .where(eq(doctors.id, row.id));

  stats[isComplete ? "done" : "pending"] += 1;
};
