import { and, desc, eq, isNull } from "drizzle-orm";
import { appointments } from "../../../drizzle/schema";
import { getDb } from "../../db";
import {
  resolveAppointmentRepoExecutor,
  type AppointmentRepoExecutor,
} from "./repoExecutor";
import { type AppointmentStatus, type PaymentStatus } from "./stateMachine";

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

export async function getAppointmentByStripeSessionId(
  stripeSessionId: string,
  dbExecutor?: AppointmentRepoExecutor
) {
  const db = await resolveAppointmentRepoExecutor(dbExecutor);

  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.stripeSessionId, stripeSessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCheckoutResultByStripeSessionId(
  stripeSessionId: string
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({
      id: appointments.id,
      paymentStatus: appointments.paymentStatus,
      status: appointments.status,
      email: appointments.email,
      lastAccessAt: appointments.lastAccessAt,
      paidAt: appointments.paidAt,
    })
    .from(appointments)
    .where(eq(appointments.stripeSessionId, stripeSessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function findLatestAppointmentIdByLookup(lookup: {
  slotId?: number | null;
  doctorId: number;
  email: string;
  scheduledAt: Date;
  triageSessionId: number;
  status?: AppointmentStatus;
  paymentStatus?: PaymentStatus;
  dbExecutor?: AppointmentRepoExecutor;
}) {
  const db = await resolveAppointmentRepoExecutor(lookup.dbExecutor);

  let whereClause = and(
    typeof lookup.slotId === "number"
      ? eq(appointments.slotId, lookup.slotId)
      : isNull(appointments.slotId),
    eq(appointments.doctorId, lookup.doctorId),
    eq(appointments.email, lookup.email),
    eq(appointments.scheduledAt, lookup.scheduledAt),
    eq(appointments.triageSessionId, lookup.triageSessionId)
  );
  if (lookup.status) {
    whereClause = and(whereClause, eq(appointments.status, lookup.status));
  }
  if (lookup.paymentStatus) {
    whereClause = and(
      whereClause,
      eq(appointments.paymentStatus, lookup.paymentStatus)
    );
  }

  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(whereClause)
    .orderBy(desc(appointments.id))
    .limit(1);

  return rows[0]?.id ?? null;
}
