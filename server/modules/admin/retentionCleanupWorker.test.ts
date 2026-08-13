import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./retentionCleanupRepo", () => ({
  runRetentionCleanup: vi.fn(),
}));

import { runRetentionCleanup } from "./retentionCleanupRepo";
import { startRetentionCleanupWorker } from "./retentionCleanupWorker";

const successResult = {
  dryRun: true,
  scannedMessages: 12,
  deletedMessages: 0,
  totalCandidates: 3,
  freeCandidates: 2,
  paidCandidates: 1,
  freeRetentionDays: 7,
  paidRetentionDays: 180,
  guestCandidates: 0,
  deletedGuests: 0,
  guestRetentionDays: 30,
  freeSampleIds: [123],
  paidSampleIds: [456],
  guestSampleIds: [],
  generatedAt: "2026-08-13T00:00:00.000Z",
  nextCleanupAt: "2026-08-14T00:00:00.000Z",
} as const;

async function flushDetachedTick() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("retention cleanup worker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    delete process.env.RETENTION_CLEANUP_SCHEDULE_ENABLED;
    delete process.env.RETENTION_CLEANUP_EXECUTE;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.RETENTION_CLEANUP_SCHEDULE_ENABLED;
    delete process.env.RETENTION_CLEANUP_EXECUTE;
  });

  it("is disabled by default and schedules no cleanup", async () => {
    const stop = startRetentionCleanupWorker();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    stop();

    expect(runRetentionCleanup).not.toHaveBeenCalled();
  });

  it("runs immediately and daily in dry-run mode when scheduling is enabled", async () => {
    process.env.RETENTION_CLEANUP_SCHEDULE_ENABLED = " TrUe ";
    vi.mocked(runRetentionCleanup).mockResolvedValue(successResult);
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    const stop = startRetentionCleanupWorker();
    await flushDetachedTick();
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
    stop();

    expect(runRetentionCleanup).toHaveBeenCalledTimes(2);
    expect(runRetentionCleanup).toHaveBeenCalledWith({
      dryRun: true,
      createdBy: null,
    });
    const completedLog = consoleInfo.mock.calls
      .map(call => String(call[0]))
      .find(entry => entry.includes('"event":"tick_completed"'));
    expect(JSON.parse(completedLog ?? "{}")).toMatchObject({
      component: "retention-cleanup-worker",
      event: "tick_completed",
      dryRun: true,
      totalCandidates: 3,
      deletedMessages: 0,
    });
    expect(completedLog).not.toContain("123");
    expect(completedLog).not.toContain("456");
  });

  it("requires the explicit execute flag before performing cleanup", async () => {
    process.env.RETENTION_CLEANUP_SCHEDULE_ENABLED = "true";
    process.env.RETENTION_CLEANUP_EXECUTE = "true";
    vi.mocked(runRetentionCleanup).mockResolvedValue({
      ...successResult,
      dryRun: false,
      deletedMessages: 3,
    });

    const stop = startRetentionCleanupWorker();
    await flushDetachedTick();
    stop();

    expect(runRetentionCleanup).toHaveBeenCalledWith({
      dryRun: false,
      createdBy: null,
    });
  });

  it("prevents overlapping cleanup ticks", async () => {
    let resolveCleanup: ((value: typeof successResult) => void) | undefined;
    const runCleanup = vi.fn(
      () =>
        new Promise<typeof successResult>(resolve => {
          resolveCleanup = resolve;
        })
    );
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const stop = startRetentionCleanupWorker({
      enabled: true,
      intervalMs: 1_000,
      runCleanup,
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(runCleanup).toHaveBeenCalledTimes(1);
    expect(String(consoleWarn.mock.calls.at(-1)?.[0])).toContain(
      '"event":"tick_skipped_overlap"'
    );

    resolveCleanup?.(successResult);
    await flushDetachedTick();
    stop();
  });

  it("logs failed results and thrown errors without their private details", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const failedResult = {
      ...successResult,
      failureReason: "postgresql://private@database/medibridge",
    };
    const runCleanup = vi
      .fn()
      .mockResolvedValueOnce(failedResult)
      .mockRejectedValueOnce(new Error("private patient detail"));

    const stop = startRetentionCleanupWorker({
      enabled: true,
      intervalMs: 1_000,
      runCleanup: runCleanup as typeof runRetentionCleanup,
    });
    await flushDetachedTick();
    await vi.advanceTimersByTimeAsync(1_000);
    stop();

    const logs = consoleError.mock.calls
      .map(call => String(call[0]))
      .join("\n");
    expect(logs).toContain('"event":"tick_failed"');
    expect(logs).toContain('"errorName":"Error"');
    expect(logs).not.toContain("private@database");
    expect(logs).not.toContain("private patient detail");
  });

  it("supports delayed startup and stops future ticks", async () => {
    const runCleanup = vi.fn().mockResolvedValue(successResult);
    const stop = startRetentionCleanupWorker({
      enabled: true,
      execute: false,
      intervalMs: 1_000,
      runOnStart: false,
      runCleanup,
    });

    expect(runCleanup).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runCleanup).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runCleanup).toHaveBeenCalledTimes(1);
  });
});
