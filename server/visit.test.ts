import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/visit/repo", () => ({
  getRecentMessages: vi.fn(),
  getMessageByClientMsgId: vi.fn(),
  createMessage: vi.fn(),
  getLatestMessage: vi.fn(),
  pollMessages: vi.fn(),
  upsertPatientSession: vi.fn(),
  getPatientSession: vi.fn(),
}));

vi.mock("./appointmentsRouter", () => ({
  validateAppointmentToken: vi.fn(),
}));

import * as visitRepo from "./modules/visit/repo";
import { validateAppointmentToken } from "./appointmentsRouter";
import { visitRouter } from "./visitRouter";

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: { host: "medibridge.test" },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("visit router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAppointmentToken).mockResolvedValue({
      role: "patient",
      appointment: {
        id: 9001,
      },
    } as never);
  });

  it("getMessagesByToken returns normalized messages structure", async () => {
    const older = new Date("2026-03-03T09:00:00.000Z");
    const newer = new Date("2026-03-03T09:01:00.000Z");

    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([
      {
        id: 2,
        appointmentId: 9001,
        senderType: "doctor",
        content: "请补充症状",
        originalContent: "请补充症状",
        translatedContent: "请补充症状",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        clientMsgId: null,
        createdAt: newer,
      },
      {
        id: 1,
        appointmentId: 9001,
        senderType: "patient",
        content: "我发烧了",
        originalContent: "我发烧了",
        translatedContent: "我发烧了",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        clientMsgId: "c1",
        createdAt: older,
      },
    ] as never);

    const caller = visitRouter.createCaller(createTestContext());
    const result = await caller.getMessagesByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      limit: 50,
    });

    expect(validateAppointmentToken).toHaveBeenCalledWith(
      9001,
      "patient_token_1234567890",
      "read_history"
    );
    expect(visitRepo.getRecentMessages).toHaveBeenCalledWith(9001, 50);
    expect(result.messages).toEqual([
      {
        id: 1,
        senderType: "patient",
        content: "我发烧了",
        originalContent: "我发烧了",
        translatedContent: "我发烧了",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        createdAt: older,
        clientMsgId: "c1",
      },
      {
        id: 2,
        senderType: "doctor",
        content: "请补充症状",
        originalContent: "请补充症状",
        translatedContent: "请补充症状",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        createdAt: newer,
        clientMsgId: null,
      },
    ]);
  });

  it("sendMessageByToken reuses existing message when clientMsgId is duplicated", async () => {
    const createdAt = new Date("2026-03-03T09:02:00.000Z");
    vi.mocked(visitRepo.getMessageByClientMsgId).mockResolvedValue({
      id: 77,
      senderType: "patient",
      createdAt,
    } as never);

    const caller = visitRouter.createCaller(createTestContext());
    const result = await caller.sendMessageByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      content: "重复提交",
      clientMsgId: "msg-1",
    });

    expect(visitRepo.getMessageByClientMsgId).toHaveBeenCalledWith(9001, "msg-1");
    expect(visitRepo.createMessage).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 77,
      senderType: "patient",
      createdAt,
    });
  });

  it("sendMessageByToken creates a new message and returns insert id", async () => {
    vi.mocked(visitRepo.getMessageByClientMsgId).mockResolvedValue(null as never);
    vi.mocked(visitRepo.createMessage).mockResolvedValue({ insertId: 88 } as never);

    const caller = visitRouter.createCaller(createTestContext());
    const result = await caller.sendMessageByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      content: "新的消息",
      clientMsgId: "msg-2",
    });

    expect(visitRepo.createMessage).toHaveBeenCalledTimes(1);
    expect(visitRepo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 9001,
        senderType: "patient",
        content: "新的消息",
        clientMsgId: "msg-2",
      })
    );
    expect(result).toMatchObject({
      id: 88,
      senderType: "patient",
    });
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});
