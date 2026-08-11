import { asc, desc, eq, or } from "drizzle-orm";
import { appointments } from "../../../drizzle/schema";
import { getDb } from "../../db";

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
    ? or(
        eq(appointments.userId, input.userId),
        eq(appointments.email, input.email!)
      )
    : eq(appointments.userId, input.userId);

  return db
    .select()
    .from(appointments)
    .where(whereClause)
    .orderBy(desc(appointments.createdAt), desc(appointments.id))
    .limit(input.limit);
}

export async function listAppointmentsByUserOrEmail(input: {
  userId: number;
  email?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const hasEmail = Boolean(input.email && input.email.trim().length > 0);
  const whereClause = hasEmail
    ? or(
        eq(appointments.userId, input.userId),
        eq(appointments.email, input.email!)
      )
    : eq(appointments.userId, input.userId);

  return db
    .select()
    .from(appointments)
    .where(whereClause)
    .orderBy(desc(appointments.createdAt), desc(appointments.id));
}

export async function listAppointmentsByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(appointments)
    .where(eq(appointments.email, email))
    .orderBy(desc(appointments.createdAt), desc(appointments.id));
}

export async function listAppointmentsByDoctor(input: {
  doctorId: number;
  limit: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(appointments)
    .where(eq(appointments.doctorId, input.doctorId))
    .orderBy(
      asc(appointments.scheduledAt),
      desc(appointments.createdAt),
      desc(appointments.id)
    )
    .limit(input.limit);
}
