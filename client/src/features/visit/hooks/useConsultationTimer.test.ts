import { describe, expect, it } from "vitest";
import {
  computeConsultationTimerState,
  didTransitionToExpired,
} from "@/features/visit/hooks/useConsultationTimer";

describe("consultation timer", () => {
  const scheduledAt = new Date("2026-03-01T10:00:00.000Z");

  it("returns normal when remaining time is greater than 5 minutes", () => {
    const timer = computeConsultationTimerState({
      now: new Date("2026-03-01T10:10:00.000Z"),
      scheduledAt,
      baseDurationMinutes: 30,
      extensionMinutes: 0,
    });

    expect(timer.status).toBe("normal");
    expect(timer.remainingSeconds).toBe(20 * 60);
    expect(timer.remainingLabel).toBe("20:00");
  });

  it("returns warning when remaining time is within 5 minutes", () => {
    const timer = computeConsultationTimerState({
      now: new Date("2026-03-01T10:25:01.000Z"),
      scheduledAt,
      baseDurationMinutes: 30,
      extensionMinutes: 0,
    });

    expect(timer.status).toBe("warning");
    expect(timer.remainingSeconds).toBe(299);
    expect(timer.remainingLabel).toBe("04:59");
  });

  it("returns expired when remaining time is zero or below", () => {
    const timer = computeConsultationTimerState({
      now: new Date("2026-03-01T10:30:00.000Z"),
      scheduledAt,
      baseDurationMinutes: 30,
      extensionMinutes: 0,
    });

    expect(timer.status).toBe("expired");
    expect(timer.remainingSeconds).toBe(0);
    expect(timer.remainingLabel).toBe("00:00");
  });

  it("supports extension from expired back to warning/normal range", () => {
    const timer = computeConsultationTimerState({
      now: new Date("2026-03-01T10:31:00.000Z"),
      scheduledAt,
      baseDurationMinutes: 30,
      extensionMinutes: 5,
    });

    expect(timer.status).toBe("warning");
    expect(timer.remainingLabel).toBe("04:00");
  });

  it("does not exceed total duration before scheduled start time", () => {
    const timer = computeConsultationTimerState({
      now: new Date("2026-03-01T09:30:00.000Z"),
      scheduledAt,
      baseDurationMinutes: 30,
      extensionMinutes: 0,
    });

    expect(timer.status).toBe("normal");
    expect(timer.remainingSeconds).toBe(30 * 60);
    expect(timer.remainingLabel).toBe("30:00");
  });

  it("detects transition into expired only on boundary crossing", () => {
    expect(didTransitionToExpired("warning", "expired")).toBe(true);
    expect(didTransitionToExpired("normal", "expired")).toBe(true);
    expect(didTransitionToExpired("expired", "expired")).toBe(false);
    expect(didTransitionToExpired("warning", "warning")).toBe(false);
  });
});
