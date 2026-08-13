import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
  countAiChatMessagesBySessionId: vi.fn(),
  createAiChatMessage: vi.fn(),
  getAiChatMessagesBySessionId: vi.fn(),
  updateAiChatSessionStatus: vi.fn(),
  setAiChatSessionSummaryIfEmpty: vi.fn(),
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
  triageKnowledgeApi: { runRetrieval: vi.fn() },
}));

vi.mock("./modules/ai/service", () => ({ processTriageChat: vi.fn() }));

import * as aiRepo from "./modules/ai/repo";
import { processTriageChat } from "./modules/ai/service";
import { triageKnowledgeApi } from "./modules/triageKnowledge/publicApi";
import { triageSafetyApi } from "./modules/triageSafety/publicApi";
import { chatTriageAction, sendMessageAction } from "./modules/ai/actions";

const SESSION_LIMIT_REPLY =
  "本次基础问诊已达最大深度。由于病情可能较为复杂，AI 无法继续细分，请尽快查看建议专科和参考医院并线下就诊。";

function activeSession() {
  return {
    id: 10,
    userId: 7,
    status: "active",
    summary: null,
  } as never;
}

describe("AI action access and limit boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requires a signed-in user before reading a triage session", async () => {
    await expect(
      sendMessageAction(
        { sessionId: 10, content: "headache", lang: "en" },
        null
      )
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Please login to continue triage.",
    });
    expect(aiRepo.getAiChatSessionById).not.toHaveBeenCalled();
  });

  it("rejects a missing triage session", async () => {
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(
      undefined as never
    );

    await expect(
      sendMessageAction({ sessionId: 404, content: "headache", lang: "en" }, {
        id: 7,
      } as never)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Triage session not found",
    });
  });

  it("rejects access to another user's triage session", async () => {
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue({
      ...activeSession(),
      userId: 8,
    } as never);

    await expect(
      sendMessageAction({ sessionId: 10, content: "headache", lang: "en" }, {
        id: 7,
      } as never)
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You are not allowed to access this triage session",
    });
    expect(aiRepo.countAiChatMessagesBySessionId).not.toHaveBeenCalled();
  });

  it("adds one terminal reply at the nineteenth message and completes", async () => {
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(activeSession());
    vi.mocked(aiRepo.countAiChatMessagesBySessionId).mockResolvedValue(
      19 as never
    );

    const result = await sendMessageAction(
      { sessionId: 10, content: "one more detail", lang: "en" },
      { id: 7 } as never
    );

    expect(result).toEqual({
      isComplete: true,
      reply: SESSION_LIMIT_REPLY,
      sessionStatus: "completed",
      hitMessageLimit: true,
    });
    expect(aiRepo.createAiChatMessage).toHaveBeenCalledWith({
      sessionId: 10,
      role: "assistant",
      content: SESSION_LIMIT_REPLY,
    });
    expect(aiRepo.updateAiChatSessionStatus).toHaveBeenCalledWith(
      10,
      "completed"
    );
    expect(triageSafetyApi.scanMessage).not.toHaveBeenCalled();
    expect(processTriageChat).not.toHaveBeenCalled();
  });

  it("does not duplicate the terminal reply after the twentieth message", async () => {
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(activeSession());
    vi.mocked(aiRepo.countAiChatMessagesBySessionId).mockResolvedValue(
      20 as never
    );

    const result = await sendMessageAction(
      { sessionId: 10, content: "extra detail", lang: "en" },
      { id: 7 } as never
    );

    expect(result.hitMessageLimit).toBe(true);
    expect(aiRepo.createAiChatMessage).not.toHaveBeenCalled();
    expect(aiRepo.updateAiChatSessionStatus).toHaveBeenCalledWith(
      10,
      "completed"
    );
  });

  it("uses the safe terminal reply when the triage service returns blank text", async () => {
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(activeSession());
    vi.mocked(aiRepo.countAiChatMessagesBySessionId).mockResolvedValue(
      0 as never
    );
    vi.mocked(aiRepo.createAiChatMessage)
      .mockResolvedValueOnce(91 as never)
      .mockResolvedValueOnce(92 as never);
    vi.mocked(aiRepo.getAiChatMessagesBySessionId).mockResolvedValue([
      { role: "user", content: "headache" },
    ] as never);
    vi.mocked(triageSafetyApi.scanMessage).mockReturnValue({
      matchedRiskCodes: [],
      highestSeverity: null,
      shouldInterrupt: false,
      recommendedAction: null,
      displayMessage: null,
      triggerSource: "rule",
      rawExcerpt: "headache",
    });
    vi.mocked(triageKnowledgeApi.runRetrieval).mockResolvedValue(undefined);
    vi.mocked(processTriageChat).mockResolvedValue({
      isComplete: false,
      reply: "   ",
    });

    const result = await sendMessageAction(
      { sessionId: 10, content: "headache", lang: "auto" },
      { id: 7 } as never
    );

    expect(result).toMatchObject({
      isComplete: false,
      reply: SESSION_LIMIT_REPLY,
      sessionStatus: "active",
      hitMessageLimit: false,
    });
    expect(processTriageChat).toHaveBeenCalledWith(
      [{ role: "user", content: "headache" }],
      "en",
      undefined,
      undefined
    );
    expect(aiRepo.createAiChatMessage).toHaveBeenLastCalledWith({
      sessionId: 10,
      role: "assistant",
      content: SESSION_LIMIT_REPLY,
    });
  });
});

describe("stateless AI triage language and failure boundaries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects Chinese from the latest non-empty user message", async () => {
    const messages = [
      { role: "user", content: "头痛两天" },
      { role: "assistant", content: "Please continue" },
      { role: "user", content: "   " },
    ];
    vi.mocked(processTriageChat).mockResolvedValue({
      isComplete: false,
      reply: "请补充是否发热。",
    });

    await expect(
      chatTriageAction({ messages, lang: "auto" })
    ).resolves.toMatchObject({ reply: "请补充是否发热。" });
    expect(processTriageChat).toHaveBeenCalledWith(messages, "zh");
  });

  it("falls back to the final message when no non-empty user message exists", async () => {
    const messages = [{ role: "assistant", content: "English prompt" }];
    vi.mocked(processTriageChat).mockResolvedValue({
      isComplete: false,
      reply: "Please continue.",
    });

    await chatTriageAction({ messages, lang: "auto" });

    expect(processTriageChat).toHaveBeenCalledWith(messages, "en");
  });

  it.each([
    {
      lang: "zh" as const,
      expected: "如果方便，请先告诉我年龄和性别。",
    },
    {
      lang: "en" as const,
      expected:
        "If you are comfortable, please start with your age and gender.",
    },
  ])("returns a safe $lang fallback without logging content", async input => {
    const privateContent = "private symptom narrative";
    const error = new Error("private provider detail");
    error.name = "ProviderError";
    vi.mocked(processTriageChat).mockRejectedValue(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await chatTriageAction({
      messages: [{ role: "user", content: privateContent }],
      lang: input.lang,
    });

    expect(result.isComplete).toBe(false);
    expect(result.reply).toContain(input.expected);
    const logs = JSON.stringify(consoleError.mock.calls);
    expect(logs).toContain("chat_failed");
    expect(logs).toContain("ProviderError");
    expect(logs).not.toContain(privateContent);
    expect(logs).not.toContain("private provider detail");
    consoleError.mockRestore();
  });
});
