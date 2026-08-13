import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  createMessage: vi.fn(),
  getLatestMessage: vi.fn(),
  getMessageByClientMessageId: vi.fn(),
  getMessagesBeforeCursor: vi.fn(),
  getRecentMessages: vi.fn(),
  pollMessages: vi.fn(),
}));
vi.mock("../appointments/publicApi", () => ({
  appointmentVisitApi: {
    markInSessionAfterFirstMessage: vi.fn(),
    touchVisitAccess: vi.fn(),
    validateAccessToken: vi.fn(),
    validateToken: vi.fn(),
  },
}));
vi.mock("./translation", () => ({
  translateVisitMessage: vi.fn(),
}));

import { appointmentVisitApi } from "../appointments/publicApi";
import {
  getMessagesByToken,
  pollNewMessagesByToken,
  roomGetMessagesByToken,
  sendMessageByToken,
} from "./actions";
import * as visitRepo from "./repo";
import { translateVisitMessage } from "./translation";

const requestMetadata = { requestId: "visit-action-boundary" };
const createdAt = new Date("2026-08-14T00:00:00.000Z");

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    appointmentId: 9001,
    userId: null,
    senderType: "patient",
    content: "stored content",
    originalContent: null,
    translatedContent: null,
    sourceLanguage: null,
    targetLanguage: null,
    translationProvider: null,
    clientMessageId: null,
    createdAt,
    ...overrides,
  };
}

function encodedCursor(date: Date, id: number) {
  return Buffer.from(`${date.toISOString()}|${id}`, "utf8").toString(
    "base64url"
  );
}

describe("visit action boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appointmentVisitApi.validateAccessToken).mockResolvedValue({
      role: "patient",
      appointment: { id: 9001, userId: 42 },
    } as never);
    vi.mocked(appointmentVisitApi.validateToken).mockResolvedValue({
      role: "patient",
      appointment: { id: 9001, userId: 42 },
    } as never);
    vi.mocked(appointmentVisitApi.touchVisitAccess).mockResolvedValue(
      undefined as never
    );
    vi.mocked(
      appointmentVisitApi.markInSessionAfterFirstMessage
    ).mockResolvedValue(undefined as never);
    vi.mocked(translateVisitMessage).mockResolvedValue({
      originalContent: "hello",
      translatedContent: "hello",
      sourceLanguage: "en",
      targetLanguage: "en",
      translationProvider: "identity",
    } as never);
    vi.mocked(visitRepo.getMessageByClientMessageId).mockResolvedValue(
      null as never
    );
  });

  it("paginates token-only room history and normalizes legacy null fields", async () => {
    const before = new Date("2026-08-14T00:05:00.000Z");
    const older = new Date("2026-08-14T00:01:00.000Z");
    vi.mocked(visitRepo.getMessagesBeforeCursor).mockResolvedValue([
      message({ id: 2, createdAt: before }),
      message({ id: 1, createdAt: older }),
    ] as never);

    const result = await roomGetMessagesByToken(
      {
        token: "visit-token-value",
        limit: 2,
        beforeCursor: encodedCursor(before, 3),
      },
      requestMetadata
    );

    expect(visitRepo.getMessagesBeforeCursor).toHaveBeenCalledWith({
      appointmentId: 9001,
      beforeCreatedAt: before,
      beforeId: 3,
      limit: 2,
    });
    expect(result.messages[0]).toMatchObject({
      id: 1,
      originalContent: "stored content",
      translatedContent: "stored content",
      sourceLanguage: "auto",
      targetLanguage: "auto",
    });
    expect(result.nextCursor).toBe(encodedCursor(older, 1));
    expect(result.hasMore).toBe(true);
  });

  it("treats an invalid history cursor as the first page", async () => {
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([] as never);

    const result = await getMessagesByToken(
      {
        appointmentId: 9001,
        token: "visit-token-value",
        limit: 2,
        beforeCursor: encodedCursor(createdAt, Number.NaN),
      },
      requestMetadata
    );

    expect(visitRepo.getRecentMessages).toHaveBeenCalledWith(9001, 2);
    expect(result).toEqual({ messages: [], nextCursor: null, hasMore: false });
  });

  it("retries a patient message without user binding after a foreign-key failure", async () => {
    vi.mocked(visitRepo.createMessage)
      .mockRejectedValueOnce({ code: "23503" })
      .mockResolvedValueOnce({
        id: 8,
        senderType: "patient",
        createdAt,
      } as never);

    const result = await sendMessageByToken(
      {
        appointmentId: 9001,
        token: "visit-token-value",
        content: "hello",
        sourceLanguage: "en",
        targetLanguage: "en",
        clientMessageId: "fk-retry",
      },
      requestMetadata
    );

    expect(visitRepo.createMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ userId: 42, senderType: "patient" })
    );
    expect(visitRepo.createMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ userId: null, senderType: "patient" })
    );
    expect(result).toEqual({ id: 8, senderType: "patient", createdAt });
  });

  it("recovers a concurrent duplicate created during the foreign-key retry", async () => {
    vi.mocked(visitRepo.createMessage)
      .mockRejectedValueOnce({ cause: { code: "23503" } })
      .mockRejectedValueOnce({ cause: { code: "23505" } });
    vi.mocked(visitRepo.getMessageByClientMessageId)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(
        message({ id: 9, senderType: "doctor", createdAt }) as never
      );

    const result = await sendMessageByToken({
      appointmentId: 9001,
      token: "visit-token-value",
      content: "hello",
      sourceLanguage: "en",
      targetLanguage: "en",
      clientMessageId: "fk-duplicate",
    });

    expect(result).toEqual({ id: 9, senderType: "doctor", createdAt });
    expect(
      appointmentVisitApi.markInSessionAfterFirstMessage
    ).not.toHaveBeenCalled();
  });

  it("recovers a direct concurrent duplicate for a doctor message", async () => {
    vi.mocked(appointmentVisitApi.validateToken).mockResolvedValue({
      role: "doctor",
      appointment: { id: 9001, userId: 42 },
    } as never);
    vi.mocked(visitRepo.createMessage).mockRejectedValue({ code: "23505" });
    vi.mocked(visitRepo.getMessageByClientMessageId)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(
        message({ id: 10, senderType: "doctor", createdAt }) as never
      );

    const result = await sendMessageByToken({
      appointmentId: 9001,
      token: "visit-token-value",
      content: "hello",
      sourceLanguage: "en",
      targetLanguage: "en",
      clientMsgId: "doctor-duplicate",
    });

    expect(visitRepo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        senderType: "doctor",
        clientMessageId: "doctor-duplicate",
      })
    );
    expect(result).toEqual({ id: 10, senderType: "doctor", createdAt });
  });

  it("falls back to the latest row when insert metadata has no usable id", async () => {
    vi.mocked(visitRepo.createMessage).mockResolvedValue({} as never);
    vi.mocked(visitRepo.getLatestMessage).mockResolvedValue(
      message({ id: 11, senderType: "system", createdAt }) as never
    );

    await expect(
      sendMessageByToken({
        appointmentId: 9001,
        token: "visit-token-value",
        content: "hello",
        sourceLanguage: "en",
        targetLanguage: "en",
      })
    ).resolves.toEqual({ id: 11, senderType: "system", createdAt });
  });

  it("fails explicitly when an inserted message cannot be resolved", async () => {
    vi.mocked(visitRepo.createMessage).mockResolvedValue({
      insertId: 0,
    } as never);
    vi.mocked(visitRepo.getLatestMessage).mockResolvedValue(null as never);

    await expect(
      sendMessageByToken({
        appointmentId: 9001,
        token: "visit-token-value",
        content: "hello",
        sourceLanguage: "en",
        targetLanguage: "en",
      })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("rejects an invalid sender type returned by persistence", async () => {
    vi.mocked(visitRepo.getMessageByClientMessageId).mockResolvedValue(
      message({ id: 12, senderType: "owner" }) as never
    );

    await expect(
      sendMessageByToken({
        appointmentId: 9001,
        token: "visit-token-value",
        content: "hello",
        sourceLanguage: "en",
        targetLanguage: "en",
        clientMessageId: "invalid-sender",
      })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("skips repository polling without a cursor and normalizes new messages", async () => {
    await expect(
      pollNewMessagesByToken({
        appointmentId: 9001,
        token: "visit-token-value",
        limit: 10,
      })
    ).resolves.toEqual({ messages: [] });
    expect(visitRepo.pollMessages).not.toHaveBeenCalled();

    vi.mocked(visitRepo.pollMessages).mockResolvedValue([
      message({ id: 13 }) as never,
    ]);
    await expect(
      pollNewMessagesByToken(
        {
          appointmentId: 9001,
          token: "visit-token-value",
          afterId: 12,
          limit: 10,
        },
        requestMetadata
      )
    ).resolves.toMatchObject({ messages: [{ id: 13 }] });
    expect(visitRepo.pollMessages).toHaveBeenCalledWith({
      appointmentId: 9001,
      afterCreatedAt: undefined,
      afterId: 12,
      limit: 10,
    });
  });
});
