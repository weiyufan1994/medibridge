import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "../../db";
import {
  getVisitSummaryByAppointmentId,
  upsertVisitSummary,
} from "./visitSummaryRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

function buildExecutor(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const onConflictDoUpdate = vi.fn(async () => undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));

  return {
    executor: { select, insert },
    insert,
    limit,
    onConflictDoUpdate,
    values,
  };
}

describe("admin visit summary repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the first persisted summary and limits the lookup", async () => {
    const summary = {
      appointmentId: 701,
      summaryZh: "中文摘要",
      summaryEn: "English summary",
      source: "llm",
    };
    const { executor, limit } = buildExecutor([
      summary,
      { appointmentId: 702 },
    ]);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(getVisitSummaryByAppointmentId(701)).resolves.toEqual(summary);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("returns null when no summary is persisted", async () => {
    const { executor } = buildExecutor([]);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(getVisitSummaryByAppointmentId(703)).resolves.toBeNull();
  });

  it("upserts all summary fields and returns the stored row", async () => {
    const stored = {
      appointmentId: 704,
      summaryZh: "会诊摘要",
      summaryEn: "Consultation summary",
      source: "fallback",
      generatedBy: 19,
    };
    const { executor, insert, onConflictDoUpdate, values } = buildExecutor([
      stored,
    ]);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(upsertVisitSummary(stored)).resolves.toEqual(stored);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(stored);
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.anything(),
        set: {
          summaryZh: stored.summaryZh,
          summaryEn: stored.summaryEn,
          source: stored.source,
          generatedBy: stored.generatedBy,
          updatedAt: expect.any(Date),
        },
      })
    );
    expect(getDb).toHaveBeenCalledTimes(2);
  });

  it("normalizes an omitted generator to null on insert and update", async () => {
    const input = {
      appointmentId: 705,
      summaryZh: "中文摘要",
      summaryEn: "English summary",
      source: "llm" as const,
    };
    const { executor, onConflictDoUpdate, values } = buildExecutor([]);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(upsertVisitSummary(input)).resolves.toBeNull();
    expect(values).toHaveBeenCalledWith({ ...input, generatedBy: null });
    expect(onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: expect.objectContaining({ generatedBy: null }),
      })
    );
  });

  it("rejects reads and writes when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(getVisitSummaryByAppointmentId(706)).rejects.toThrow(
      "Database not available"
    );
    await expect(
      upsertVisitSummary({
        appointmentId: 706,
        summaryZh: "中文摘要",
        summaryEn: "English summary",
        source: "fallback",
      })
    ).rejects.toThrow("Database not available");
  });

  it("propagates persistence failures without returning a stale summary", async () => {
    const { executor, onConflictDoUpdate } = buildExecutor([]);
    onConflictDoUpdate.mockRejectedValue(new Error("write failed"));
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(
      upsertVisitSummary({
        appointmentId: 707,
        summaryZh: "中文摘要",
        summaryEn: "English summary",
        source: "fallback",
      })
    ).rejects.toThrow("write failed");
    expect(getDb).toHaveBeenCalledTimes(1);
  });
});
