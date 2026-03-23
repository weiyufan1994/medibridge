import { describe, expect, it } from "vitest";
import { getVisitCopy } from "@/features/visit/copy";
import { buildVisitRoomPresentation } from "@/features/visit/hooks/useVisitRoomPresentation";

describe("buildVisitRoomPresentation", () => {
  it("computes doctor view fields and filters empty intake rows", () => {
    const t = getVisitCopy("en");
    const result = buildVisitRoomPresentation({
      resolved: "en",
      t,
      now: new Date("2026-03-01T08:00:00.000Z"),
      appointment: {
        role: "patient",
        status: "paid",
        triageSummary: "Possible URI",
        intake: {
          chiefComplaint: "cough",
          duration: "  ",
          allergies: "penicillin",
        },
      },
      doctorData: {
        doctor: {
          name: { zh: "张医生", en: "Dr. Zhang" },
          title: { zh: "主任医师", en: "Chief Physician" },
        },
        department: { name: { zh: "内科", en: "Internal Medicine" } },
      },
      role: "doctor",
      currentStatus: "active",
      timerStatus: "normal",
      canSendMessage: true,
      isSending: false,
      pollingFatalError: null,
    });

    expect(result.isDoctorView).toBe(true);
    expect(result.effectiveCanSendMessage).toBe(true);
    expect(result.doctorName).toBe("Dr. Zhang");
    expect(result.departmentName).toBe("Internal Medicine");
    expect(result.doctorTitleDisplay).toBe("Chief Physician");
    expect(result.composerDisabled).toBe(false);
    expect(result.consultationLiveText).toBe(t.consultationLive);
    expect(result.doctorWorkbenchTitle).toBe(t.doctorWorkbenchTitle);
    expect(result.triageSidebarTitle).toBe(t.triageSidebarTitle);
    expect(result.triageRecommendationTitle).toBe(t.triageRecommendationTitle);
    expect(result.intakeItems).toEqual([
      { label: t.intakeChiefComplaint, value: "cough" },
      { label: t.intakeAllergies, value: "penicillin" },
    ]);
    expect(result.hasTriageData).toBe(true);
  });

  it("forces read-only behavior when appointment ended and keeps localized fallbacks", () => {
    const t = getVisitCopy("zh");
    const result = buildVisitRoomPresentation({
      resolved: "zh",
      t,
      now: new Date("2026-03-01T08:00:00.000Z"),
      appointment: {
        role: "patient",
        status: "ended",
        triageSummary: "   ",
        intake: null,
      },
      doctorData: null,
      role: null,
      currentStatus: "ended",
      timerStatus: "normal",
      canSendMessage: true,
      isSending: false,
      pollingFatalError: "TOKEN_EXPIRED",
    });

    expect(result.isDoctorView).toBe(false);
    expect(result.roomClosedByStatus).toBe(true);
    expect(result.effectiveCanSendMessage).toBe(false);
    expect(result.composerDisabled).toBe(true);
    expect(result.composerHint).toBe(t.composerReadOnlyHint);
    expect(result.doctorName).toBe(t.assignedDoctorFallback);
    expect(result.departmentName).toBe(t.departmentFallback);
    expect(result.hasTriageData).toBe(false);
  });

  it("treats completed as read-only status", () => {
    const t = getVisitCopy("en");
    const result = buildVisitRoomPresentation({
      resolved: "en",
      t,
      now: new Date("2026-03-01T08:00:00.000Z"),
      appointment: {
        role: "doctor",
        status: "completed",
        triageSummary: null,
        intake: null,
      },
      doctorData: null,
      role: "doctor",
      currentStatus: "completed",
      timerStatus: "normal",
      canSendMessage: true,
      isSending: false,
      pollingFatalError: null,
    });

    expect(result.roomClosedByStatus).toBe(true);
    expect(result.effectiveCanSendMessage).toBe(false);
    expect(result.composerHint).toBe(t.composerReadOnlyHint);
  });

  it("shows time-exceeded status text when timer expires", () => {
    const t = getVisitCopy("zh");
    const result = buildVisitRoomPresentation({
      resolved: "zh",
      t,
      now: new Date("2026-03-01T08:00:00.000Z"),
      appointment: {
        role: "doctor",
        status: "active",
        triageSummary: null,
        intake: null,
      },
      doctorData: null,
      role: "doctor",
      currentStatus: "active",
      timerStatus: "expired",
      canSendMessage: true,
      isSending: false,
      pollingFatalError: null,
    });

    expect(result.consultationLiveText).toBe(t.consultationTimeExceeded);
  });

  it("treats currentStatus completed as room-closed even when appointment status lags", () => {
    const t = getVisitCopy("en");
    const result = buildVisitRoomPresentation({
      resolved: "en",
      t,
      now: new Date("2026-03-01T08:00:00.000Z"),
      appointment: {
        role: "patient",
        status: "active",
        triageSummary: null,
        intake: null,
      },
      doctorData: null,
      role: "patient",
      currentStatus: "completed",
      timerStatus: "expired",
      canSendMessage: true,
      isSending: false,
      pollingFatalError: null,
    });

    expect(result.roomClosedByStatus).toBe(true);
    expect(result.consultationLiveText).toBe(t.consultationEnded);
  });
});
