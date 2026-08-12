import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { hospitals } from "../drizzle/schema";
import {
  computeSourceHash,
  delay,
  missingTranslatedFields,
  sanitizeTranslatedText,
  type TranslationConfig,
} from "./translate-bilingual-core";
import {
  translateHospital,
  translateHospitalBatch,
  type HospitalBatchInput,
} from "./translate-bilingual-hospital-department-llm";
import type { HospitalBatchTranslation } from "./translate-bilingual-parsers";
import {
  applyHospitalTranslation,
  markHospitalFailed,
  type HospitalRow,
  type TranslationDb,
} from "./translate-bilingual-persistence";
import { completeHospitalTranslation } from "./translate-bilingual-completion";
import {
  createEntityRunStats,
  createWorkerPool,
  logApiCall,
  printEntitySummary,
  recordFailure,
  splitToChunks,
  withRetry,
  type EntityRunStats,
} from "./translate-bilingual-runtime";

export const translateHospitals = async (
  db: TranslationDb,
  config: TranslationConfig,
  model: string | undefined,
  providerName: string
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
          await applyHospitalTranslation(db, row, cached, stats, providerName);
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
          () => translateHospitalBatch(toTranslate, model),
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
                  stats,
                  providerName
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
              stats,
              model
            );
            finalTranslated = {
              ...translated,
              ...completed,
            };
          }

          cache.set(sourceHash, finalTranslated);
          for (const row of group) {
            await applyHospitalTranslation(
              db,
              row,
              finalTranslated,
              stats,
              providerName
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
                stats,
                providerName
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
