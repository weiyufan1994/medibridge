import { describe, expect, it } from "vitest";
import {
  applyConsultationFreeExtensionToNotes,
  resolveConsultationTimerState,
} from "./modules/appointments/consultationTimer";

describe("consultationTimer", () => {
  it("reads base package duration and extension from notes", () => {
    const timer = resolveConsultationTimerState(
      JSON.stringify({
        packageDurationMinutes: 60,
        timerExtensionMinutes: 5,
      })
    );

    expect(timer).toEqual({
      baseDurationMinutes: 60,
      extensionMinutes: 5,
      totalDurationMinutes: 65,
      hasUsedFreeExtension: true,
    });
  });

  it("falls back to 30 minutes when notes are missing or invalid", () => {
    expect(resolveConsultationTimerState(null)).toMatchObject({
      baseDurationMinutes: 30,
      extensionMinutes: 0,
      totalDurationMinutes: 30,
      hasUsedFreeExtension: false,
    });
    expect(resolveConsultationTimerState("{not-json")).toMatchObject({
      baseDurationMinutes: 30,
      extensionMinutes: 0,
      totalDurationMinutes: 30,
      hasUsedFreeExtension: false,
    });
  });

  it("applies free extension once and rejects second extension", () => {
    const first = applyConsultationFreeExtensionToNotes({
      notes: JSON.stringify({ packageDurationMinutes: 30 }),
      extensionMinutes: 5,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.timer).toMatchObject({
      baseDurationMinutes: 30,
      extensionMinutes: 5,
      totalDurationMinutes: 35,
      hasUsedFreeExtension: true,
    });

    const second = applyConsultationFreeExtensionToNotes({
      notes: first.nextNotes,
      extensionMinutes: 5,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe("already_used");
    }
  });
});
