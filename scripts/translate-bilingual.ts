import "../server/_core/loadEnv";
import { Pool } from "pg";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { departments, doctors, hospitals } from "../drizzle/schema";
import {
  HOSPITAL_CITY_TRANSLATIONS,
  HOSPITAL_LEVEL_TRANSLATIONS,
  computeSourceHash,
  delay,
  missingTranslatedFields,
  normalizeSourceText,
  parseArgs,
  pickEnglish,
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
import {
  translateDoctor as translateDoctorViaAdapter,
  translateDoctorBatch as translateDoctorBatchViaAdapter,
  translateDoctorFieldText as translateDoctorFieldTextViaAdapter,
} from "./translate-bilingual-doctor-llm";
import {
  DOCTOR_TRANSLATION_FIELDS,
  buildDoctorPartialInput,
  emptyDoctorTranslationSnapshot,
  getMissingDoctorFields,
  type DoctorBatchInput,
  type DoctorBatchTranslation,
  type DoctorSourceText,
  type DoctorTranslationSnapshot,
} from "./translate-bilingual-doctor-support";
import {
  translateDepartment as translateDepartmentViaAdapter,
  translateDepartmentBatch as translateDepartmentBatchViaAdapter,
  translateDepartmentNameOnly as translateDepartmentNameOnlyViaAdapter,
  translateHospital as translateHospitalViaAdapter,
  translateHospitalBatch as translateHospitalBatchViaAdapter,
  type DepartmentBatchInput,
  type HospitalBatchInput,
} from "./translate-bilingual-hospital-department-llm";
import {
  applyDepartmentTranslation as applyDepartmentTranslationPersisted,
  applyDoctorTranslation as applyDoctorTranslationPersisted,
  applyHospitalTranslation as applyHospitalTranslationPersisted,
  createTranslationDb as createTranslationDbPersisted,
  departmentTranslationIsComplete as departmentTranslationIsCompletePersisted,
  hospitalTranslationIsComplete as hospitalTranslationIsCompletePersisted,
  markDepartmentFailed as markDepartmentFailedPersisted,
  markDoctorFailed as markDoctorFailedPersisted,
  markHospitalFailed as markHospitalFailedPersisted,
  reconcileInconsistentDoneRows as reconcileInconsistentDoneRowsPersisted,
  type DepartmentRow,
  type DoctorRow,
  type HospitalRow,
  type TranslationDb,
} from "./translate-bilingual-persistence";

const DEFAULT_TRANSLATION_PROVIDER = "forge/gemini-2.5-flash";
let translationModelOverride: string | undefined;

const getTranslationProviderName = () =>
  translationModelOverride?.trim() || DEFAULT_TRANSLATION_PROVIDER;

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

  if (hospitalTranslationIsCompletePersisted(row, current)) {
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

  if (departmentTranslationIsCompletePersisted(row, current)) {
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
      () =>
        translateDoctorViaAdapter(partialInput, translationModelOverride, [
          field,
        ]),
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
          () =>
            translateDoctorFieldTextViaAdapter(
              field,
              sourceValue,
              translationModelOverride
            ),
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
          await applyHospitalTranslationPersisted(
            db,
            row,
            cached,
            stats,
            getTranslationProviderName()
          );
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
                await applyHospitalTranslationPersisted(
                  db,
                  row,
                  fallbackTranslated,
                  stats,
                  getTranslationProviderName()
                );
              } catch (fallbackError) {
                recordFailure(stats, fallbackError);
                await markHospitalFailedPersisted(db, row.id, fallbackError);
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
            await applyHospitalTranslationPersisted(
              db,
              row,
              finalTranslated,
              stats,
              getTranslationProviderName()
            );
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
              await applyHospitalTranslationPersisted(
                db,
                row,
                fallbackTranslated,
                stats,
                getTranslationProviderName()
              );
            } catch (fallbackError) {
              recordFailure(stats, fallbackError);
              await markHospitalFailedPersisted(db, row.id, fallbackError);
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
          await applyDepartmentTranslationPersisted(
            db,
            row,
            cached,
            stats,
            getTranslationProviderName()
          );
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
                await applyDepartmentTranslationPersisted(
                  db,
                  row,
                  fallbackTranslated,
                  stats,
                  getTranslationProviderName()
                );
              } catch (fallbackError) {
                recordFailure(stats, fallbackError);
                await markDepartmentFailedPersisted(db, row.id, fallbackError);
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
            await applyDepartmentTranslationPersisted(
              db,
              row,
              finalTranslated,
              stats,
              getTranslationProviderName()
            );
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
              await applyDepartmentTranslationPersisted(
                db,
                row,
                fallbackTranslated,
                stats,
                getTranslationProviderName()
              );
            } catch (fallbackError) {
              recordFailure(stats, fallbackError);
              await markDepartmentFailedPersisted(db, row.id, fallbackError);
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
          await applyDoctorTranslationPersisted(
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
            stats,
            getTranslationProviderName()
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
          () =>
            translateDoctorBatchViaAdapter(
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
            const source = sourceByHash.get(sourceHash);
            if (!source) continue;
            for (const row of group) {
              stats.parseFailures += 1;
              try {
                const fallback = await withRetry(
                  () =>
                    translateDoctorViaAdapter(
                      {
                        name: source.sourceName ?? row.name,
                        title: source.sourceTitle,
                        specialty: source.sourceSpecialty,
                        expertise: source.sourceExpertise,
                        onlineConsultation: source.sourceOnlineConsultation,
                        appointmentAvailable: source.sourceAppointmentAvailable,
                        satisfactionRate: source.sourceSatisfactionRate,
                        attitudeScore: source.sourceAttitudeScore,
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
                const fallbackTranslated: DoctorBatchTranslation = {
                  id: row.id,
                  sourceHash,
                  ...emptyDoctorTranslationSnapshot(),
                  ...fallback,
                };
                cache.set(sourceHash, fallbackTranslated);
                await applyDoctorTranslationPersisted(
                  db,
                  row,
                  fallbackTranslated,
                  source,
                  stats,
                  getTranslationProviderName()
                );
              } catch (fallbackError) {
                const enrichedError = new Error(
                  `[doctors:missing-batch-row] ${getErrorMessage(fallbackError)}`
                );
                recordFailure(stats, enrichedError);
                await markDoctorFailedPersisted(db, row.id, enrichedError);
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
            await applyDoctorTranslationPersisted(
              db,
              row,
              finalTranslated,
              source,
              stats,
              getTranslationProviderName()
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
                  translateDoctorViaAdapter(
                    {
                      name: source.sourceName || row.name,
                      title: source.sourceTitle,
                      specialty: source.sourceSpecialty,
                      expertise: source.sourceExpertise,
                      onlineConsultation: source.sourceOnlineConsultation,
                      appointmentAvailable: source.sourceAppointmentAvailable,
                      satisfactionRate: source.sourceSatisfactionRate,
                      attitudeScore: source.sourceAttitudeScore,
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
              const fallbackTranslated: DoctorBatchTranslation = {
                id: row.id,
                sourceHash,
                ...emptyDoctorTranslationSnapshot(),
                ...fallback,
              };
              cache.set(sourceHash, fallbackTranslated);
              await applyDoctorTranslationPersisted(
                db,
                row,
                fallbackTranslated,
                source,
                stats,
                getTranslationProviderName()
              );
            } catch (fallbackError) {
              const enrichedError = new Error(
                `[doctors:batch-fallback] ${getErrorMessage(fallbackError)}`
              );
              recordFailure(stats, enrichedError);
              await markDoctorFailedPersisted(db, row.id, enrichedError);
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
  const db = createTranslationDbPersisted(pool);
  const runStats: EntityRunStats[] = [];

  try {
    if (translationModelOverride) {
      console.log(
        `[Config] Translation model override: ${translationModelOverride}`
      );
    }
    await reconcileInconsistentDoneRowsPersisted(pool, config.entities);

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
