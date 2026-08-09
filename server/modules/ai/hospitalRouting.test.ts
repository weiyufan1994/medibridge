import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../doctors/publicApi", () => ({
  doctorDirectoryApi: {
    getAllHospitals: vi.fn(),
    getDepartmentsByHospital: vi.fn(),
  },
}));

import { doctorDirectoryApi } from "../doctors/publicApi";
import { buildHospitalRouting } from "./hospitalRouting";

describe("hospitalRouting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(doctorDirectoryApi.getAllHospitals).mockResolvedValue([
      {
        id: 1,
        name: "中国医学科学院阜外医院",
        nameEn: "Fuwai Hospital, Chinese Academy of Medical Sciences",
        city: "北京",
        cityEn: "Beijing",
      },
      {
        id: 2,
        name: "中国人民解放军总医院",
        nameEn: "Chinese PLA General Hospital",
        city: "北京",
        cityEn: "Beijing",
      },
    ] as never);
    vi.mocked(doctorDirectoryApi.getDepartmentsByHospital).mockImplementation(
      async hospitalId =>
        hospitalId === 1
          ? ([{ id: 101, hospitalId, name: "心内科" }] as never)
          : ([{ id: 201, hospitalId, name: "全科医学科" }] as never)
    );
  });

  it("ranks specialty hospitals primarily by specialty reputation", async () => {
    const result = await buildHospitalRouting({
      lang: "zh",
      data: {
        mainSymptomAndLocation: "胸痛伴心悸",
        durationAndOnset: "3天",
        traumaOrSurgery: "无",
        chronicConditions: "高血压",
        otherSymptoms: "",
        age: 56,
        gender: "male",
        urgency: "medium",
      },
    });

    expect(result.recommendedDepartment).toMatchObject({
      zh: "心内科",
      matchedSpecialtyKey: "心血管病",
    });
    expect(result.confidence).toBe("standard");
    expect(result.missingCriticalFields).toEqual([]);
    expect(result.hospitals[0]).toMatchObject({
      hospitalName: "中国医学科学院阜外医院",
      specialtyRank: 1,
      matchedHospitalId: 1,
      matchedDepartmentId: 101,
    });
    expect(result.hospitals[0]?.reason).toContain(
      "复旦 心血管病 声誉榜第 1 名"
    );
  });

  it("falls back to a broad general-medicine route when no stable specialty pattern is found", async () => {
    const result = await buildHospitalRouting({
      lang: "zh",
      data: {
        mainSymptomAndLocation: "全身不适",
        durationAndOnset: "1周",
        traumaOrSurgery: "无",
        chronicConditions: "无",
        otherSymptoms: "",
        age: 38,
        gender: "unknown",
        urgency: "low",
      },
    });

    expect(result.recommendedDepartment).toMatchObject({
      zh: "全科",
      matchedSpecialtyKey: "全科医学",
    });
    expect(result.confidence).toBe("standard");
    expect(result.missingCriticalFields).toEqual([]);
    expect(result.hospitals[0]?.hospitalName).toBe("复旦大学附属中山医院");
    expect(result.possibilitySummary).toContain("不是明确诊断");
  });

  it("uses english hospital and city labels when the triage language is english", async () => {
    const result = await buildHospitalRouting({
      lang: "en",
      data: {
        mainSymptomAndLocation: "chest pain and palpitations",
        durationAndOnset: "for 3 days",
        traumaOrSurgery: "none",
        chronicConditions: "high blood pressure",
        otherSymptoms: "",
        age: 56,
        gender: "male",
        urgency: "medium",
      },
    });

    expect(result.recommendedDepartment).toMatchObject({
      en: "cardiology",
      matchedSpecialtyKey: "心血管病",
    });
    expect(result.confidence).toBe("standard");
    expect(result.missingCriticalFields).toEqual([]);
    expect(result.hospitals[0]).toMatchObject({
      hospitalName: "Fuwai Hospital, Chinese Academy of Medical Sciences",
      city: "Beijing",
      matchedHospitalId: 1,
    });
    expect(result.hospitals[0]?.reason).toContain("Ranked #1");
  });

  it("avoids gynecology when gender is missing and falls back to a safer digestive route", async () => {
    const result = await buildHospitalRouting({
      lang: "zh",
      knowledgeContext: {
        snippets: [
          {
            title: "测试片段",
            content: "用于验证 specialty tag 不会绕过安全约束",
            riskCodes: [],
            specialtyTags: ["gynecology"],
          },
        ],
      },
      data: {
        mainSymptomAndLocation: "腹部不适伴腹泻",
        durationAndOnset: "2天",
        traumaOrSurgery: "无",
        chronicConditions: "无",
        otherSymptoms: "脱水、乏力",
        age: 34,
        gender: "unknown",
        urgency: "medium",
      },
    });

    expect(result.recommendedDepartment).toMatchObject({
      zh: "消化内科",
      matchedSpecialtyKey: "消化科",
    });
    expect(result.recommendedDepartment.zh).not.toBe("妇科");
    expect(result.confidence).toBe("reduced");
    expect(result.missingCriticalFields).toEqual(["gender"]);
    expect(result.possibilitySummary).toContain("关键信息不足");
  });
});
