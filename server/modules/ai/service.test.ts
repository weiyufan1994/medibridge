import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./hospitalRouting", () => ({
  buildHospitalRouting: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import { buildHospitalRouting } from "./hospitalRouting";
import { processTriageChat } from "./service";

describe("processTriageChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildHospitalRouting).mockResolvedValue({
      possibilitySummary:
        "结合您描述的情况，目前更偏向消化科方向，建议先到该专科进一步评估。这是分诊建议，不是明确诊断。",
      recommendedDepartment: {
        zh: "消化内科",
        en: "gastroenterology",
        matchedSpecialtyKey: "消化科",
      },
      hospitals: [
        {
          hospitalName: "上海交通大学医学院附属瑞金医院",
          city: "上海",
          specialtyRank: 2,
          specialtyScore: 9.1,
          generalGrade: "A++++",
          stemRank: 6,
          matchedHospitalId: 18,
          matchedDepartmentId: 42,
          reason: "2022 复旦 消化科 声誉榜第 2 名；全国综合等级 A++++",
        },
      ],
    });
  });

  it("completes immediately from structured intake once core fields are present", async () => {
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
              mainSymptomAndLocation: "右下腹痛",
              durationAndOnset: "3天逐渐加重",
              traumaOrSurgery: "无",
              chronicConditions: "无",
              otherSymptoms: "轻度恶心",
              age: 31,
              gender: "female",
              urgency: "medium",
            }),
          },
        },
      ],
    } as never);

    const result = await processTriageChat(
      [{ role: "user", content: "已提交极速分诊表" }],
      "zh",
      undefined,
      {
        age: 31,
        gender: "female",
        mainSymptomAndLocation: "右下腹痛",
        durationAndOnset: "3天逐渐加重",
        traumaOrSurgery: "无",
        chronicConditions: "无",
      }
    );

    expect(result.isComplete).toBe(true);
    expect(result.summary).toContain("核心症状与部位：右下腹痛");
    expect(result.keywords).toEqual(
      expect.arrayContaining(["右下腹痛", "消化内科"])
    );
    expect(result.routing).toMatchObject({
      recommendedDepartment: {
        zh: "消化内科",
        matchedSpecialtyKey: "消化科",
      },
      hospitals: [
        expect.objectContaining({
          hospitalName: "上海交通大学医学院附属瑞金医院",
          matchedHospitalId: 18,
        }),
      ],
    });
    expect(result.extraction).toMatchObject({
      symptoms: "右下腹痛",
      duration: "3天逐渐加重",
      gender: "女",
      medicalHistory: "无",
      traumaOrSurgery: "无",
    });
  });

  it("asks one combined follow-up when a core field is still missing", async () => {
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
              mainSymptomAndLocation: "右下腹痛",
              durationAndOnset: "3天逐渐加重",
              traumaOrSurgery: "无",
              chronicConditions: "",
              otherSymptoms: "",
              age: null,
              gender: "unknown",
              urgency: "medium",
            }),
          },
        },
      ],
    } as never);

    const result = await processTriageChat(
      [{ role: "user", content: "右下腹痛三天，无外伤" }],
      "zh"
    );

    expect(result.isComplete).toBe(false);
    expect(result.reply).toContain("我再确认");
    expect(result.reply).toContain("基础疾病");
    expect(result.reply).toContain("1.");
    expect(result.reply).not.toContain("2-3 轮");
    expect(result.reply).not.toContain("推荐医生");
  });

  it("uses routing-oriented completion wording instead of doctor-booking wording", async () => {
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
              mainSymptomAndLocation: "咳嗽伴气短",
              durationAndOnset: "5天",
              traumaOrSurgery: "无",
              chronicConditions: "高血压",
              otherSymptoms: "低热",
              age: 52,
              gender: "male",
              urgency: "medium",
            }),
          },
        },
      ],
    } as never);

    const result = await processTriageChat(
      [{ role: "user", content: "咳嗽五天，伴有气短" }],
      "zh"
    );

    expect(result.isComplete).toBe(true);
    expect(result.reply).toContain("建议就诊专科");
    expect(result.reply).not.toContain("推荐医生");
  });
});
