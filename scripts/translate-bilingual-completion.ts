import {
  HOSPITAL_CITY_TRANSLATIONS,
  HOSPITAL_LEVEL_TRANSLATIONS,
  delay,
  pickEnglish,
  type TranslationConfig,
} from "./translate-bilingual-core";
import {
  translateDoctor,
  translateDoctorFieldText,
} from "./translate-bilingual-doctor-llm";
import {
  DOCTOR_TRANSLATION_FIELDS,
  buildDoctorPartialInput,
  getMissingDoctorFields,
  type DoctorBatchTranslation,
  type DoctorSourceText,
  type DoctorTranslationSnapshot,
} from "./translate-bilingual-doctor-support";
import {
  translateDepartment,
  translateDepartmentNameOnly,
  translateHospital,
} from "./translate-bilingual-hospital-department-llm";
import type {
  DepartmentBatchTranslation,
  HospitalBatchTranslation,
} from "./translate-bilingual-parsers";
import {
  departmentTranslationIsComplete,
  hospitalTranslationIsComplete,
  type DepartmentRow,
  type DoctorRow,
  type HospitalRow,
} from "./translate-bilingual-persistence";
import { withRetry, type EntityRunStats } from "./translate-bilingual-runtime";

export const completeHospitalTranslation = async (
  row: HospitalRow,
  translated: HospitalBatchTranslation,
  config: TranslationConfig,
  stats: EntityRunStats,
  model: string | undefined
) => {
  const current = {
    nameEn: pickEnglish(row.nameEn, translated.nameEn),
    cityEn: pickEnglish(row.cityEn, translated.cityEn),
    levelEn: pickEnglish(row.levelEn, translated.levelEn),
    addressEn: pickEnglish(row.addressEn, translated.addressEn),
    descriptionEn: pickEnglish(row.descriptionEn, translated.descriptionEn),
  };

  if (hospitalTranslationIsComplete(row, current)) return current;

  const fallback = await withRetry(
    () =>
      translateHospital(
        {
          name: row.name,
          city: row.city,
          level: row.level,
          address: row.address,
          description: row.description,
        },
        model
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

export const completeDepartmentTranslation = async (
  row: DepartmentRow,
  translated: DepartmentBatchTranslation,
  config: TranslationConfig,
  stats: EntityRunStats,
  model: string | undefined
) => {
  const current = {
    nameEn: pickEnglish(row.nameEn, translated.nameEn),
    descriptionEn: pickEnglish(row.descriptionEn, translated.descriptionEn),
  };

  if (!current.nameEn) {
    const translatedName = await withRetry(
      () => translateDepartmentNameOnly(row.name, model),
      config.maxRetries,
      () => {
        stats.fallbackCalls += 1;
        stats.llmCalls += 1;
        stats.rowsPerCallTotal += 1;
      }
    );
    current.nameEn = pickEnglish(current.nameEn, translatedName);
  }

  if (departmentTranslationIsComplete(row, current)) return current;

  const fallback = await withRetry(
    () =>
      translateDepartment(
        { name: row.name, description: row.description },
        model
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

export const completeDoctorTranslation = async (
  row: DoctorRow,
  source: DoctorSourceText,
  translated: DoctorBatchTranslation,
  config: TranslationConfig,
  stats: EntityRunStats,
  model: string | undefined
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
  if (missingFields.length === 0) return current;

  let merged = { ...current };
  for (const field of missingFields) {
    const partialInput = buildDoctorPartialInput(source, [field]);
    const partial = await withRetry(
      () => translateDoctor(partialInput, model, [field]),
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
          () => translateDoctorFieldText(field, sourceValue, model),
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
