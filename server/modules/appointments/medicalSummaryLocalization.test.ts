import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({ invokeLLM: vi.fn() }));

import { invokeLLM } from "../../_core/llm";
import { localizeMedicalSummaryContent } from "./medicalSummaryLocalization";

const englishSummary = {
  chiefComplaint: "Cough",
  historyOfPresentIllness: "Cough for three days",
  pastMedicalHistory: "Hypertension",
  assessmentDiagnosis: "Upper respiratory infection",
  planRecommendations: "Rest and hydrate",
};

const chineseSummary = {
  chiefComplaint: "咳嗽",
  historyOfPresentIllness: "咳嗽三天",
  pastMedicalHistory: "高血压",
  assessmentDiagnosis: "上呼吸道感染",
  planRecommendations: "休息并补充水分",
};

function llmResponse(content: unknown) {
  return {
    id: "mock",
    created: Date.now(),
    model: "mock-model",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content },
      },
    ],
  } as never;
}

describe("medical summary localization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes content and skips translation when it matches the target", async () => {
    const result = await localizeMedicalSummaryContent({
      summary: {
        ...englishSummary,
        chiefComplaint: "  Cough  ",
        planRecommendations: "  Rest and hydrate  ",
      },
      targetLang: "en",
    });

    expect(result).toEqual(englishSummary);
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("translates to English once and reuses the safely merged cache entry", async () => {
    const localized = {
      ...englishSummary,
      chiefComplaint: "Unique English cough",
    };
    vi.mocked(invokeLLM).mockResolvedValue(
      llmResponse(JSON.stringify(localized))
    );
    const input = {
      ...chineseSummary,
      chiefComplaint: "缓存测试咳嗽",
    };

    await expect(
      localizeMedicalSummaryContent({ summary: input, targetLang: "en" })
    ).resolves.toEqual(localized);
    await expect(
      localizeMedicalSummaryContent({ summary: input, targetLang: "en" })
    ).resolves.toEqual(localized);

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTokens: 1200,
        responseFormat: { type: "text" },
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("natural English"),
          }),
          { role: "user", content: JSON.stringify(input) },
        ],
      })
    );
  });

  it("combines text response parts and safely translates into Chinese", async () => {
    const translated = {
      chiefComplaint: "咳嗽",
      historyOfPresentIllness: "咳嗽三天",
      pastMedicalHistory: "高血压",
      assessmentDiagnosis: "上呼吸道感染",
      planRecommendations: "休息并补充水分",
    };
    const serialized = JSON.stringify(translated);
    vi.mocked(invokeLLM).mockResolvedValue(
      llmResponse([
        null,
        { type: "image", text: "ignored" },
        { type: "text", text: serialized.slice(0, 40) },
        { type: "text", text: serialized.slice(40) },
      ])
    );

    await expect(
      localizeMedicalSummaryContent({
        summary: {
          ...englishSummary,
          chiefComplaint: "Unique array response cough",
        },
        targetLang: "zh",
      })
    ).resolves.toEqual(translated);

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: expect.stringContaining("自然中文"),
          }),
          expect.any(Object),
        ],
      })
    );
  });

  it("rejects unusable translated fields without leaking Chinese into English", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(
      llmResponse(
        JSON.stringify({
          chiefComplaint: "仍然是中文",
          historyOfPresentIllness: "Valid English history",
          pastMedicalHistory: 123,
          assessmentDiagnosis: null,
          planRecommendations: "Valid English plan",
        })
      )
    );

    const result = await localizeMedicalSummaryContent({
      summary: {
        ...chineseSummary,
        chiefComplaint: "字段安全测试咳嗽",
      },
      targetLang: "en",
    });

    expect(result).toEqual({
      chiefComplaint: "",
      historyOfPresentIllness: "Valid English history",
      pastMedicalHistory: "",
      assessmentDiagnosis: "",
      planRecommendations: "Valid English plan",
    });
    expect(JSON.stringify(result)).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("uses the language-safe fallback for empty and non-object responses", async () => {
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(llmResponse({ unexpected: true }))
      .mockResolvedValueOnce(llmResponse(JSON.stringify("not-an-object")));

    const englishFallback = await localizeMedicalSummaryContent({
      summary: {
        ...chineseSummary,
        chiefComplaint: "空响应测试咳嗽",
      },
      targetLang: "en",
    });
    const chineseFallback = await localizeMedicalSummaryContent({
      summary: {
        ...englishSummary,
        chiefComplaint: "Non-object response cough",
      },
      targetLang: "zh",
    });

    expect(englishFallback).toEqual({
      chiefComplaint: "",
      historyOfPresentIllness: "",
      pastMedicalHistory: "",
      assessmentDiagnosis: "",
      planRecommendations: "",
    });
    expect(chineseFallback).toEqual({
      ...englishSummary,
      chiefComplaint: "Non-object response cough",
    });
  });

  it("bounds the in-memory translation cache and evicts its oldest entry", async () => {
    vi.mocked(invokeLLM).mockImplementation(async request => {
      const source = JSON.parse(
        String(request.messages[1]?.content)
      ) as typeof chineseSummary;
      return llmResponse(
        JSON.stringify({
          ...englishSummary,
          chiefComplaint: `Translated ${source.chiefComplaint}`,
        })
      );
    });

    for (let index = 0; index <= 200; index += 1) {
      await localizeMedicalSummaryContent({
        summary: {
          ...chineseSummary,
          chiefComplaint: `缓存上限测试 ${index}`,
        },
        targetLang: "en",
      });
    }
    await localizeMedicalSummaryContent({
      summary: {
        ...chineseSummary,
        chiefComplaint: "缓存上限测试 0",
      },
      targetLang: "en",
    });

    expect(invokeLLM).toHaveBeenCalledTimes(202);
  });
});
