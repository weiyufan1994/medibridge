import { and, desc, eq, gte, like, lt, sql } from "drizzle-orm";
import { appointmentStatusEvents } from "../../../drizzle/schema";
import { getDb } from "../../db";

export async function countStatusEventsByAppointment(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointmentStatusEvents)
    .where(eq(appointmentStatusEvents.appointmentId, appointmentId));

  return Number(rows[0]?.count ?? 0);
}

export async function listStatusEventsByAppointment(input: {
  appointmentId: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = input.limit ?? 100;
  return db
    .select()
    .from(appointmentStatusEvents)
    .where(eq(appointmentStatusEvents.appointmentId, input.appointmentId))
    .orderBy(
      desc(appointmentStatusEvents.createdAt),
      desc(appointmentStatusEvents.id)
    )
    .limit(limit);
}

export async function hasAppointmentStatusReason(input: {
  appointmentId: number;
  reason: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointmentStatusEvents)
    .where(
      and(
        eq(appointmentStatusEvents.appointmentId, input.appointmentId),
        eq(appointmentStatusEvents.reason, input.reason)
      )
    )
    .limit(1);

  return Number(rows[0]?.count ?? 0) > 0;
}

export async function listAppointmentStatusEventsForAdmin(input: {
  page: number;
  pageSize: number;
  operatorId?: number;
  actionType?: string;
  from?: Date;
  to?: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
  const pageSize =
    Number.isInteger(input.pageSize) && input.pageSize > 0
      ? Math.min(200, input.pageSize)
      : 50;
  const offset = (page - 1) * pageSize;

  const filters = [
    eq(appointmentStatusEvents.operatorType, "admin"),
    like(appointmentStatusEvents.reason, "admin_%"),
  ];

  if (typeof input.operatorId === "number" && input.operatorId > 0) {
    filters.push(eq(appointmentStatusEvents.operatorId, input.operatorId));
  }

  if (input.actionType && input.actionType.trim().length > 0) {
    filters.push(
      like(appointmentStatusEvents.reason, `%${input.actionType.trim()}%`)
    );
  }

  const from =
    input.from instanceof Date && !Number.isNaN(input.from.getTime())
      ? input.from
      : null;
  const to =
    input.to instanceof Date && !Number.isNaN(input.to.getTime())
      ? input.to
      : null;
  if (from) {
    filters.push(gte(appointmentStatusEvents.createdAt, from));
  }
  if (to) {
    const toInclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    filters.push(lt(appointmentStatusEvents.createdAt, toInclusive));
  }

  const whereClause = and(...filters);

  const rows = await db
    .select()
    .from(appointmentStatusEvents)
    .where(whereClause)
    .orderBy(
      desc(appointmentStatusEvents.createdAt),
      desc(appointmentStatusEvents.id)
    )
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointmentStatusEvents)
    .where(whereClause);
  const total = Number(totalRows[0]?.count ?? 0);

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map(event => ({
      id: event.id,
      appointmentId: event.appointmentId,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      operatorType: event.operatorType,
      operatorId: event.operatorId,
      reason: event.reason,
      payloadJson: event.payloadJson,
      createdAt: event.createdAt,
    })),
  } as const;
}
