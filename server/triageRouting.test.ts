import { describe, expect, it } from "vitest";
import {
  buildLightTriageResultFormDefaults,
  buildLightTriageResultSummary,
} from "../shared/triageRouting";

describe("triageRouting shared helpers", () => {
  it("builds editable summary defaults from extraction and labeled summary", () => {
    const form = buildLightTriageResultFormDefaults({
      summary:
        "年龄/性别：31 / 女；核心症状与部位：右下腹痛；发病时间与急缓：3天逐渐加重；外伤与手术史：无；关键基础疾病：无",
      extraction: {
        symptoms: "右下腹痛",
        duration: "3天逐渐加重",
        age: 31,
        gender: "女",
        medicalHistory: "无",
        traumaOrSurgery: "无",
        otherSymptoms: "轻度恶心",
      },
    });

    expect(form).toEqual({
      ageGender: "31 / 女",
      mainSymptomAndLocation: "右下腹痛",
      durationAndOnset: "3天逐渐加重",
      traumaOrSurgery: "无",
      medicalHistory: "无",
      otherSymptoms: "轻度恶心",
    });
  });

  it("rebuilds a labeled summary string from the editable form", () => {
    const summary = buildLightTriageResultSummary(
      {
        ageGender: "31 / 女",
        mainSymptomAndLocation: "右下腹痛",
        durationAndOnset: "3天逐渐加重",
        traumaOrSurgery: "无",
        medicalHistory: "无",
        otherSymptoms: "轻度恶心",
      },
      "zh"
    );

    expect(summary).toContain("年龄/性别：31 / 女");
    expect(summary).toContain("其他症状：轻度恶心");
  });
});
