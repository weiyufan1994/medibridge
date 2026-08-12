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

function encodeTestCursor(createdAt: Date, id: number) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString(
    "base64url"
  );
}

describe("visit router", () => {
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
    vi.mocked(appointmentVisitApi.validateAccessToken).mockResolvedValue({
      appointmentId: 9001,
      role: "patient",
      appointment: { id: 9001 },
    } as never);
    vi.mocked(appointmentVisitApi.validateToken).mockResolvedValue({
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
        clientMessageId: null,
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
        clientMessageId: "c1",
        createdAt: older,
      },
    ] as never);

    const caller = visitRouter.createCaller(createTestContext());
    const result = await caller.getMessagesByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      limit: 50,
    });

    expect(appointmentVisitApi.validateToken).toHaveBeenCalledWith(
      9001,
      "patient_token_1234567890",
      "read_history",
      expect.anything()
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
        clientMessageId: "c1",
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
        clientMessageId: null,
      },
    ]);
  });

  it("roomGetMessages validates by token only and returns role", async () => {
    const createdAt = new Date("2026-03-03T09:00:00.000Z");
    vi.mocked(appointmentVisitApi.validateAccessToken).mockResolvedValue({
      appointmentId: 9001,
      role: "doctor",
      appointment: { id: 9001 },
    } as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([
      {
        id: 1,
        appointmentId: 9001,
        senderType: "doctor",
        content: "请说明症状",
        originalContent: "请说明症状",
        translatedContent: "请说明症状",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        clientMessageId: null,
        createdAt,
      },
    ] as never);

    const caller = visitRouter.createCaller(createTestContext());
    const result = await caller.roomGetMessages({
      token: "doctor_token_1234567890",
      limit: 50,
    });

    expect(appointmentVisitApi.validateAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "doctor_token_1234567890",
        action: "read_history",
      })
    );
    expect(result.appointmentId).toBe(9001);
    expect(result.role).toBe("doctor");
    expect(result.messages).toHaveLength(1);
    expect(appointmentVisitApi.touchVisitAccess).toHaveBeenCalledWith({
      appointmentId: 9001,
      role: "doctor",
      touchedAt: expect.any(Date),
    });
  });

  it("getMessagesByToken uses oldest message as nextCursor for beforeCursor pagination", async () => {
    const t2 = new Date("2026-03-03T09:02:00.000Z");
    const t3 = new Date("2026-03-03T09:03:00.000Z");
    const t4 = new Date("2026-03-03T09:04:00.000Z");
    const t5 = new Date("2026-03-03T09:05:00.000Z");

    vi.mocked(visitRepo.getRecentMessages).mockResolvedValueOnce([
      {
        id: 5,
        appointmentId: 9001,
        senderType: "doctor",
        content: "m5",
        originalContent: "m5",
        translatedContent: "m5",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        clientMessageId: null,
        createdAt: t5,
      },
      {
        id: 4,
        appointmentId: 9001,
        senderType: "patient",
        content: "m4",
        originalContent: "m4",
        translatedContent: "m4",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        clientMessageId: null,
        createdAt: t4,
      },
    ] as never);

    vi.mocked(visitRepo.getMessagesBeforeCursor).mockResolvedValueOnce([
      {
        id: 3,
        appointmentId: 9001,
        senderType: "doctor",
        content: "m3",
        originalContent: "m3",
        translatedContent: "m3",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        clientMessageId: null,
        createdAt: t3,
      },
      {
        id: 2,
        appointmentId: 9001,
        senderType: "patient",
        content: "m2",
        originalContent: "m2",
        translatedContent: "m2",
        sourceLanguage: "zh",
        targetLanguage: "zh",
        clientMessageId: null,
        createdAt: t2,
      },
    ] as never);

    const caller = visitRouter.createCaller(createTestContext());
    const first = await caller.getMessagesByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      limit: 2,
    });
    expect(first.messages.map(message => message.id)).toEqual([4, 5]);
    expect(first.nextCursor).toBe(encodeTestCursor(t4, 4));
    expect(first.hasMore).toBe(true);

    const second = await caller.getMessagesByToken({
      appointmentId: 9001,
      token: "patient_token_1234567890",
      limit: 2,
      beforeCursor: first.nextCursor ?? undefined,
    });

    expect(visitRepo.getMessagesBeforeCursor).toHaveBeenCalledWith({
      appointmentId: 9001,
      beforeCreatedAt: t4,
      beforeId: 4,
      limit: 2,
    });
    expect(second.messages.map(message => message.id)).toEqual([2, 3]);
    expect(second.nextCursor).toBe(encodeTestCursor(t2, 2));
    expect(second.hasMore).toBe(true);

    const mergedAsc = [...second.messages, ...first.messages];
    expect(mergedAsc.map(message => message.id)).toEqual([2, 3, 4, 5]);
    expect(new Set(mergedAsc.map(message => message.id)).size).toBe(4);
  });
});
