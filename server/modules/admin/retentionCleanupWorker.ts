import { createLogger } from "../../_core/logger";
import { runRetentionCleanup } from "./retentionCleanupRepo";

const logger = createLogger("retention-cleanup-worker");
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

type CleanupRunner = typeof runRetentionCleanup;

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function startRetentionCleanupWorker(options?: {
  enabled?: boolean;
  execute?: boolean;
  intervalMs?: number;
  runOnStart?: boolean;
  runCleanup?: CleanupRunner;
}) {
  const enabled =
    options?.enabled ??
    isEnabled(process.env.RETENTION_CLEANUP_SCHEDULE_ENABLED);
  if (!enabled) {
    logger.info("disabled");
    return () => undefined;
  }

  const execute =
    options?.execute ?? isEnabled(process.env.RETENTION_CLEANUP_EXECUTE);
  const dryRun = !execute;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const runOnStart = options?.runOnStart ?? true;
  const runCleanup = options?.runCleanup ?? runRetentionCleanup;
  let running = false;

  const tick = async () => {
    if (running) {
      logger.warn("tick_skipped_overlap");
      return;
    }

    running = true;
    try {
      const result = await runCleanup({ dryRun, createdBy: null });
      if ("failureReason" in result) {
        logger.error("tick_failed", { dryRun });
        return;
      }

      logger.info("tick_completed", {
        dryRun,
        scannedMessages: result.scannedMessages,
        totalCandidates: result.totalCandidates,
        deletedMessages: result.deletedMessages,
        deletedGuests: result.deletedGuests,
        generatedAt: result.generatedAt,
        nextCleanupAt: result.nextCleanupAt,
      });
    } catch (error) {
      logger.error("tick_failed", {
        dryRun,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    } finally {
      running = false;
    }
  };

  logger.info("scheduled", { dryRun, intervalMs, runOnStart });
  if (runOnStart) {
    void tick();
  }
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => clearInterval(timer);
}
