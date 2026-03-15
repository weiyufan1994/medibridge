import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { aiChatMessages, aiChatSessions } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function createAiChatSession(userId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .insert(aiChatSessions)
    .values({
      userId,
      status: "active",
    })
    .returning({ id: aiChatSessions.id });

  const insertedId = rows[0]?.id;
  if (!insertedId) {
    throw new Error("Failed to resolve ai chat session id after insert");
  }

  return insertedId;
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

export async function listFirstUserMessagesBySessionIds(sessionIds: number[]) {
  if (sessionIds.length === 0) {
    return new Map<number, string>();
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const normalizedIds = Array.from(
    new Set(sessionIds.filter(id => Number.isInteger(id) && id > 0))
  );
  if (normalizedIds.length === 0) {
    return new Map<number, string>();
  }

  const rows = await db
    .select({
      sessionId: aiChatMessages.sessionId,
      content: aiChatMessages.content,
    })
    .from(aiChatMessages)
    .where(
      and(
        sql`${aiChatMessages.sessionId} in ${normalizedIds}`,
        eq(aiChatMessages.role, "user"),
        sql`${aiChatMessages.id} = (
          select min(msg.id)
          from ${aiChatMessages} as msg
          where msg.sessionId = ${aiChatMessages.sessionId}
            and msg.role = 'user'
        )`
      )
    );

  return new Map(
    rows.map(row => [row.sessionId, row.content] as const)
  );
}

export async function listAiChatSessionsForAdmin(input: {
  limit: number;
  status?: "active" | "completed";
  userId?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const filters = [];
  if (input.status) {
    filters.push(eq(aiChatSessions.status, input.status));
  }
  if (typeof input.userId === "number") {
    filters.push(eq(aiChatSessions.userId, input.userId));
  }

  return db
    .select()
    .from(aiChatSessions)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(aiChatSessions.createdAt), desc(aiChatSessions.id))
    .limit(input.limit);
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

export async function setAiChatSessionSummaryIfEmpty(
  sessionId: number,
  summary: string
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(aiChatSessions)
    .set({
      summary,
      summaryGeneratedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(aiChatSessions.id, sessionId), sql`${aiChatSessions.summary} is null`)
    );
}
