import { describe, expect, it } from "vitest";
import { getTriageCopy } from "../copy";
import type { TriageResult } from "../hooks/useTriageChat";
import { EMPTY_LIGHT_TRIAGE_RESULT_FORM } from "@shared/triageRouting";
import {
  buildTriageChatViewModel,
  hasLightResultFormContent,
} from "./triageChatViewModel";

type ViewModelInput = Parameters<typeof buildTriageChatViewModel>[0];

const completeResult = (overrides: Partial<TriageResult> = {}): TriageResult =>
  ({
    isComplete: true,
    reply: "Triage complete",
    summary: "Original summary",
    ...overrides,
  }) as TriageResult;

const buildInput = (
  overrides: Partial<ViewModelInput> = {}
): ViewModelInput => ({
  activeSessionId: null,
  historyItems: [],
  historyData: null,
  messages: [{ role: "assistant", content: "How can I help?" }],
  triageResult: null,
  triageSessionId: "",
  resultFormDraft: { ...EMPTY_LIGHT_TRIAGE_RESULT_FORM },
  resolved: "en",
  reportGenerationLocked: false,
  messageLimitReached: false,
  isChatPending: false,
  copy: getTriageCopy("en"),
  ...overrides,
});

describe("triage chat view model", () => {
  it("keeps an active incomplete chat editable", () => {
    const model = buildTriageChatViewModel(buildInput());

    expect(model).toMatchObject({
      isHistoryReadOnly: false,
      displayedTriageSessionId: 0,
      isInputDisabled: false,
      inputPlaceholder: getTriageCopy("en").placeholder,
      activityLabel: null,
      effectiveSummary: getTriageCopy("en").common.no_summary_available,
      showReferralNextStepGuidance: false,
    });
    expect(model.renderedMessages).toEqual([
      { role: "assistant", content: "How can I help?" },
    ]);
    expect(model.primaryReferralEntryHref).toBe("/triage");
  });

  it("maps a completed history session to read-only presentation state", () => {
    const model = buildTriageChatViewModel(
      buildInput({
        activeSessionId: 7,
        historyItems: [
          {
            id: 7,
            title: "History",
            status: "completed",
            group: "today",
          },
        ],
        historyData: {
          messages: [
            { role: "ai", content: "Question" },
            { role: "user", content: "Knee pain" },
            { role: "ai", content: "Final report" },
          ],
          summary: "Stored summary",
          triageResult: completeResult({
            extraction: {
              symptoms: "Knee pain",
              duration: "Two days",
              age: 42,
              gender: "female",
              urgency: "medium",
            },
          }),
        },
      })
    );

    expect(model.isHistoryReadOnly).toBe(true);
    expect(model.displayedTriageSessionId).toBe(7);
    expect(model.isInputDisabled).toBe(true);
    expect(model.inputPlaceholder).toBe(
      getTriageCopy("en").sidebar.read_only_placeholder
    );
    expect(model.renderedMessages).toEqual([
      { role: "assistant", content: "Question" },
      { role: "user", content: "Knee pain" },
    ]);
    expect(model.displayedResultFormDraft).toMatchObject({
      ageGender: "42 / female",
      mainSymptomAndLocation: "Knee pain",
      durationAndOnset: "Two days",
    });
    expect(model.effectiveSummary).toContain(
      "Main Symptom & Location: Knee pain"
    );
  });

  it("builds referral and reduced-confidence guidance from an edited result", () => {
    const resultFormDraft = {
      ...EMPTY_LIGHT_TRIAGE_RESULT_FORM,
      mainSymptomAndLocation: "Knee pain",
    };
    const model = buildTriageChatViewModel(
      buildInput({
        messages: [
          { role: "assistant", content: "Question" },
          { role: "user", content: "Knee pain" },
          { role: "assistant", content: "Final report" },
        ],
        triageResult: completeResult({
          routing: {
            possibilitySummary: "Orthopedic direction",
            recommendedDepartment: {
              zh: "骨科",
              en: "Orthopedics",
              matchedSpecialtyKey: "orthopedics",
            },
            hospitals: [
              {
                hospitalName: "First Hospital",
                city: null,
                specialtyRank: null,
                specialtyScore: null,
                generalGrade: null,
                stemRank: null,
                matchedHospitalId: 11,
                matchedDepartmentId: null,
                reason: "Specialty match",
              },
            ],
            confidence: "reduced",
            missingCriticalFields: ["age", "gender"],
          },
        }),
        triageSessionId: "77",
        resultFormDraft,
      })
    );

    expect(model.renderedMessages).toHaveLength(2);
    expect(model.isInputDisabled).toBe(true);
    expect(model.effectiveSummary).toContain(
      "Main Symptom & Location: Knee pain"
    );
    expect(model.primaryReferralEntryHref).toBe(
      "/referrals/select?triageSessionId=77&rankedHospitalIndex=0&hospitalId=11"
    );
    expect(model.routingSafetyNotice).toEqual({
      title: getTriageCopy("en").triage_card.reduced_confidence_title,
      description:
        "This is a preliminary routing suggestion. Please add age, gender and any related symptoms to improve accuracy.",
    });
    expect(model.showReferralNextStepGuidance).toBe(true);
  });

  it("prioritizes locked and interrupted safety presentation", () => {
    const lockedModel = buildTriageChatViewModel(
      buildInput({ reportGenerationLocked: true, isChatPending: true })
    );
    expect(lockedModel.inputPlaceholder).toBe(
      getTriageCopy("en").status.reviewing
    );
    expect(lockedModel.activityLabel).toBe(
      getTriageCopy("en").status.reviewing
    );
    expect(lockedModel.isInputDisabled).toBe(true);

    const interruptedModel = buildTriageChatViewModel(
      buildInput({
        triageResult: completeResult({
          interrupted: true,
          riskCodes: ["CHEST_PAIN_BREATHING"],
          reply: "Fallback safety message",
        }),
        triageSessionId: "not-a-session",
      })
    );
    expect(interruptedModel.localizedInterruptionDetail).toBe(
      "Your symptoms may indicate an urgent high-risk condition. Please go to the emergency department or contact local emergency services immediately. AI triage will stop here."
    );
    expect(interruptedModel.displayedTriageSessionId).toBe(0);
    expect(interruptedModel.showReferralNextStepGuidance).toBe(false);
    expect(interruptedModel.routingSafetyNotice).toBeNull();
  });

  it("detects whether the editable result form contains meaningful content", () => {
    expect(
      hasLightResultFormContent({ ...EMPTY_LIGHT_TRIAGE_RESULT_FORM })
    ).toBe(false);
    expect(
      hasLightResultFormContent({
        ...EMPTY_LIGHT_TRIAGE_RESULT_FORM,
        otherSymptoms: "  nausea  ",
      })
    ).toBe(true);
  });
});
