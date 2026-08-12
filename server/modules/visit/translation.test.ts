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
});
