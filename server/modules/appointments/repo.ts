import { and, desc, eq, or } from "drizzle-orm";
import { appointments } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function getAppointmentById(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAppointmentByAccessTokenHash(accessTokenHash: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.accessTokenHash, accessTokenHash))
    .limit(1);

  return rows[0] ?? null;
}

export async function createAppointment(input: {
  doctorId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date;
  sessionId?: string;
  email: string;
  accessTokenHash: string;
  doctorTokenHash: string;
  accessTokenExpiresAt: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.insert(appointments).values({
    doctorId: input.doctorId,
    appointmentType: input.appointmentType,
    scheduledAt: input.scheduledAt,
    status: "confirmed",
    sessionId: input.sessionId,
    email: input.email,
    accessTokenHash: input.accessTokenHash,
    doctorTokenHash: input.doctorTokenHash,
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    accessTokenRevokedAt: null,
    doctorTokenRevokedAt: null,
    lastAccessAt: null,
    doctorLastAccessAt: null,
  });
}

export async function findLatestAppointmentIdByLookup(lookup: {
  doctorId: number;
  email: string;
  scheduledAt: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, lookup.doctorId),
        eq(appointments.email, lookup.email),
        eq(appointments.scheduledAt, lookup.scheduledAt)
      )
    )
    .orderBy(desc(appointments.id))
    .limit(1);

  return rows[0]?.id ?? null;
}

export async function updateAppointmentById(
  appointmentId: number,
  update: Partial<typeof appointments.$inferInsert>
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(appointments)
    .set(update)
    .where(eq(appointments.id, appointmentId));
}

export async function bindAppointmentsToUserByEmail(
  email: string,
  userId: number
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(appointments)
    .set({ userId })
    .where(eq(appointments.email, email));
}

export async function listAppointmentsByUserScope(input: {
  userId: number;
  email?: string | null;
  limit: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const hasEmail = Boolean(input.email && input.email.trim().length > 0);
  const whereClause = hasEmail
    ? or(eq(appointments.userId, input.userId), eq(appointments.email, input.email!))
    : eq(appointments.userId, input.userId);

  return db
    .select()
    .from(appointments)
    .where(whereClause)
    .orderBy(desc(appointments.createdAt), desc(appointments.id))
    .limit(input.limit);
}
