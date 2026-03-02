import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { aiChatMessages, aiChatSessions } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function createAiChatSession(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const insertResult = await db.insert(aiChatSessions).values({
    userId,
    status: "active",
  });

  const directInsertId = Number(
    (insertResult as { insertId?: number })?.insertId ??
      (Array.isArray(insertResult)
        ? (insertResult[0] as { insertId?: number } | undefined)?.insertId
        : NaN)
  );

  if (Number.isInteger(directInsertId) && directInsertId > 0) {
    return directInsertId;
  }

  const rows = await db
    .select({ id: aiChatSessions.id })
    .from(aiChatSessions)
    .where(eq(aiChatSessions.userId, userId))
    .orderBy(desc(aiChatSessions.id))
    .limit(1);

  const fallbackId = rows[0]?.id;
  if (!fallbackId) {
    throw new Error("Failed to resolve ai chat session id after insert");
  }

  return fallbackId;
}

export async function countAiChatSessionsByUser(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiChatSessions)
    .where(eq(aiChatSessions.userId, userId));

  return Number(rows[0]?.count ?? 0);
}

export async function countAiChatSessionsByUserBetween(
  userId: number,
  start: Date,
  end: Date
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiChatSessions)
    .where(
      and(
        eq(aiChatSessions.userId, userId),
        gte(aiChatSessions.createdAt, start),
        lt(aiChatSessions.createdAt, end)
      )
    );

  return Number(rows[0]?.count ?? 0);
}

export async function listAiChatSessionsByUser(userId: number, limit: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(aiChatSessions)
    .where(eq(aiChatSessions.userId, userId))
    .orderBy(desc(aiChatSessions.createdAt), desc(aiChatSessions.id))
    .limit(limit);
}

export async function getAiChatSessionById(sessionId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(aiChatSessions)
    .where(eq(aiChatSessions.id, sessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAiChatMessagesBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId))
    .orderBy(aiChatMessages.id);
}

export async function countAiChatMessagesBySessionId(sessionId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId));

  return Number(rows[0]?.count ?? 0);
}

export async function createAiChatMessage(input: {
  sessionId: number;
  role: "user" | "assistant";
  content: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(aiChatMessages).values({
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
  });
}

export async function updateAiChatSessionStatus(
  sessionId: number,
  status: "active" | "completed"
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(aiChatSessions)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(aiChatSessions.id, sessionId));
}
