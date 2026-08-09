import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
  countAiChatMessagesBySessionId: vi.fn(),
  createAiChatMessage: vi.fn(),
  getAiChatMessagesBySessionId: vi.fn(),
  updateAiChatSessionStatus: vi.fn(),
  setAiChatSessionSummaryIfEmpty: vi.fn(),
}));

vi.mock("./modules/auth/publicApi", () => ({
  authGuestIdentityApi: {
    findOrCreateGuestSessionOwner: vi.fn(),
  },
}));

vi.mock("./modules/triageSafety/publicApi", () => ({
  triageSafetyApi: {
    scanMessage: vi.fn(),
    recordRiskEvents: vi.fn(),
    setSessionFlag: vi.fn(),
    clearSessionFlagsByType: vi.fn(),
  },
}));

vi.mock("./modules/triageKnowledge/publicApi", () => ({
  triageKnowledgeApi: {
    runRetrieval: vi.fn(),
  },
}));

vi.mock("./modules/ai/service", () => ({
  processTriageChat: vi.fn(),
}));

import * as aiRepo from "./modules/ai/repo";
import { triageKnowledgeApi } from "./modules/triageKnowledge/publicApi";
import { triageSafetyApi } from "./modules/triageSafety/publicApi";
import { processTriageChat } from "./modules/ai/service";
import { sendMessageAction } from "./modules/ai/actions";

describe("ai.sendMessageAction stream b", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue({
      id: 10,
      userId: 7,
      status: "active",
      summary: null,
    } as never);
    vi.mocked(aiRepo.countAiChatMessagesBySessionId).mockResolvedValue(
      0 as never
    );
    vi.mocked(aiRepo.getAiChatMessagesBySessionId).mockResolvedValue([
      {
        id: 91,
        sessionId: 10,
        role: "user",
        content: "test",
      },
    ] as never);
    vi.mocked(aiRepo.createAiChatMessage)
      .mockResolvedValueOnce(91 as never)
      .mockResolvedValueOnce(92 as never);
  });

  it("interrupts immediately when red flag is matched", async () => {
    vi.mocked(triageSafetyApi.scanMessage).mockReturnValue({
      matchedRiskCodes: ["CHEST_PAIN_BREATHING"],
      highestSeverity: "critical",
      shouldInterrupt: true,
      recommendedAction: "go_to_er",
      displayMessage: {
        zh: "立即去急诊。",
        en: "Go to the emergency department immediately.",
      },
      triggerSource: "rule",
      rawExcerpt: "胸痛 呼吸困难",
    });

    const result = await sendMessageAction(
      {
        sessionId: 10,
        content: "胸痛而且呼吸困难",
        lang: "zh",
      },
      { id: 7 } as never
    );

    expect(result.isComplete).toBe(true);
    expect(result.interrupted).toBe(true);
    expect(result.interruptionMessage).toEqual({
      zh: "立即去急诊。",
      en: "Go to the emergency department immediately.",
    });
    expect(vi.mocked(triageKnowledgeApi.runRetrieval)).not.toHaveBeenCalled();
    expect(vi.mocked(processTriageChat)).not.toHaveBeenCalled();
    expect(vi.mocked(triageSafetyApi.recordRiskEvents)).toHaveBeenCalledTimes(
      1
    );
    expect(
      vi.mocked(triageSafetyApi.clearSessionFlagsByType)
    ).toHaveBeenCalledWith(10, "triage_result_v1");
    expect(vi.mocked(triageSafetyApi.setSessionFlag)).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 10,
        flagType: "triage_result_v1",
      })
    );
    expect(vi.mocked(aiRepo.updateAiChatSessionStatus)).toHaveBeenCalledWith(
      10,
      "completed"
    );
  });

  it("runs retrieval and passes knowledge context when no red flag is matched", async () => {
    vi.mocked(triageSafetyApi.scanMessage).mockReturnValue({
      matchedRiskCodes: [],
      highestSeverity: null,
      shouldInterrupt: false,
      recommendedAction: null,
      displayMessage: null,
      triggerSource: "rule",
      rawExcerpt: "皮疹三天",
    });
    vi.mocked(triageKnowledgeApi.runRetrieval).mockResolvedValue({
      snippets: [
        {
          title: "皮疹分诊基础卡 / 皮疹分诊基础卡",
          content: "主诉：皮疹。必问：部位、持续时间。",
          riskCodes: ["SEVERE_ALLERGIC_REACTION"],
          specialtyTags: ["dermatology"],
        },
      ],
      trace: {
        mode: "keyword",
        queryTerms: ["皮疹"],
        chunkIds: [1],
        documentTitles: ["皮疹分诊基础卡"],
      },
    });
    vi.mocked(processTriageChat).mockResolvedValue({
      isComplete: false,
      reply: "请补充持续时间和是否瘙痒。",
    });

    const result = await sendMessageAction(
      {
        sessionId: 10,
        content: "我有皮疹",
        lang: "zh",
      },
      { id: 7 } as never
    );

    expect(result.isComplete).toBe(false);
    expect(vi.mocked(triageKnowledgeApi.runRetrieval)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(processTriageChat)).toHaveBeenCalledWith(
      [{ role: "user", content: "test" }],
      "zh",
      expect.objectContaining({
        snippets: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("皮疹分诊基础卡"),
          }),
        ]),
      }),
      undefined
    );
  });

  it("passes structured intake through to the triage service", async () => {
    vi.mocked(triageSafetyApi.scanMessage).mockReturnValue({
      matchedRiskCodes: [],
      highestSeverity: null,
      shouldInterrupt: false,
      recommendedAction: null,
      displayMessage: null,
      triggerSource: "rule",
      rawExcerpt: "右下腹痛",
    });
    vi.mocked(triageKnowledgeApi.runRetrieval).mockResolvedValue(undefined);
    vi.mocked(processTriageChat).mockResolvedValue({
      isComplete: true,
      reply: "已完成极速分诊。",
      summary: "核心症状与部位：右下腹痛；发病时间与急缓：3天逐渐加重",
      keywords: ["右下腹痛", "消化内科", "腹痛"],
      extraction: {
        symptoms: "右下腹痛",
        duration: "3天逐渐加重",
        age: 31,
        gender: "女",
        medicalHistory: "无",
        traumaOrSurgery: "无",
        otherSymptoms: "",
        urgency: "medium",
      },
    });

    await sendMessageAction(
      {
        sessionId: 10,
        content: "已提交极速分诊表",
        lang: "zh",
        intake: {
          age: 31,
          gender: "female",
          mainSymptomAndLocation: "右下腹痛",
          durationAndOnset: "3天逐渐加重",
          traumaOrSurgery: "无",
          chronicConditions: "无",
        },
      },
      { id: 7 } as never
    );

    expect(vi.mocked(processTriageChat)).toHaveBeenCalledWith(
      [{ role: "user", content: "test" }],
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
    expect(
      vi.mocked(triageSafetyApi.clearSessionFlagsByType)
    ).toHaveBeenCalledWith(10, "triage_result_v1");
    expect(vi.mocked(triageSafetyApi.setSessionFlag)).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 10,
        flagType: "triage_result_v1",
      })
    );
  });
});
