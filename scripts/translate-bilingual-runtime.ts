import { delay, type TranslationConfig } from "./translate-bilingual-core";

export type EntityRunStats = {
  entity: "hospitals" | "departments" | "doctors";
  batches: number;
  scanned: number;
  attempted: number;
  skippedUpToDate: number;
  done: number;
  pending: number;
  failed: number;
  batchedApplied: number;
  fallbackCalls: number;
  cacheHits: number;
  llmCalls: number;
  rowsPerCallTotal: number;
  parseFailures: number;
  apiCallsLogInterval: number;
  errorCounts: Map<string, number>;
};

export const createEntityRunStats = (
  entity: EntityRunStats["entity"],
  config: TranslationConfig
): EntityRunStats => ({
  entity,
  batches: 0,
  scanned: 0,
  attempted: 0,
  skippedUpToDate: 0,
  done: 0,
  pending: 0,
  failed: 0,
  batchedApplied: 0,
  fallbackCalls: 0,
  cacheHits: 0,
  llmCalls: 0,
  rowsPerCallTotal: 0,
  parseFailures: 0,
  apiCallsLogInterval: config.apiCallsLogInterval,
  errorCounts: new Map<string, number>(),
});

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const recordFailure = (stats: EntityRunStats, error: unknown) => {
  stats.failed += 1;
  const message =
    getErrorMessage(error).trim().slice(0, 280) || "Unknown error";
  stats.errorCounts.set(message, (stats.errorCounts.get(message) ?? 0) + 1);
};

export const logApiCall = (stats: EntityRunStats) => {
  if (
    stats.apiCallsLogInterval > 0 &&
    stats.llmCalls % stats.apiCallsLogInterval === 0
  ) {
    const avgRowsPerCall =
      stats.llmCalls === 0
        ? 0
        : Number((stats.rowsPerCallTotal / stats.llmCalls).toFixed(2));
    console.log(
      `[${stats.entity}] API calls=${stats.llmCalls}, avgRowsPerCall=${avgRowsPerCall}, batchedApplied=${stats.batchedApplied}, fallbackCalls=${stats.fallbackCalls}, cacheHits=${stats.cacheHits}, parseFailures=${stats.parseFailures}`
    );
  }
};

export const printEntitySummary = (stats: EntityRunStats) => {
  const avgRowsPerCall =
    stats.llmCalls === 0
      ? 0
      : Number((stats.rowsPerCallTotal / stats.llmCalls).toFixed(2));
  console.log(
    `\n[Summary:${stats.entity}] batches=${stats.batches}, scanned=${stats.scanned}, attempted=${stats.attempted}, done=${stats.done}, pending=${stats.pending}, failed=${stats.failed}, skippedUpToDate=${stats.skippedUpToDate}, llmCalls=${stats.llmCalls}, avgRowsPerCall=${avgRowsPerCall}, batchedApplied=${stats.batchedApplied}, fallbackCalls=${stats.fallbackCalls}, cacheHits=${stats.cacheHits}, parseFailures=${stats.parseFailures}`
  );

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

export const printRunSummary = (statsList: EntityRunStats[]) => {
  console.log("\n========== Translation Run Summary ==========");
  for (const stats of statsList) {
    const avgRowsPerCall =
      stats.llmCalls === 0
        ? 0
        : Number((stats.rowsPerCallTotal / stats.llmCalls).toFixed(2));
    console.log(
      `- ${stats.entity}: done=${stats.done}, pending=${stats.pending}, failed=${stats.failed}, attempted=${stats.attempted}, scanned=${stats.scanned}, llmCalls=${stats.llmCalls}, avgRowsPerCall=${avgRowsPerCall}, batchedApplied=${stats.batchedApplied}, fallbackCalls=${stats.fallbackCalls}, parseFailures=${stats.parseFailures}`
    );
  }

  const totals = statsList.reduce(
    (acc, stats) => {
      acc.done += stats.done;
      acc.pending += stats.pending;
      acc.failed += stats.failed;
      acc.attempted += stats.attempted;
      acc.scanned += stats.scanned;
      acc.llmCalls += stats.llmCalls;
      acc.rowsPerCallTotal += stats.rowsPerCallTotal;
      acc.batchedApplied += stats.batchedApplied;
      acc.fallbackCalls += stats.fallbackCalls;
      acc.parseFailures += stats.parseFailures;
      return acc;
    },
    {
      done: 0,
      pending: 0,
      failed: 0,
      attempted: 0,
      scanned: 0,
      llmCalls: 0,
      rowsPerCallTotal: 0,
      batchedApplied: 0,
      fallbackCalls: 0,
      parseFailures: 0,
    }
  );
  const avgRowsPerCall =
    totals.llmCalls === 0
      ? 0
      : Number((totals.rowsPerCallTotal / totals.llmCalls).toFixed(2));
  console.log(
    `Total: done=${totals.done}, pending=${totals.pending}, failed=${totals.failed}, attempted=${totals.attempted}, scanned=${totals.scanned}, llmCalls=${totals.llmCalls}, avgRowsPerCall=${avgRowsPerCall}, batchedApplied=${totals.batchedApplied}, fallbackCalls=${totals.fallbackCalls}, parseFailures=${totals.parseFailures}`
  );
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number,
  onAttempt?: () => void
) => {
  let attempt = 0;
  let delayMs = 500;
  while (true) {
    onAttempt?.();
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

export const createWorkerPool = async <T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) => {
  let index = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await handler(current);
    }
  });
  await Promise.all(workers);
};

export const splitToChunks = <T>(items: T[], chunkSize: number): T[][] => {
  const normalizedChunkSize = Math.max(1, chunkSize);
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }
  return chunks;
};
