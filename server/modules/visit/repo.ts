import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import {
  appointmentMessages,
  InsertPatientSession,
  patientSessions,
} from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function upsertPatientSession(session: InsertPatientSession) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await db
    .select()
    .from(patientSessions)
    .where(eq(patientSessions.sessionId, session.sessionId))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(patientSessions)
      .set({
        chatHistory: session.chatHistory,
        symptoms: session.symptoms,
        duration: session.duration,
        age: session.age,
        medicalHistory: session.medicalHistory,
        recommendedDoctors: session.recommendedDoctors,
        updatedAt: new Date(),
      })
      .where(eq(patientSessions.sessionId, session.sessionId));
  } else {
    await db.insert(patientSessions).values(session);
  }
}

export async function getPatientSession(sessionId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const results = await db
    .select()
    .from(patientSessions)
    .where(eq(patientSessions.sessionId, sessionId))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

export async function getRecentMessages(appointmentId: number, limit: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(appointmentMessages)
    .where(eq(appointmentMessages.appointmentId, appointmentId))
    .orderBy(desc(appointmentMessages.createdAt), desc(appointmentMessages.id))
    .limit(limit);
}

export async function getMessageByClientMessageId(
  appointmentId: number,
  clientMessageId: string
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await db
    .select()
    .from(appointmentMessages)
    .where(
      and(
        eq(appointmentMessages.appointmentId, appointmentId),
        eq(appointmentMessages.clientMessageId, clientMessageId)
      )
    )
    .limit(1);

  return existing[0] ?? null;
}

export async function getMessageById(id: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(appointmentMessages)
    .where(eq(appointmentMessages.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getLatestMessageCursor(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const latest = await db
    .select({
      id: appointmentMessages.id,
      createdAt: appointmentMessages.createdAt,
    })
    .from(appointmentMessages)
    .where(eq(appointmentMessages.appointmentId, appointmentId))
    .orderBy(desc(appointmentMessages.createdAt), desc(appointmentMessages.id))
    .limit(1);

  return latest[0] ?? null;
}

export async function createMessage(input: {
  appointmentId: number;
  userId?: number | null;
  senderType: "patient" | "doctor" | "system";
  content: string;
  originalContent: string;
  translatedContent: string;
  sourceLanguage: string;
  targetLanguage: string;
  translationProvider?: string | null;
  clientMessageId?: string;
  createdAt: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.insert(appointmentMessages).values({
    appointmentId: input.appointmentId,
    userId: input.userId ?? null,
    senderType: input.senderType,
    content: input.content,
    originalContent: input.originalContent,
    translatedContent: input.translatedContent,
    sourceLanguage: input.sourceLanguage,
    targetLanguage: input.targetLanguage,
    translationProvider: input.translationProvider ?? null,
    clientMessageId: input.clientMessageId ?? null,
    createdAt: input.createdAt,
  });
}

export async function getMessagesBeforeCursor(input: {
  appointmentId: number;
  beforeCreatedAt: Date;
  beforeId: number;
  limit: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(appointmentMessages)
    .where(
      and(
        eq(appointmentMessages.appointmentId, input.appointmentId),
        or(
          lt(appointmentMessages.createdAt, input.beforeCreatedAt),
          and(
            eq(appointmentMessages.createdAt, input.beforeCreatedAt),
            lt(appointmentMessages.id, input.beforeId)
          )
        )
      )
    )
    .orderBy(desc(appointmentMessages.createdAt), desc(appointmentMessages.id))
    .limit(input.limit);
}

export async function getLatestMessage(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const latestRows = await db
    .select({
      id: appointmentMessages.id,
      senderType: appointmentMessages.senderType,
      createdAt: appointmentMessages.createdAt,
    })
    .from(appointmentMessages)
    .where(eq(appointmentMessages.appointmentId, appointmentId))
    .orderBy(desc(appointmentMessages.id))
    .limit(1);

  return latestRows[0] ?? null;
}

export async function pollMessages(input: {
  appointmentId: number;
  afterCreatedAt?: Date;
  afterId?: number;
  limit: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const filters = [eq(appointmentMessages.appointmentId, input.appointmentId)];
  if (input.afterCreatedAt && input.afterId) {
    const createdAtOrIdFilter = or(
      gt(appointmentMessages.createdAt, input.afterCreatedAt),
      and(
        eq(appointmentMessages.createdAt, input.afterCreatedAt),
        gt(appointmentMessages.id, input.afterId)
      )
    );
    if (!createdAtOrIdFilter) {
      return [];
    }
    filters.push(createdAtOrIdFilter);
  } else if (input.afterCreatedAt) {
    filters.push(gt(appointmentMessages.createdAt, input.afterCreatedAt));
  } else if (input.afterId) {
    filters.push(gt(appointmentMessages.id, input.afterId));
  }

  return db
    .select()
    .from(appointmentMessages)
    .where(and(...filters))
    .orderBy(asc(appointmentMessages.createdAt), asc(appointmentMessages.id))
    .limit(input.limit);
}
