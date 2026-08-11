import { and, eq } from "drizzle-orm";
import {
  doctorScheduleExceptions,
  doctorScheduleRules,
  type InsertDoctorScheduleException,
  type InsertDoctorScheduleRule,
} from "../../../drizzle/schema";
import { type DbExecutor, resolveDbExecutor } from "./repoDb";

export async function listScheduleRules(input: { doctorId?: number }) {
  const db = await resolveDbExecutor();
  const query = db.select().from(doctorScheduleRules);
  if (input.doctorId) {
    return query
      .where(eq(doctorScheduleRules.doctorId, input.doctorId))
      .orderBy(
        doctorScheduleRules.doctorId,
        doctorScheduleRules.weekday,
        doctorScheduleRules.startLocalTime
      );
  }
  return query.orderBy(
    doctorScheduleRules.doctorId,
    doctorScheduleRules.weekday,
    doctorScheduleRules.startLocalTime
  );
}

export async function createScheduleRule(input: InsertDoctorScheduleRule) {
  const db = await resolveDbExecutor();
  const rows = await db.insert(doctorScheduleRules).values(input).returning();
  return rows[0] ?? null;
}

export async function updateScheduleRule(
  id: number,
  input: Partial<InsertDoctorScheduleRule>
) {
  const db = await resolveDbExecutor();
  const rows = await db
    .update(doctorScheduleRules)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(doctorScheduleRules.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteScheduleRule(id: number) {
  const db = await resolveDbExecutor();
  if (!db.delete) {
    throw new Error("Database delete executor is required");
  }
  const rows = await db
    .delete(doctorScheduleRules)
    .where(eq(doctorScheduleRules.id, id))
    .returning({ id: doctorScheduleRules.id });
  return rows.length > 0;
}

export async function getScheduleRuleById(id: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select()
    .from(doctorScheduleRules)
    .where(eq(doctorScheduleRules.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listScheduleExceptions(input: {
  doctorId?: number;
  dateLocal?: string;
}) {
  const db = await resolveDbExecutor();
  const filters = [];
  if (input.doctorId) {
    filters.push(eq(doctorScheduleExceptions.doctorId, input.doctorId));
  }
  if (input.dateLocal) {
    filters.push(eq(doctorScheduleExceptions.dateLocal, input.dateLocal));
  }

  return db
    .select()
    .from(doctorScheduleExceptions)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(doctorScheduleExceptions.dateLocal, doctorScheduleExceptions.id);
}

export async function createScheduleException(
  input: InsertDoctorScheduleException
) {
  const db = await resolveDbExecutor();
  const rows = await db
    .insert(doctorScheduleExceptions)
    .values(input)
    .returning();
  return rows[0] ?? null;
}

export async function updateScheduleException(
  id: number,
  input: Partial<InsertDoctorScheduleException>
) {
  const db = await resolveDbExecutor();
  const rows = await db
    .update(doctorScheduleExceptions)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(doctorScheduleExceptions.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function deleteScheduleException(id: number) {
  const db = await resolveDbExecutor();
  if (!db.delete) {
    throw new Error("Database delete executor is required");
  }
  const rows = await db
    .delete(doctorScheduleExceptions)
    .where(eq(doctorScheduleExceptions.id, id))
    .returning({ id: doctorScheduleExceptions.id });
  return rows.length > 0;
}

export async function getRulesAndExceptionsForDoctor(input: {
  doctorId: number;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const [rules, exceptions] = await Promise.all([
    db
      .select()
      .from(doctorScheduleRules)
      .where(eq(doctorScheduleRules.doctorId, input.doctorId)),
    db
      .select()
      .from(doctorScheduleExceptions)
      .where(eq(doctorScheduleExceptions.doctorId, input.doctorId)),
  ]);

  return { rules, exceptions };
}
