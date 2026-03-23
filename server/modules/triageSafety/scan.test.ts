import { describe, expect, it } from "vitest";
import { scanMessage } from "./scan";

describe("triageSafety.scanMessage", () => {
  it("interrupts when critical chest pain breathing rule matches", () => {
    const result = scanMessage({
      latestMessage: "我胸痛，而且现在有点呼吸困难，感觉喘不上气。",
      lang: "zh",
    });

    expect(result.shouldInterrupt).toBe(true);
    expect(result.matchedRiskCodes).toContain("CHEST_PAIN_BREATHING");
    expect(result.highestSeverity).toBe("critical");
    expect(result.displayMessage).toEqual({
      zh: expect.stringContaining("急性高风险问题"),
      en: expect.stringContaining("urgent high-risk condition"),
    });
  });

  it("returns no interrupt for non-red-flag symptom text", () => {
    const result = scanMessage({
      latestMessage: "我最近三天有点皮疹，想看看皮肤科。",
      lang: "zh",
    });

    expect(result.shouldInterrupt).toBe(false);
    expect(result.matchedRiskCodes).toEqual([]);
    expect(result.displayMessage).toBeNull();
  });

  it("ignores assistant prompts when scanning prior context", () => {
    const result = scanMessage({
      latestMessage: "只有纯粹的拉稀，腹痛感觉是肚脐眼往下一点。",
      priorMessages: [
        {
          role: "assistant",
          content: "今天有没有其他不适，比如呕吐或者是否伴有黑便和血便呢？",
        },
      ],
      lang: "zh",
    });

    expect(result.shouldInterrupt).toBe(false);
    expect(result.matchedRiskCodes).toEqual([]);
  });
});
