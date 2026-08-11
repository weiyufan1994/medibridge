import { and, desc, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import {
  doctorSlots,
  type DoctorSlot,
  type InsertDoctorSlot,
} from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { SLOT_HOLD_MINUTES } from "./constants";
import { type DbExecutor, resolveDbExecutor } from "./repoDb";

export async function listFutureSlots(input: {
  doctorId: number;
  appointmentType?: DoctorSlot["appointmentType"];
  now?: Date;
}) {
  const db = await resolveDbExecutor();
  const now = input.now ?? new Date();
  const filters = [
    eq(doctorSlots.doctorId, input.doctorId),
    eq(doctorSlots.status, "open"),
    gt(doctorSlots.startAt, now),
  ];
  if (input.appointmentType) {
    filters.push(eq(doctorSlots.appointmentType, input.appointmentType));
  }

  return db
    .select()
    .from(doctorSlots)
    .where(and(...filters))
    .orderBy(doctorSlots.startAt);
}

export async function createManualSlots(input: {
  slots: InsertDoctorSlot[];
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  if (input.slots.length === 0) {
    return [] as DoctorSlot[];
  }
  return db
    .insert(doctorSlots)
    .values(input.slots)
    .onConflictDoNothing()
    .returning();
}

export async function removeRuleGeneratedSlotsInWindow(input: {
  ruleId: number;
  startAt: Date;
  endAt: Date;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  if (!db.delete) {
    throw new Error("Database delete executor is required");
  }
  const rows = await db
    .delete(doctorSlots)
    .where(
      and(
        eq(doctorSlots.scheduleRuleId, input.ruleId),
        eq(doctorSlots.source, "rule"),
        gte(doctorSlots.startAt, input.startAt),
        lte(doctorSlots.startAt, input.endAt),
        inArray(doctorSlots.status, ["open", "blocked", "expired"]),
        isNull(doctorSlots.appointmentId)
      )
    )
    .returning({ id: doctorSlots.id });

  return rows.length;
}

export async function getSlotById(slotId: number, dbExecutor?: DbExecutor) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(doctorSlots)
    .where(eq(doctorSlots.id, slotId))
    .limit(1);
  return rows[0] ?? null;
}

export async function holdSlot(input: {
  slotId: number;
  heldBySessionId: string;
  holdMinutes?: number;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const now = new Date();
  const holdExpiresAt = new Date(
    now.getTime() + (input.holdMinutes ?? SLOT_HOLD_MINUTES) * 60_000
  );
  const rows = await db
    .update(doctorSlots)
    .set({
      status: "held",
      heldBySessionId: input.heldBySessionId,
      holdExpiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(doctorSlots.id, input.slotId),
        eq(doctorSlots.status, "open"),
        gt(doctorSlots.startAt, now)
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function attachHeldSlotToAppointment(input: {
  slotId: number;
  appointmentId: number;
  heldBySessionId: string;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .update(doctorSlots)
    .set({
      appointmentId: input.appointmentId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(doctorSlots.id, input.slotId),
        eq(doctorSlots.status, "held"),
        eq(doctorSlots.heldBySessionId, input.heldBySessionId)
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function releaseHeldSlotByAppointmentId(input: {
  appointmentId: number;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const result = await db
    .update(doctorSlots)
    .set({
      status: "open",
      holdExpiresAt: null,
      heldBySessionId: null,
      appointmentId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(doctorSlots.appointmentId, input.appointmentId),
        eq(doctorSlots.status, "held")
      )
    );

  return extractAffectedRows(result);
}

export async function bookHeldSlotByAppointmentId(input: {
  appointmentId: number;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .update(doctorSlots)
    .set({
      status: "booked",
      holdExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(doctorSlots.appointmentId, input.appointmentId),
        eq(doctorSlots.status, "held")
      )
    )
    .returning();

  if (rows[0]) {
    return rows[0];
  }

  const existing = await db
    .select()
    .from(doctorSlots)
    .where(
      and(
        eq(doctorSlots.appointmentId, input.appointmentId),
        eq(doctorSlots.status, "booked")
      )
    )
    .limit(1);
  return existing[0] ?? null;
}

export async function releaseExpiredHolds(input?: {
  now?: Date;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input?.dbExecutor);
  const now = input?.now ?? new Date();
  const result = await db
    .update(doctorSlots)
    .set({
      status: "open",
      holdExpiresAt: null,
      heldBySessionId: null,
      appointmentId: null,
      updatedAt: now,
    })
    .where(
      and(eq(doctorSlots.status, "held"), lte(doctorSlots.holdExpiresAt, now))
    );
  return extractAffectedRows(result);
}

export async function blockSlot(slotId: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .update(doctorSlots)
    .set({
      status: "blocked",
      holdExpiresAt: null,
      heldBySessionId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(doctorSlots.id, slotId),
        inArray(doctorSlots.status, ["open", "held"])
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function unblockSlot(slotId: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .update(doctorSlots)
    .set({
      status: "open",
      updatedAt: new Date(),
    })
    .where(eq(doctorSlots.id, slotId))
    .returning();
  return rows[0] ?? null;
}

export async function listUpcomingSlotsByDoctor(input: {
  doctorId: number;
  now?: Date;
}) {
  const db = await resolveDbExecutor();
  const now = input.now ?? new Date();
  return db
    .select()
    .from(doctorSlots)
    .where(
      and(
        eq(doctorSlots.doctorId, input.doctorId),
        gt(doctorSlots.startAt, now)
      )
    )
    .orderBy(desc(doctorSlots.startAt));
}

export async function getSlotSummaryCountsByDoctor(doctorId: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select({
      status: doctorSlots.status,
      count: sql<number>`count(*)::int`,
    })
    .from(doctorSlots)
    .where(eq(doctorSlots.doctorId, doctorId))
    .groupBy(doctorSlots.status);

  return rows;
}
