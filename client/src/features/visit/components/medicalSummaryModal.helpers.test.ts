import { describe, expect, it } from "vitest";
import {
  formatCountdown,
  isDraftFormComplete,
  resolveGeneratingMessage,
  shouldApplyDraftResponse,
  shouldAutoLoadInitialDraft,
  type MedicalSummaryDraftForm,
} from "@/features/visit/components/medicalSummaryModal.helpers";

function makeForm(overrides?: Partial<MedicalSummaryDraftForm>): MedicalSummaryDraftForm {
  return {
    chiefComplaint: "cough",
    historyOfPresentIllness: "started 3 days ago",
    pastMedicalHistory: "none",
    assessmentDiagnosis: "URI",
    planRecommendations: "rest and hydration",
    ...overrides,
  };
}

describe("medicalSummaryModal helpers", () => {
  it("formats countdown as mm:ss", () => {
    expect(formatCountdown(120)).toBe("02:00");
    expect(formatCountdown(61)).toBe("01:01");
    expect(formatCountdown(0)).toBe("00:00");
  });

  it("resolves generating status with countdown template", () => {
    const message = resolveGeneratingMessage({
      fallbackText: "Generating...",
      countdownTemplate: "Generating... ({{time}} left)",
      remainingSeconds: 97,
    });

    expect(message).toBe("Generating... (01:37 left)");
  });

  it("shouldAutoLoadInitialDraft only on first open", () => {
    expect(shouldAutoLoadInitialDraft({ open: true, hasLoadedInitialDraft: false })).toBe(
      true
    );
    expect(shouldAutoLoadInitialDraft({ open: true, hasLoadedInitialDraft: true })).toBe(
      false
    );
    expect(shouldAutoLoadInitialDraft({ open: false, hasLoadedInitialDraft: false })).toBe(
      false
    );
  });

  it("shouldApplyDraftResponse ignores stale or timed-out responses", () => {
    expect(
      shouldApplyDraftResponse({
        requestId: 2,
        activeRequestId: 2,
        draftTimedOut: false,
      })
    ).toBe(true);
    expect(
      shouldApplyDraftResponse({
        requestId: 1,
        activeRequestId: 2,
        draftTimedOut: false,
      })
    ).toBe(false);
    expect(
      shouldApplyDraftResponse({
        requestId: 2,
        activeRequestId: 2,
        draftTimedOut: true,
      })
    ).toBe(false);
  });

  it("validates required sections before signing", () => {
    expect(isDraftFormComplete(makeForm())).toBe(true);
    expect(isDraftFormComplete(makeForm({ chiefComplaint: " " }))).toBe(false);
  });
});
