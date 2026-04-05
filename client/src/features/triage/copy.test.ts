import { describe, expect, it } from "vitest";
import {
  getLocalizedTriageText,
  getTriageCopy,
} from "@/features/triage/copy";

describe("triage copy", () => {
  it("uses AI-guided first-turn wording in Chinese instead of form-first wording", () => {
    const copy = getTriageCopy("zh");

    expect(copy.initialAssistantMessage).toContain("请先告诉我年龄和性别");
    expect(copy.initialAssistantMessage).toContain("我们按 4 个问题来");
    expect(copy.initialAssistantMessage).toContain("具体在哪个部位");
    expect(copy.initialAssistantMessage).toContain("外伤或近期手术");
    expect(copy.initialAssistantMessage).toContain("基础疾病");
    expect(copy.subtitle).toContain("主动引导");
    expect(copy.placeholder).toBe("请在这里描述您的症状...");
  });

  it("marks the optional form as a fallback instead of the default path", () => {
    const copy = getTriageCopy("en");

    expect(copy.fast_intake.title).toContain("Optional");
    expect(copy.fast_intake.description).toContain("default path");
    expect(copy.summary_form.title).toContain("AI-Organized");
    expect(copy.initialAssistantMessage).toContain("start with your age and gender");
    expect(copy.initialAssistantMessage).toContain("4 quick questions");
    expect(copy.initialAssistantMessage).toContain("underlying conditions");
    expect(copy.placeholder).toBe("Describe your symptoms here...");
  });

  it("resolves localized triage text with an explicit fallback", () => {
    expect(
      getLocalizedTriageText({
        lang: "zh",
        text: {
          zh: "呼吸内科",
          en: "Respiratory Medicine",
        },
        fallback: "相关专科",
      })
    ).toBe("呼吸内科");

    expect(
      getLocalizedTriageText({
        lang: "en",
        text: undefined,
        fallback: "Relevant department",
      })
    ).toBe("Relevant department");
  });
});
