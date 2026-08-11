import { describe, expect, it } from "vitest";
import { getTriageCopy } from "../copy";
import {
  detectTriageLanguage,
  getInitialAssistantMessage,
  getLocalizedDraftMessages,
  isSessionAccessDeniedError,
  normalizeRouting,
  normalizeTriageResponse,
  shouldRefreshInitialAssistantMessage,
} from "./triageChatNormalization";

describe("triage chat normalization", () => {
  it("localizes only an empty or untouched initial draft", () => {
    const initialEnglish = getInitialAssistantMessage("en");
    expect(initialEnglish).toEqual({
      role: "assistant",
      content: getTriageCopy("en").initialAssistantMessage,
    });
    expect(shouldRefreshInitialAssistantMessage([initialEnglish])).toBe(true);
    expect(getLocalizedDraftMessages(undefined, "zh")).toEqual([
      getInitialAssistantMessage("zh"),
    ]);
    expect(getLocalizedDraftMessages([], "en")).toEqual([initialEnglish]);
    expect(getLocalizedDraftMessages([initialEnglish], "zh")).toEqual([
      getInitialAssistantMessage("zh"),
    ]);

    const conversation = [
      initialEnglish,
      { role: "user" as const, content: "Knee pain" },
    ];
    expect(getLocalizedDraftMessages(conversation, "zh")).toBe(conversation);
    expect(shouldRefreshInitialAssistantMessage(conversation)).toBe(false);
  });

  it("detects the input language and exact session-access denial", () => {
    expect(detectTriageLanguage("knee pain")).toBe("en");
    expect(detectTriageLanguage("膝盖 pain")).toBe("zh");

    const denied = {
      data: { code: "FORBIDDEN" },
      message: "not allowed to access this triage session",
    } as Parameters<typeof isSessionAccessDeniedError>[0];
    expect(isSessionAccessDeniedError(denied)).toBe(true);
    expect(
      isSessionAccessDeniedError({
        ...denied,
        message: "another forbidden error",
      })
    ).toBe(false);
    expect(
      isSessionAccessDeniedError({
        ...denied,
        data: { code: "BAD_REQUEST" },
      } as Parameters<typeof isSessionAccessDeniedError>[0])
    ).toBe(false);
  });

  it("normalizes complete routing data and drops malformed hospitals", () => {
    expect(
      normalizeRouting({
        possibilitySummary: "Orthopedic direction",
        recommendedDepartment: {
          zh: "骨科",
          en: "Orthopedics",
          matchedSpecialtyKey: "orthopedics",
        },
        hospitals: [
          {
            hospitalName: "First Hospital",
            city: "Shanghai",
            specialtyRank: 1,
            specialtyScore: 99,
            generalGrade: "A",
            stemRank: 2,
            matchedHospitalId: 11,
            matchedDepartmentId: 12,
            reason: "Specialty match",
          },
          null,
          { hospitalName: "Missing reason" },
        ],
        confidence: "reduced",
        missingCriticalFields: ["age", "gender", "unsupported"],
      })
    ).toEqual({
      possibilitySummary: "Orthopedic direction",
      recommendedDepartment: {
        zh: "骨科",
        en: "Orthopedics",
        matchedSpecialtyKey: "orthopedics",
      },
      hospitals: [
        {
          hospitalName: "First Hospital",
          city: "Shanghai",
          specialtyRank: 1,
          specialtyScore: 99,
          generalGrade: "A",
          stemRank: 2,
          matchedHospitalId: 11,
          matchedDepartmentId: 12,
          reason: "Specialty match",
        },
      ],
      confidence: "reduced",
      missingCriticalFields: ["age", "gender"],
    });
  });

  it("applies routing defaults and rejects invalid routing shapes", () => {
    expect(normalizeRouting(null)).toBeUndefined();
    expect(
      normalizeRouting({ possibilitySummary: "Missing department" })
    ).toBeUndefined();
    expect(
      normalizeRouting({
        possibilitySummary: "Direction",
        recommendedDepartment: { zh: "骨科" },
      })
    ).toBeUndefined();
    expect(
      normalizeRouting({
        possibilitySummary: "Direction",
        recommendedDepartment: { zh: "骨科", en: "Orthopedics" },
      })
    ).toEqual({
      possibilitySummary: "Direction",
      recommendedDepartment: {
        zh: "骨科",
        en: "Orthopedics",
        matchedSpecialtyKey: null,
      },
      hospitals: [],
      confidence: "standard",
      missingCriticalFields: [],
    });
  });

  it("normalizes a rich AI response without changing valid values", () => {
    const normalized = normalizeTriageResponse({
      value: {
        isComplete: false,
        reply: "  Reviewing your triage details  ",
        interrupted: true,
        riskCodes: ["RISK", "", 7],
        interruptionMessage: { zh: "请急诊", en: "Seek emergency care" },
        summary: "  Knee pain summary  ",
        keywords: ["knee", "", null],
        routing: {
          possibilitySummary: "Orthopedic direction",
          recommendedDepartment: { zh: "骨科", en: "Orthopedics" },
        },
        extraction: {
          symptoms: "Knee pain",
          duration: "Two days",
          age: 42,
          gender: " female ",
          medicalHistory: " ",
          traumaOrSurgery: " surgery ",
          otherSymptoms: 9,
          urgency: "medium",
        },
      },
      fallbackReply: "Fallback",
      messagesBeforeReply: [{ role: "user", content: "Knee pain" }],
    });

    expect(normalized.safeReply).toBe("Reviewing your triage details");
    expect(normalized.hitMessageLimit).toBe(false);
    expect(normalized.reportGenerationLocked).toBe(true);
    expect(normalized.result).toMatchObject({
      isComplete: false,
      reply: "Reviewing your triage details",
      interrupted: true,
      riskCodes: ["RISK"],
      interruptionMessage: { zh: "请急诊", en: "Seek emergency care" },
      summary: "Knee pain summary",
      keywords: ["knee"],
      extraction: {
        symptoms: "Knee pain",
        duration: "Two days",
        age: 42,
        gender: "female",
        medicalHistory: null,
        traumaOrSurgery: "surgery",
        otherSymptoms: null,
        urgency: "medium",
      },
    });
    expect(normalized.result.routing?.confidence).toBe("standard");
  });

  it("uses fallbacks and drops malformed optional response fields", () => {
    const normalized = normalizeTriageResponse({
      value: {
        isComplete: true,
        reply: " ",
        hitMessageLimit: true,
        riskCodes: "not-an-array",
        interruptionMessage: { zh: "missing English" },
        summary: 7,
        keywords: "not-an-array",
        routing: "invalid",
        extraction: {
          symptoms: "Knee pain",
          duration: "Two days",
          urgency: "urgent",
        },
      },
      fallbackReply: "Fallback reply",
      messagesBeforeReply: [],
    });

    expect(normalized).toMatchObject({
      safeReply: "Fallback reply",
      hitMessageLimit: true,
      reportGenerationLocked: false,
      result: {
        isComplete: true,
        reply: "Fallback reply",
        interrupted: false,
        riskCodes: undefined,
        interruptionMessage: undefined,
        summary: undefined,
        keywords: undefined,
        routing: undefined,
        extraction: undefined,
      },
    });
  });

  it("recognizes the legacy maximum-depth reply", () => {
    const reply =
      "本次基础问诊已达最大深度。由于病情可能较为复杂，AI 无法继续细分，请尽快查看推荐专科和医院并线下就诊。";
    const normalized = normalizeTriageResponse({
      value: { isComplete: false, reply },
      fallbackReply: "Fallback",
      messagesBeforeReply: [],
    });

    expect(normalized.hitMessageLimit).toBe(true);
    expect(normalized.result.reply).toBe(reply);
  });
});
