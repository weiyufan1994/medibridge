import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import { localizeTriageContent } from "./accessQueryActions";

describe("access query triage localization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips llm when summary and intake already match target language", async () => {
    const localized = await localizeTriageContent({
      summary: "67-year-old male; intermittent headache for 2 months.",
      intake: {
        chiefComplaint: "headache",
        duration: "2 months",
        medicalHistory: "hypertension",
      },
      targetLang: "en",
    });

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(localized).toEqual({
      summary: "67-year-old male; intermittent headache for 2 months.",
      intake: {
        chiefComplaint: "headache",
        duration: "2 months",
        medicalHistory: "hypertension",
      },
    });
  });

  it("translates summary and intake together to avoid mixed-language output", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "mock",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify({
              summary:
                "67-year-old male; intermittent headache for 2 months; history of hypertension",
              intake: {
                chiefComplaint: "intermittent headache and dizziness",
                duration: "2 months",
                medicalHistory: "hypertension",
                medications: "nifedipine",
                allergies: "",
                ageGroup: "67",
                otherSymptoms: "",
              },
            }),
          },
        },
      ],
    } as never);

    const localized = await localizeTriageContent({
      summary: "67岁男性；间歇性头痛2个月；高血压病史",
      intake: {
        chiefComplaint: "间歇性头痛伴偶发头晕",
        duration: "2个月",
        medicalHistory: "高血压",
        medications: "硝苯地平",
        allergies: "",
        ageGroup: "67",
        otherSymptoms: "",
      },
      targetLang: "en",
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(localized.summary).toContain("67-year-old male");
    expect(localized.intake).toMatchObject({
      chiefComplaint: "intermittent headache and dizziness",
      medications: "nifedipine",
    });
  });

  it("filters unsafe english fallback for summary and intake when translation is unavailable", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "mock",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: "",
          },
        },
      ],
    } as never);

    const localized = await localizeTriageContent({
      summary: "67岁男性；间歇性头痛2个月；高血压病史",
      intake: {
        chiefComplaint: "间歇性头痛",
        duration: "2 months",
        medicalHistory: "高血压",
      },
      targetLang: "en",
      englishFallbackMode: "empty",
    });

    expect(localized).toEqual({
      summary: null,
      intake: {
        chiefComplaint: "",
        duration: "2 months",
        medicalHistory: "",
      },
    });
  });

  it("logs localization failures without exposing medical content", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(
      new Error("private diagnosis and medication detail")
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const localized = await localizeTriageContent({
      summary: "患者的专用本地化失败测试摘要",
      intake: { chiefComplaint: "专用测试症状" },
      targetLang: "en",
    });

    expect(localized).toEqual({
      summary: "患者的专用本地化失败测试摘要",
      intake: { chiefComplaint: "专用测试症状" },
    });
    expect(consoleWarn).toHaveBeenCalledOnce();
    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "appointment-access-query",
      event: "triage_localization_failed",
      targetLang: "en",
      errorName: "Error",
    });
    expect(logged).not.toContain("private diagnosis and medication detail");
    expect(logged).not.toContain("患者");
    expect(logged).not.toContain("症状");
  });
});
