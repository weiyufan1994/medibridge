import "../server/_core/loadEnv";
import { Pool } from "pg";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { departments, doctors, hospitals } from "../drizzle/schema";
import {
  computeSourceHash,
  delay,
  missingTranslatedFields,
  normalizeSourceText,
  parseArgs,
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
import { translateDoctorBatch as translateDoctorBatchViaAdapter } from "./translate-bilingual-doctor-llm";
import {
  emptyDoctorTranslationSnapshot,
  type DoctorBatchInput,
  type DoctorBatchTranslation,
  type DoctorSourceText,
} from "./translate-bilingual-doctor-support";
import {
  translateDepartment as translateDepartmentViaAdapter,
  translateDepartmentBatch as translateDepartmentBatchViaAdapter,
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
  markDepartmentFailed as markDepartmentFailedPersisted,
  markDoctorFailed as markDoctorFailedPersisted,
  markHospitalFailed as markHospitalFailedPersisted,
  reconcileInconsistentDoneRows as reconcileInconsistentDoneRowsPersisted,
  type DepartmentRow,
  type DoctorRow,
  type HospitalRow,
  type TranslationDb,
} from "./translate-bilingual-persistence";
import {
  completeDepartmentTranslation as completeDepartmentTranslationExtracted,
  completeDoctorTranslation as completeDoctorTranslationExtracted,
  completeHospitalTranslation as completeHospitalTranslationExtracted,
} from "./translate-bilingual-completion";
import { translateDepartments as translateDepartmentsExtracted } from "./translate-bilingual-departments";
import { translateHospitals as translateHospitalsExtracted } from "./translate-bilingual-hospitals";

const DEFAULT_TRANSLATION_PROVIDER = "forge/gemini-2.5-flash";
let translationModelOverride: string | undefined;

const getTranslationProviderName = () =>
  translationModelOverride?.trim() || DEFAULT_TRANSLATION_PROVIDER;

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
            const completed = await completeDoctorTranslationExtracted(
              completionCandidate,
              source,
              translated,
              config,
              stats,
              translationModelOverride
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
      runStats.push(
        await translateHospitalsExtracted(
          db,
          config,
          translationModelOverride,
          getTranslationProviderName()
        )
      );
    }
    if (config.entities.includes("departments")) {
      runStats.push(
        await translateDepartmentsExtracted(
          db,
          config,
          translationModelOverride,
          getTranslationProviderName()
        )
      );
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
