import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  createMessage,
  getLatestMessage,
  getLatestMessageCursor,
  getMessageByClientMessageId,
  getMessageById,
  getMessagesBeforeCursor,
  getPatientSession,
  getRecentMessages,
  pollMessages,
  upsertPatientSession,
} from "./repo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

function buildSelectDb(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const query = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit,
  };
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  const from = vi.fn(() => query);
  const select = vi.fn(() => ({ from }));
  return { db: { select }, select, from, query, limit };
}

const session = {
  sessionId: "session-1",
  userId: 42,
  chatHistory: "history",
  symptoms: "headache",
  duration: "two days",
  age: 36,
  medicalHistory: "none",
  recommendedDoctors: "[]",
};

const createdAt = new Date("2026-08-14T01:00:00.000Z");

describe("visit repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["upsertPatientSession", () => upsertPatientSession(session as never)],
    ["getPatientSession", () => getPatientSession("session-1")],
    ["getRecentMessages", () => getRecentMessages(10, 20)],
    [
      "getMessageByClientMessageId",
      () => getMessageByClientMessageId(10, "client-1"),
    ],
    ["getMessageById", () => getMessageById(1)],
    ["getLatestMessageCursor", () => getLatestMessageCursor(10)],
    [
      "createMessage",
      () =>
        createMessage({
          appointmentId: 10,
          senderType: "patient",
          content: "hello",
          originalContent: "hello",
          translatedContent: "hello",
          sourceLanguage: "en",
          targetLanguage: "en",
          createdAt,
        }),
    ],
    [
      "getMessagesBeforeCursor",
      () =>
        getMessagesBeforeCursor({
          appointmentId: 10,
          beforeCreatedAt: createdAt,
          beforeId: 5,
          limit: 20,
        }),
    ],
    ["getLatestMessage", () => getLatestMessage(10)],
    [
      "pollMessages",
      () => pollMessages({ appointmentId: 10, afterId: 1, limit: 20 }),
    ],
  ])(
    "fails closed when storage is unavailable for %s",
    async (_name, invoke) => {
      vi.mocked(getDb).mockResolvedValue(null);

      await expect(invoke()).rejects.toThrow("Database not available");
    }
  );

  it("updates an existing patient session without replacing identity fields", async () => {
    const { db } = buildSelectDb([{ id: 1 }]);
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    vi.mocked(getDb).mockResolvedValue({ ...db, update } as never);

    await upsertPatientSession(session as never);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        chatHistory: "history",
        symptoms: "headache",
        updatedAt: expect.any(Date),
      })
    );
    expect(set).not.toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: "session-1", userId: 42 })
    );
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("inserts a patient session when no matching row exists", async () => {
    const { db } = buildSelectDb([]);
    const values = vi.fn(async () => undefined);
    const insert = vi.fn(() => ({ values }));
    vi.mocked(getDb).mockResolvedValue({ ...db, insert } as never);

    await upsertPatientSession(session as never);

    expect(values).toHaveBeenCalledWith(session);
  });

  it("returns an existing patient session or null", async () => {
    const row = { id: 1, sessionId: "session-1" };
    vi.mocked(getDb).mockResolvedValue(buildSelectDb([row]).db as never);
    await expect(getPatientSession("session-1")).resolves.toEqual(row);

    vi.mocked(getDb).mockResolvedValue(buildSelectDb([]).db as never);
    await expect(getPatientSession("missing")).resolves.toBeNull();
  });

  it("preserves limits for recent and before-cursor history queries", async () => {
    const recent = buildSelectDb([{ id: 2 }]);
    vi.mocked(getDb).mockResolvedValue(recent.db as never);
    await expect(getRecentMessages(10, 25)).resolves.toEqual([{ id: 2 }]);
    expect(recent.query.orderBy).toHaveBeenCalledTimes(1);
    expect(recent.limit).toHaveBeenCalledWith(25);

    const before = buildSelectDb([{ id: 1 }]);
    vi.mocked(getDb).mockResolvedValue(before.db as never);
    await expect(
      getMessagesBeforeCursor({
        appointmentId: 10,
        beforeCreatedAt: createdAt,
        beforeId: 2,
        limit: 15,
      })
    ).resolves.toEqual([{ id: 1 }]);
    expect(before.query.where).toHaveBeenCalledTimes(1);
    expect(before.query.orderBy).toHaveBeenCalledTimes(1);
    expect(before.limit).toHaveBeenCalledWith(15);
  });

  it("returns message lookup rows and null for missing values", async () => {
    const byClient = { id: 3, clientMessageId: "client-1" };
    vi.mocked(getDb).mockResolvedValue(buildSelectDb([byClient]).db as never);
    await expect(getMessageByClientMessageId(10, "client-1")).resolves.toEqual(
      byClient
    );

    vi.mocked(getDb).mockResolvedValue(buildSelectDb([]).db as never);
    await expect(
      getMessageByClientMessageId(10, "missing")
    ).resolves.toBeNull();
    await expect(getMessageById(999)).resolves.toBeNull();
  });

  it("returns latest cursor and latest message rows or null", async () => {
    const cursor = { id: 4, createdAt };
    vi.mocked(getDb).mockResolvedValue(buildSelectDb([cursor]).db as never);
    await expect(getLatestMessageCursor(10)).resolves.toEqual(cursor);

    const latest = { id: 5, senderType: "doctor", createdAt };
    vi.mocked(getDb).mockResolvedValue(buildSelectDb([latest]).db as never);
    await expect(getLatestMessage(10)).resolves.toEqual(latest);

    vi.mocked(getDb).mockResolvedValue(buildSelectDb([]).db as never);
    await expect(getLatestMessage(10)).resolves.toBeNull();
  });

  it("inserts normalized nullable message fields and returns the row", async () => {
    const returned = { id: 6, senderType: "patient", createdAt };
    const returning = vi.fn(async () => [returned]);
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    vi.mocked(getDb).mockResolvedValue({ insert } as never);

    await expect(
      createMessage({
        appointmentId: 10,
        senderType: "patient",
        content: "hello",
        originalContent: "hello",
        translatedContent: "hello",
        sourceLanguage: "en",
        targetLanguage: "en",
        createdAt,
      })
    ).resolves.toEqual(returned);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        translationProvider: null,
        clientMessageId: null,
      })
    );

    returning.mockResolvedValue([]);
    await expect(
      createMessage({
        appointmentId: 10,
        userId: 42,
        senderType: "doctor",
        content: "reply",
        originalContent: "reply",
        translatedContent: "reply",
        sourceLanguage: "en",
        targetLanguage: "zh",
        translationProvider: "llm",
        clientMessageId: "client-2",
        createdAt,
      })
    ).resolves.toBeNull();
  });

  it.each([
    [{ afterCreatedAt: createdAt, afterId: 3 }, "both"],
    [{ afterCreatedAt: createdAt }, "created-at"],
    [{ afterId: 3 }, "id"],
    [{}, "appointment-only"],
  ] as const)("polls using the %s cursor shape", async (cursor, _label) => {
    const query = buildSelectDb([{ id: 7 }]);
    vi.mocked(getDb).mockResolvedValue(query.db as never);

    await expect(
      pollMessages({ appointmentId: 10, limit: 30, ...cursor })
    ).resolves.toEqual([{ id: 7 }]);
    expect(query.query.where).toHaveBeenCalledTimes(1);
    expect(query.query.orderBy).toHaveBeenCalledTimes(1);
    expect(query.limit).toHaveBeenCalledWith(30);
  });
});
