import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import {
  localizeTriageContent,
  parseIntakeFromNotes,
  translateTriageSummary,
} from "./accessQueryActions";

function createLlmResponse(content: unknown) {
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

  it("normalizes blank content without invoking the llm", async () => {
    await expect(
      localizeTriageContent({
        summary: "   ",
        intake: { chiefComplaint: "   ", duration: undefined },
        targetLang: "en",
      })
    ).resolves.toEqual({
      summary: null,
      intake: { chiefComplaint: "", duration: undefined },
    });

    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("reads segmented assistant text and translates english content to chinese", async () => {
    const translated = JSON.stringify({
      summary: "持续头痛两天",
      intake: {
        chiefComplaint: "头痛",
        duration: "两天",
        additionalField: "新增字段",
        ignoredNumber: 2,
      },
    });
    vi.mocked(invokeLLM).mockResolvedValue(
      createLlmResponse([
        { type: "image", image_url: "ignored" },
        { type: "text", text: translated.slice(0, 20) },
        { type: "text", text: translated.slice(20) },
      ])
    );

    const localized = await localizeTriageContent({
      summary: "Headache for two days",
      intake: {
        chiefComplaint: "headache",
        duration: "two days",
        ageGroup: "67",
      },
      targetLang: "zh",
    });

    expect(localized).toEqual({
      summary: "持续头痛两天",
      intake: {
        chiefComplaint: "头痛",
        duration: "两天",
        ageGroup: "67",
        additionalField: "新增字段",
      },
    });
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("翻译成自然中文"),
          }),
        ]),
      })
    );
  });

  it("uses a cached translation without a second llm request", async () => {
    const input = {
      summary: "缓存专用中文摘要",
      intake: { chiefComplaint: "缓存专用症状" },
      targetLang: "en" as const,
    };
    vi.mocked(invokeLLM).mockResolvedValue(
      createLlmResponse(
        JSON.stringify({
          summary: "Cache-specific summary",
          intake: { chiefComplaint: "Cache-specific symptom" },
        })
      )
    );

    await expect(localizeTriageContent(input)).resolves.toEqual({
      summary: "Cache-specific summary",
      intake: { chiefComplaint: "Cache-specific symptom" },
    });
    vi.mocked(invokeLLM).mockClear();

    await expect(localizeTriageContent(input)).resolves.toEqual({
      summary: "Cache-specific summary",
      intake: { chiefComplaint: "Cache-specific symptom" },
    });
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("rejects unsafe translated values under the english empty fallback", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(
      createLlmResponse(
        JSON.stringify({
          summary: "仍然是中文摘要",
          intake: {
            chiefComplaint: "仍然是中文症状",
            duration: "three days",
          },
        })
      )
    );

    await expect(
      localizeTriageContent({
        summary: "原始中文摘要",
        intake: {
          chiefComplaint: "原始中文症状",
          duration: "3 days",
        },
        targetLang: "en",
        englishFallbackMode: "empty",
      })
    ).resolves.toEqual({
      summary: null,
      intake: { chiefComplaint: "", duration: "3 days" },
    });
  });

  it("falls back safely when the assistant response is malformed", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(
      createLlmResponse({ unexpected: "non-text response" })
    );

    await expect(
      localizeTriageContent({
        summary: "畸形响应专用摘要",
        intake: null,
        targetLang: "en",
        englishFallbackMode: "empty",
      })
    ).resolves.toEqual({ summary: null, intake: null });

    vi.mocked(invokeLLM).mockResolvedValue(createLlmResponse("not valid json"));
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      localizeTriageContent({
        summary: "无效 JSON 专用摘要",
        intake: { chiefComplaint: "无效 JSON 专用症状" },
        targetLang: "en",
        englishFallbackMode: "empty",
      })
    ).resolves.toEqual({
      summary: null,
      intake: { chiefComplaint: "" },
    });
    expect(JSON.parse(String(consoleWarn.mock.calls[0]?.[0]))).toMatchObject({
      errorName: "SyntaxError",
    });
  });

  it("labels non-error llm failures without leaking their value", async () => {
    vi.mocked(invokeLLM).mockRejectedValue("private raw failure");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await localizeTriageContent({
      summary: "非异常失败专用摘要",
      intake: null,
      targetLang: "en",
    });

    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({ errorName: "UnknownError" });
    expect(logged).not.toContain("private raw failure");
  });

  it("translates a summary through the convenience helper", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(
      createLlmResponse(
        JSON.stringify({ summary: "Localized helper summary", intake: null })
      )
    );

    await expect(
      translateTriageSummary("便捷函数专用摘要", "en")
    ).resolves.toBe("Localized helper summary");
  });

  it.each([null, undefined, "", "   ", "not-json"])(
    "returns null for unusable notes %s",
    notes => {
      const safeParse = vi.fn();

      expect(parseIntakeFromNotes(notes, safeParse)).toBeNull();
      if (!notes?.trim()) {
        expect(safeParse).not.toHaveBeenCalled();
      }
    }
  );

  it("requires safe parsing and at least one non-empty intake field", () => {
    expect(
      parseIntakeFromNotes('{"chiefComplaint":"headache"}', () => ({
        success: false,
      }))
    ).toBeNull();
    expect(
      parseIntakeFromNotes('{"chiefComplaint":"   ","age":67}', () => ({
        success: true,
        data: { chiefComplaint: "   ", age: 67 },
      }))
    ).toBeNull();

    const intake = { chiefComplaint: " headache ", age: 67 };
    expect(
      parseIntakeFromNotes(JSON.stringify(intake), parsed => ({
        success: true,
        data: parsed as typeof intake,
      }))
    ).toEqual(intake);
  });
});
