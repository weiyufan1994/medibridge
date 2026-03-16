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
});
