import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/visit/repo", () => ({
  getRecentMessages: vi.fn(),
  getMessagesBeforeCursor: vi.fn(),
  getMessageByClientMessageId: vi.fn(),
  getMessageById: vi.fn(),
  getLatestMessageCursor: vi.fn(),
  createMessage: vi.fn(),
  getLatestMessage: vi.fn(),
  pollMessages: vi.fn(),
  upsertPatientSession: vi.fn(),
  getPatientSession: vi.fn(),
}));

vi.mock("./modules/appointments/publicApi", () => ({
  appointmentVisitApi: {
    markInSessionAfterFirstMessage: vi.fn(),
    touchVisitAccess: vi.fn(),
    validateAccessToken: vi.fn(),
    validateToken: vi.fn(),
  },
}));

vi.mock("./modules/visit/translation", () => ({
  translateVisitMessage: vi.fn(),
}));

import * as visitRepo from "./modules/visit/repo";
import { appointmentVisitApi } from "./modules/appointments/publicApi";
import { visitRouter } from "./routers/visit";
import { translateVisitMessage } from "./modules/visit/translation";

function createTestContext(): TrpcContext {
  return {
    user: null,
    userId: null,
    deviceId: null,
    requestMetadata: {
      clientIp: null,
      forwardedHost: null,
      forwardedProto: null,
      host: "medibridge.test",
      protocol: "https",
      requestId: null,
      userAgent: null,
    },
    req: {
      protocol: "https",
      headers: { host: "medibridge.test" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("visit send-message router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(translateVisitMessage).mockImplementation(
      async input =>
        ({
          originalContent: input.content.trim(),
          translatedContent: input.content.trim(),
          sourceLanguage: input.sourceLanguage ?? "en",
          targetLanguage: input.targetLanguage ?? "en",
          translationProvider: "identity",
        }) as never
    );
    vi.mocked(
      appointmentVisitApi.markInSessionAfterFirstMessage
    ).mockResolvedValue(undefined as never);
    vi.mocked(appointmentVisitApi.validateToken).mockResolvedValue({
      role: "patient",
      appointment: { id: 9001 },
    } as never);
  });

  it("reuses an existing message when clientMessageId is duplicated", async () => {
    const createdAt = new Date("2026-03-03T09:02:00.000Z");
    vi.mocked(visitRepo.getMessageByClientMessageId).mockResolvedValue({
      id: 77,
      senderType: "patient",
      createdAt,
    } as never);

    const caller = visitRouter.createCaller(createTestContext());
    const result = await caller.sendMessageByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      content: "重复提交",
      clientMessageId: "msg-1",
    });

    expect(visitRepo.getMessageByClientMessageId).toHaveBeenCalledWith(
      9001,
      "msg-1"
    );
    expect(visitRepo.createMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 77, senderType: "patient", createdAt });
  });

  it("creates a new message and returns its insert id", async () => {
    vi.mocked(visitRepo.getMessageByClientMessageId).mockResolvedValue(
      null as never
    );
    vi.mocked(visitRepo.createMessage).mockResolvedValue({
      insertId: 88,
    } as never);

    const caller = visitRouter.createCaller(createTestContext());
    const result = await caller.sendMessageByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      content: "新的消息",
      clientMessageId: "msg-2",
    });

    expect(visitRepo.createMessage).toHaveBeenCalledTimes(1);
    expect(visitRepo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 9001,
        senderType: "patient",
        content: "新的消息",
        clientMessageId: "msg-2",
      })
    );
    expect(result).toMatchObject({ id: 88, senderType: "patient" });
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("requests the first-message status transition", async () => {
    vi.mocked(visitRepo.getMessageByClientMessageId).mockResolvedValue(
      null as never
    );
    vi.mocked(visitRepo.createMessage).mockResolvedValue({
      insertId: 101,
    } as never);
    const caller = visitRouter.createCaller(createTestContext());

    await caller.sendMessageByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      content: "触发状态迁移",
      clientMessageId: "msg-paid-state",
    });

    expect(
      appointmentVisitApi.markInSessionAfterFirstMessage
    ).toHaveBeenCalledWith(9001);
  });

  it("uses translated content and stores source/target languages", async () => {
    vi.mocked(visitRepo.getMessageByClientMessageId).mockResolvedValue(
      null as never
    );
    vi.mocked(visitRepo.createMessage).mockResolvedValue({
      insertId: 120,
    } as never);
    vi.mocked(translateVisitMessage).mockResolvedValue({
      originalContent: "我今天有点发烧",
      translatedContent: "I have a bit of fever today.",
      sourceLanguage: "zh",
      targetLanguage: "en",
      translationProvider: "llm",
    } as never);

    const caller = visitRouter.createCaller(createTestContext());
    await caller.sendMessageByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      content: "我今天有点发烧",
      sourceLanguage: "auto",
      targetLanguage: "en",
      clientMessageId: "msg-translated",
    });

    expect(translateVisitMessage).toHaveBeenCalledWith({
      content: "我今天有点发烧",
      sourceLanguage: "auto",
      targetLanguage: "en",
    });
    expect(visitRepo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 9001,
        content: "I have a bit of fever today.",
        originalContent: "我今天有点发烧",
        translatedContent: "I have a bit of fever today.",
        sourceLanguage: "zh",
        targetLanguage: "en",
        translationProvider: "llm",
        clientMessageId: "msg-translated",
        userId: null,
        senderType: "patient",
      })
    );
  });
});
