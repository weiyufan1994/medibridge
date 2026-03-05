import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import { translateVisitMessage } from "./translation";

describe("visit translation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
