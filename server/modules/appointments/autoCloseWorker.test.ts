import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));
vi.mock("./repo", () => ({
  tryTransitionAppointmentById: vi.fn(),
}));

import { getDb } from "../../db";
import * as appointmentsRepo from "./repo";
import { startAppointmentAutoCloseWorker } from "./autoCloseWorker";

function createCandidateDb(candidateIds: number[]) {
  const limit = vi.fn(async () => candidateIds.map(id => ({ id })));
  const having = vi.fn(() => ({ limit }));
  const groupBy = vi.fn(() => ({ having }));
  const where = vi.fn(() => ({ groupBy }));
  const leftJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ leftJoin }));
  const select = vi.fn(() => ({ from }));

  return {
    db: { select } as never,
    query: { select, from, leftJoin, where, groupBy, having, limit },
  };
}

async function flushDetachedTick() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("appointment auto-close worker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T00:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing when storage is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    const createSystemMessage = vi.fn();

    const stop = startAppointmentAutoCloseWorker({
      runOnStart: true,
      createSystemMessage,
    });
    await flushDetachedTick();
    stop();

    expect(getDb).toHaveBeenCalledTimes(1);
    expect(
      appointmentsRepo.tryTransitionAppointmentById
    ).not.toHaveBeenCalled();
    expect(createSystemMessage).not.toHaveBeenCalled();
  });

  it("queries the bounded inactive set and closes only successful transitions", async () => {
    const { db, query } = createCandidateDb([101, 102]);
    vi.mocked(getDb).mockResolvedValue(db);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById)
      .mockResolvedValueOnce({ ok: false } as never)
      .mockResolvedValueOnce({ ok: true } as never);
    const createSystemMessage = vi.fn(async () => undefined);

    const stop = startAppointmentAutoCloseWorker({
      runOnStart: true,
      createSystemMessage,
    });
    await flushDetachedTick();
    stop();

    expect(query.limit).toHaveBeenCalledWith(200);
    expect(
      appointmentsRepo.tryTransitionAppointmentById
    ).toHaveBeenNthCalledWith(1, {
      appointmentId: 101,
      allowedFrom: ["active"],
      toStatus: "ended",
      toPaymentStatus: "paid",
      operatorType: "system",
      reason: "auto_closed_inactive_48h",
      payloadJson: {
        inactivityCutoff: "2026-08-11T00:00:00.000Z",
      },
    });
    expect(
      appointmentsRepo.tryTransitionAppointmentById
    ).toHaveBeenNthCalledWith(2, {
      appointmentId: 102,
      allowedFrom: ["active"],
      toStatus: "ended",
      toPaymentStatus: "paid",
      operatorType: "system",
      reason: "auto_closed_inactive_48h",
      payloadJson: {
        inactivityCutoff: "2026-08-11T00:00:00.000Z",
      },
    });
    expect(createSystemMessage).toHaveBeenCalledTimes(1);
    expect(createSystemMessage).toHaveBeenCalledWith({
      appointmentId: 102,
      senderType: "system",
      content:
        "Consultation auto-closed due to inactivity. 会诊因长时间无活动已自动关闭。",
      originalContent:
        "Consultation auto-closed due to inactivity. 会诊因长时间无活动已自动关闭。",
      translatedContent:
        "Consultation auto-closed due to inactivity. 会诊因长时间无活动已自动关闭。",
      sourceLanguage: "auto",
      targetLanguage: "auto",
      translationProvider: "system",
      createdAt: new Date("2026-08-13T00:00:00.000Z"),
    });
  });

  it("prevents overlapping ticks and releases the guard after completion", async () => {
    let resolveDb: ((value: null) => void) | undefined;
    vi.mocked(getDb).mockImplementation(
      () =>
        new Promise(resolve => {
          resolveDb = resolve;
        })
    );

    const stop = startAppointmentAutoCloseWorker({
      intervalMs: 1_000,
      runOnStart: true,
      createSystemMessage: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(getDb).toHaveBeenCalledTimes(1);

    resolveDb?.(null);
    await flushDetachedTick();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getDb).toHaveBeenCalledTimes(2);

    resolveDb?.(null);
    await flushDetachedTick();
    stop();
  });

  it("honors delayed startup and cancels the interval idempotently", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    const stop = startAppointmentAutoCloseWorker({
      intervalMs: 1_000,
      runOnStart: false,
      createSystemMessage: vi.fn(),
    });
    expect(getDb).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(getDb).toHaveBeenCalledTimes(1);

    stop();
    stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getDb).toHaveBeenCalledTimes(1);
  });
});
