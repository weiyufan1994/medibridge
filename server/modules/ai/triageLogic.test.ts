import { describe, expect, it } from "vitest";
import {
  buildFollowupReply,
  pickRecommendedDepartment,
  resolveRecommendedDepartment,
  buildTriageSummary,
  listMissingTriageFields,
  mergeTriageData,
} from "./triageLogic";

describe("triageLogic", () => {
  it("treats explicit negative trauma and chronic history as known core fields", () => {
    const merged = mergeTriageData({
      intake: {
        age: 34,
        gender: "female",
        mainSymptomAndLocation: "右下腹痛",
        durationAndOnset: "3天逐渐加重",
        traumaOrSurgery: "无",
        chronicConditions: "无",
      },
    });

    expect(listMissingTriageFields(merged)).toEqual([]);
    expect(buildTriageSummary(merged, "zh")).toContain("外伤与手术史：无");
  });

  it("allows completion without age when the symptom pattern is not pediatrics or gynecology", () => {
    const merged = mergeTriageData({
      intake: {
        age: null,
        gender: "unknown",
        mainSymptomAndLocation: "咳嗽伴咽痛",
        durationAndOnset: "2天",
        traumaOrSurgery: "无",
        chronicConditions: "高血压",
      },
    });

    expect(listMissingTriageFields(merged)).toEqual([]);
  });

  it("requires age for pediatric-like complaints", () => {
    const merged = mergeTriageData({
      intake: {
        age: null,
        gender: "unknown",
        mainSymptomAndLocation: "宝宝发烧伴咳嗽",
        durationAndOnset: "今天突然开始",
        traumaOrSurgery: "无",
        chronicConditions: "无",
      },
    });

    expect(listMissingTriageFields(merged)).toContain("age");
  });

  it("requires age and gender for gynecology-like complaints", () => {
    const merged = mergeTriageData({
      intake: {
        age: null,
        gender: "unknown",
        mainSymptomAndLocation: "月经紊乱伴下腹坠痛",
        durationAndOnset: "2个月反复发作",
        traumaOrSurgery: "无",
        chronicConditions: "无",
      },
    });

    expect(listMissingTriageFields(merged)).toEqual(["age", "gender"]);
  });

  it("builds a single combined follow-up request", () => {
    const reply = buildFollowupReply({
      lang: "zh",
      missingFields: ["durationAndOnset", "chronicConditions"],
    });

    expect(reply).toContain("我再确认 2 点");
    expect(reply).toContain("这个症状出现多久了");
    expect(reply).toContain("基础疾病");
    expect(reply).not.toContain("2-3 轮");
    expect(reply).not.toContain("推荐医生");
  });

  it("puts age and gender before symptom questions in follow-up prompts", () => {
    const reply = buildFollowupReply({
      lang: "zh",
      missingFields: ["durationAndOnset", "gender", "age"],
    });

    expect(reply.indexOf("请补充一下年龄")).toBeLessThan(
      reply.indexOf("请补充一下性别")
    );
    expect(reply.indexOf("请补充一下性别")).toBeLessThan(
      reply.indexOf("这个症状出现多久了")
    );
  });

  it("maps chest-pain symptoms to cardiology", () => {
    const merged = mergeTriageData({
      intake: {
        age: 63,
        gender: "male",
        mainSymptomAndLocation: "胸痛伴心悸",
        durationAndOnset: "2天",
        traumaOrSurgery: "无",
        chronicConditions: "高血压",
      },
    });

    expect(pickRecommendedDepartment({ data: merged })).toMatchObject({
      key: "cardiology",
      zh: "心内科",
    });
  });

  it("maps child complaints to pediatrics", () => {
    const merged = mergeTriageData({
      intake: {
        age: 4,
        gender: "unknown",
        mainSymptomAndLocation: "宝宝发烧伴咳嗽",
        durationAndOnset: "今天突然开始",
        traumaOrSurgery: "无",
        chronicConditions: "无",
      },
    });

    expect(pickRecommendedDepartment({ data: merged })).toMatchObject({
      key: "pediatrics",
      zh: "儿科",
    });
  });

  it("requires demographic eligibility before returning a sex-specific specialty", () => {
    const merged = mergeTriageData({
      intake: {
        age: 29,
        gender: "male",
        mainSymptomAndLocation: "月经紊乱伴下腹坠痛",
        durationAndOnset: "2个月反复发作",
        traumaOrSurgery: "无",
        chronicConditions: "无",
      },
    });

    expect(resolveRecommendedDepartment({ data: merged })).toMatchObject({
      department: {
        key: "general_medicine",
        zh: "全科",
      },
      confidence: "standard",
      missingCriticalFields: [],
    });
  });

  it("falls back to a safer digestive route when gender is missing and a gynecology tag is unsafe", () => {
    const merged = mergeTriageData({
      intake: {
        age: 34,
        gender: "unknown",
        mainSymptomAndLocation: "腹部不适伴腹泻",
        durationAndOnset: "2天",
        traumaOrSurgery: "无",
        chronicConditions: "无",
      },
      extracted: {
        otherSymptoms: "脱水、乏力",
        urgency: "medium",
      },
    });

    expect(
      resolveRecommendedDepartment({
        data: merged,
        knowledgeContext: {
          snippets: [
            {
              title: "妇科症状",
              content: "仅用于测试的片段",
              riskCodes: [],
              specialtyTags: ["gynecology"],
            },
          ],
        },
      })
    ).toMatchObject({
      department: {
        key: "digestive",
        zh: "消化内科",
      },
      confidence: "reduced",
      missingCriticalFields: ["gender"],
    });
  });
});
