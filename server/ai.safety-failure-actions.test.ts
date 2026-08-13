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
  authGuestIdentityApi: { findOrCreateGuestSessionOwner: vi.fn() },
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
import { sendMessageAction } from "./modules/ai/actions";

const SAFETY_UNAVAILABLE_REPLY = {
  zh: "安全检查暂时无法完成，因此本次不会继续生成 AI 分诊建议。请稍后重试；如有胸痛、呼吸困难、意识异常、大出血或其他严重或快速加重的症状，请立即联系当地急救服务或前往急诊。",
  en: "The safety check is temporarily unavailable, so AI triage will not continue for this message. Please try again shortly. If you have chest pain, trouble breathing, altered consciousness, heavy bleeding, or other severe or rapidly worsening symptoms, contact local emergency services or go to the emergency department immediately.",
} as const;

function createConsoleErrorSpy() {
  return vi.spyOn(console, "error").mockImplementation(() => undefined);
}

function readSerializedLogs(spy: ReturnType<typeof createConsoleErrorSpy>) {
  return JSON.stringify(spy.mock.calls);
}

function mockRedFlag() {
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
    rawExcerpt: "private symptom narrative",
  });
}

async function sendEnglishMessage(requestId: string) {
  return sendMessageAction(
    { sessionId: 10, content: "private symptom narrative", lang: "en" },
    { id: 7 } as never,
    { requestId } as never
  );
}

describe("ai.sendMessageAction safety failures", () => {
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
      { id: 91, sessionId: 10, role: "user", content: "test" },
    ] as never);
    vi.mocked(aiRepo.createAiChatMessage)
      .mockResolvedValueOnce(91 as never)
      .mockResolvedValueOnce(92 as never);
  });

  it.each([
    { lang: "zh" as const, expectedReply: SAFETY_UNAVAILABLE_REPLY.zh },
    { lang: "en" as const, expectedReply: SAFETY_UNAVAILABLE_REPLY.en },
  ])("fails closed with a retryable $lang reply", async input => {
    const scanError = new Error("private safety detail");
    scanError.name = "TimeoutError";
    vi.mocked(triageSafetyApi.scanMessage).mockImplementation(() => {
      throw scanError;
    });
    const consoleError = createConsoleErrorSpy();

    const result = await sendMessageAction(
      { sessionId: 10, content: "private symptom narrative", lang: input.lang },
      { id: 7 } as never,
      { requestId: "request-scan" } as never
    );

    expect(result).toMatchObject({
      isComplete: false,
      reply: input.expectedReply,
      sessionStatus: "active",
      hitMessageLimit: false,
    });
    expect(triageKnowledgeApi.runRetrieval).not.toHaveBeenCalled();
    expect(processTriageChat).not.toHaveBeenCalled();
    expect(aiRepo.updateAiChatSessionStatus).not.toHaveBeenCalled();
    expect(aiRepo.createAiChatMessage).toHaveBeenLastCalledWith({
      sessionId: 10,
      role: "assistant",
      content: input.expectedReply,
    });
    const logs = readSerializedLogs(consoleError);
    expect(logs).toContain("safety_scan_failed");
    expect(logs).toContain("request-scan");
    expect(logs).toContain("TimeoutError");
    expect(logs).not.toContain("private symptom narrative");
    expect(logs).not.toContain("private safety detail");
    consoleError.mockRestore();
  });

  it("returns the safety fallback when persisting it fails", async () => {
    vi.mocked(triageSafetyApi.scanMessage).mockImplementation(() => {
      throw new Error("private scan detail");
    });
    vi.mocked(aiRepo.createAiChatMessage)
      .mockReset()
      .mockResolvedValueOnce(91 as never)
      .mockRejectedValueOnce(new Error("private message detail"));
    const consoleError = createConsoleErrorSpy();

    const result = await sendEnglishMessage("request-fallback");

    expect(result).toMatchObject({
      isComplete: false,
      reply: SAFETY_UNAVAILABLE_REPLY.en,
      sessionStatus: "active",
    });
    expect(processTriageChat).not.toHaveBeenCalled();
    const logs = readSerializedLogs(consoleError);
    expect(logs).toContain("safety_scan_failed");
    expect(logs).toContain("safety_fallback_message_persistence_failed");
    expect(logs).not.toContain("private symptom narrative");
    expect(logs).not.toContain("private scan detail");
    expect(logs).not.toContain("private message detail");
    consoleError.mockRestore();
  });

  it("keeps interruption when risk-event persistence fails", async () => {
    mockRedFlag();
    vi.mocked(triageSafetyApi.recordRiskEvents).mockRejectedValue(
      new Error("private database detail")
    );
    const consoleError = createConsoleErrorSpy();

    const result = await sendEnglishMessage("request-risk-event");

    expect(result).toMatchObject({
      isComplete: true,
      interrupted: true,
      reply: "Go to the emergency department immediately.",
    });
    expect(triageKnowledgeApi.runRetrieval).not.toHaveBeenCalled();
    expect(processTriageChat).not.toHaveBeenCalled();
    expect(triageSafetyApi.setSessionFlag).toHaveBeenCalled();
    expect(aiRepo.updateAiChatSessionStatus).toHaveBeenCalledWith(
      10,
      "completed"
    );
    const logs = readSerializedLogs(consoleError);
    expect(logs).toContain("safety_risk_event_persistence_failed");
    expect(logs).toContain("request-risk-event");
    expect(logs).not.toContain("private symptom narrative");
    expect(logs).not.toContain("private database detail");
    consoleError.mockRestore();
  });

  it("keeps interruption when session-flag persistence fails", async () => {
    mockRedFlag();
    vi.mocked(triageSafetyApi.setSessionFlag).mockRejectedValueOnce(
      new Error("private flag detail")
    );
    const consoleError = createConsoleErrorSpy();

    const result = await sendEnglishMessage("request-flag");

    expect(result).toMatchObject({ isComplete: true, interrupted: true });
    expect(processTriageChat).not.toHaveBeenCalled();
    expect(triageSafetyApi.setSessionFlag).toHaveBeenCalledTimes(2);
    expect(triageSafetyApi.clearSessionFlagsByType).toHaveBeenCalledWith(
      10,
      "triage_result_v1"
    );
    expect(aiRepo.updateAiChatSessionStatus).toHaveBeenCalledWith(
      10,
      "completed"
    );
    const logs = readSerializedLogs(consoleError);
    expect(logs).toContain("safety_interruption_flag_persistence_failed");
    expect(logs).toContain("request-flag");
    expect(logs).not.toContain("private symptom narrative");
    expect(logs).not.toContain("private flag detail");
    consoleError.mockRestore();
  });

  it("keeps interruption when its assistant message cannot persist", async () => {
    mockRedFlag();
    vi.mocked(aiRepo.createAiChatMessage)
      .mockReset()
      .mockResolvedValueOnce(91 as never)
      .mockRejectedValueOnce(new Error("private message detail"));
    const consoleError = createConsoleErrorSpy();

    const result = await sendEnglishMessage("request-message");

    expect(result).toMatchObject({ isComplete: true, interrupted: true });
    expect(processTriageChat).not.toHaveBeenCalled();
    expect(triageSafetyApi.recordRiskEvents).toHaveBeenCalled();
    expect(aiRepo.updateAiChatSessionStatus).toHaveBeenCalledWith(
      10,
      "completed"
    );
    const logs = readSerializedLogs(consoleError);
    expect(logs).toContain("safety_interruption_message_persistence_failed");
    expect(logs).not.toContain("private symptom narrative");
    expect(logs).not.toContain("private message detail");
    consoleError.mockRestore();
  });
});
