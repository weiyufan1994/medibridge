import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import { localizeTriageContent } from "./accessQueryActions";

describe("access query triage localization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
