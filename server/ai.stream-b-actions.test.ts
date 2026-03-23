import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
  countAiChatMessagesBySessionId: vi.fn(),
  createAiChatMessage: vi.fn(),
  getAiChatMessagesBySessionId: vi.fn(),
  updateAiChatSessionStatus: vi.fn(),
  setAiChatSessionSummaryIfEmpty: vi.fn(),
}));

vi.mock("./modules/auth/repo", () => ({
  findOrCreateGuestUserByDeviceId: vi.fn(),
}));

vi.mock("./modules/triageSafety", () => ({
  scanMessage: vi.fn(),
  recordRiskEvents: vi.fn(),
  setSessionFlag: vi.fn(),
}));

vi.mock("./modules/triageKnowledge", () => ({
  runRetrieval: vi.fn(),
}));

vi.mock("./modules/ai/service", () => ({
  processTriageChat: vi.fn(),
}));

import * as aiRepo from "./modules/ai/repo";
import * as triageSafety from "./modules/triageSafety";
import * as triageKnowledge from "./modules/triageKnowledge";
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
    vi.mocked(aiRepo.countAiChatMessagesBySessionId).mockResolvedValue(0 as never);
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
    vi.mocked(triageSafety.scanMessage).mockReturnValue({
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
    expect(vi.mocked(triageKnowledge.runRetrieval)).not.toHaveBeenCalled();
    expect(vi.mocked(processTriageChat)).not.toHaveBeenCalled();
    expect(vi.mocked(triageSafety.recordRiskEvents)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(aiRepo.updateAiChatSessionStatus)).toHaveBeenCalledWith(
      10,
      "completed"
    );
  });

  it("runs retrieval and passes knowledge context when no red flag is matched", async () => {
    vi.mocked(triageSafety.scanMessage).mockReturnValue({
      matchedRiskCodes: [],
      highestSeverity: null,
      shouldInterrupt: false,
      recommendedAction: null,
      displayMessage: null,
      triggerSource: "rule",
      rawExcerpt: "皮疹三天",
    });
    vi.mocked(triageKnowledge.runRetrieval).mockResolvedValue({
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
    expect(vi.mocked(triageKnowledge.runRetrieval)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(processTriageChat)).toHaveBeenCalledWith(
      [{ role: "user", content: "test" }],
      "zh",
      expect.objectContaining({
        snippets: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining("皮疹分诊基础卡"),
          }),
        ]),
      })
    );
  });
});
