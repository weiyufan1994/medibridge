import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import { translateVisitMessage } from "./translation";

describe("visit translation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns identity translation when source and target are the same", async () => {
    const result = await translateVisitMessage({
      content: "already english",
      sourceLanguage: "en",
      targetLanguage: "en",
    });

    expect(result.translationProvider).toBe("identity");
    expect(result.translatedContent).toBe("already english");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("returns a normalized identity result for empty content", async () => {
    await expect(
      translateVisitMessage({
        content: "   ",
        sourceLanguage: "zh",
        targetLanguage: "en",
      })
    ).resolves.toEqual({
      originalContent: "",
      translatedContent: "",
      sourceLanguage: "auto",
      targetLanguage: "auto",
      translationProvider: "identity",
    });
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("calls llm translation when source/target are different", async () => {
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
            content: "I have had a fever for 3 days.",
          },
        },
      ],
    } as never);

    const result = await translateVisitMessage({
      content: "我发烧三天了",
      sourceLanguage: "zh",
      targetLanguage: "en",
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.translationProvider).toBe("llm");
    expect(result.translatedContent).toBe("I have had a fever for 3 days.");
  });

  it("falls back to identity when llm translation fails", async () => {
    vi.mocked(invokeLLM).mockRejectedValue(new Error("llm unavailable"));

    const result = await translateVisitMessage({
      content: "hello",
      sourceLanguage: "en",
      targetLanguage: "zh",
    });

    expect(result.translationProvider).toBe("identity");
    expect(result.translatedContent).toBe("hello");
    expect(result.sourceLanguage).toBe("en");
    expect(result.targetLanguage).toBe("zh");
  });

  it("logs production translation failures without medical content", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(invokeLLM).mockRejectedValue(
      new Error("private medication and diagnosis detail")
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await translateVisitMessage({
      content: "患者专用测试病情",
      sourceLanguage: "zh",
      targetLanguage: "en",
    });

    expect(result).toMatchObject({
      originalContent: "患者专用测试病情",
      translatedContent: "患者专用测试病情",
      sourceLanguage: "zh",
      targetLanguage: "en",
      translationProvider: "identity",
    });
    expect(consoleWarn).toHaveBeenCalledOnce();
    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "visit-translation",
      event: "message_translation_failed",
      sourceLanguage: "zh",
      targetLanguage: "en",
      errorName: "Error",
    });
    expect(logged).not.toContain("private medication and diagnosis detail");
    expect(logged).not.toContain("患者专用测试病情");
  });

  it("resolves auto source/target in opposite-language mode", async () => {
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
            content: "I have a fever.",
          },
        },
      ],
    } as never);

    const result = await translateVisitMessage({
      content: "我发烧了",
      sourceLanguage: "auto",
      targetLanguage: "auto",
    });

    expect(result.sourceLanguage).toBe("zh");
    expect(result.targetLanguage).toBe("en");
    expect(result.translationProvider).toBe("llm");
    expect(result.translatedContent).toBe("I have a fever.");
  });

  it("normalizes empty languages and requests the opposite target language", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: "我头痛。",
          },
        },
      ],
    } as never);

    const result = await translateVisitMessage({
      content: "  I have a headache.  ",
      sourceLanguage: "   ",
      targetLanguage: "",
    });

    expect(result).toEqual({
      originalContent: "I have a headache.",
      translatedContent: "我头痛。",
      sourceLanguage: "en",
      targetLanguage: "zh",
      translationProvider: "llm",
    });
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            role: "system",
            content: "将输入内容翻译成自然中文，只输出翻译文本。",
          }),
          { role: "user", content: "I have a headache." },
        ],
      })
    );
  });

  it("combines only text parts from a multipart LLM response", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: [
              null,
              { type: "image", text: "ignored" },
              { type: "text", text: "  Natural " },
              { type: "text", text: "English.  " },
            ],
          },
        },
      ],
    } as never);

    const result = await translateVisitMessage({
      content: "自然英文",
      sourceLanguage: "Chinese",
      targetLanguage: "EN-US",
    });

    expect(result).toMatchObject({
      translatedContent: "Natural English.",
      sourceLanguage: "zh",
      targetLanguage: "en",
      translationProvider: "llm",
    });
  });

  it.each([
    ["an unsupported object", { type: "text", text: "ignored" }],
    ["an empty string", "   "],
  ])(
    "falls back to identity for %s response content",
    async (_label, content) => {
      vi.mocked(invokeLLM).mockResolvedValue({
        choices: [{ message: { content } }],
      } as never);

      const result = await translateVisitMessage({
        content: "需要翻译",
        sourceLanguage: "zh-Hans",
        targetLanguage: "English",
      });

      expect(result).toEqual({
        originalContent: "需要翻译",
        translatedContent: "需要翻译",
        sourceLanguage: "zh",
        targetLanguage: "en",
        translationProvider: "identity",
      });
    }
  );
});
