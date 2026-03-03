import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  appointmentTokens,
  appointmentStatusEvents,
  appointments,
  type InsertAppointment,
} from "../../../drizzle/schema";
import { getDb } from "../../db";

export type AppointmentStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "confirmed"
  | "in_session"
  | "completed"
  | "expired"
  | "refunded";

export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export type AppointmentTokenRole = "patient" | "doctor";
const ACTIVE_TOKEN_LIMIT_PER_ROLE = 5;

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

export async function getAppointmentByStripeSessionId(stripeSessionId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.stripeSessionId, stripeSessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCheckoutResultByStripeSessionId(stripeSessionId: string) {
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

export async function listActiveAppointmentTokens(input: {
  appointmentId: number;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = input.now ?? new Date();
  return db
    .select({
      id: appointmentTokens.id,
      appointmentId: appointmentTokens.appointmentId,
      role: appointmentTokens.role,
      tokenHash: appointmentTokens.tokenHash,
      expiresAt: appointmentTokens.expiresAt,
      revokedAt: appointmentTokens.revokedAt,
    })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      )
    );
}

export async function getActiveAppointmentTokenByHash(input: {
  tokenHash: string;
  role?: AppointmentTokenRole;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = input.now ?? new Date();
  const whereClause = input.role
    ? and(
        eq(appointmentTokens.tokenHash, input.tokenHash),
        eq(appointmentTokens.role, input.role),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      )
    : and(
        eq(appointmentTokens.tokenHash, input.tokenHash),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      );

  const rows = await db
    .select({
      id: appointmentTokens.id,
      appointmentId: appointmentTokens.appointmentId,
      role: appointmentTokens.role,
      tokenHash: appointmentTokens.tokenHash,
      expiresAt: appointmentTokens.expiresAt,
      revokedAt: appointmentTokens.revokedAt,
    })
    .from(appointmentTokens)
    .where(whereClause)
    .limit(1);

  return rows[0] ?? null;
}

export async function getLatestAppointmentTokenIssuedAt(input: {
  appointmentId: number;
  role: AppointmentTokenRole;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({
      createdAt: appointmentTokens.createdAt,
    })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        eq(appointmentTokens.role, input.role)
      )
    )
    .orderBy(desc(appointmentTokens.createdAt), desc(appointmentTokens.id))
    .limit(1);

  return rows[0]?.createdAt ?? null;
}

export async function updateActiveAppointmentTokenExpiry(input: {
  appointmentId: number;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  await db
    .update(appointmentTokens)
    .set({
      expiresAt: input.expiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      )
    );
}

export async function createAppointmentTokenIfMissing(input: {
  appointmentId: number;
  role: AppointmentTokenRole;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const existing = await db
    .select({ id: appointmentTokens.id })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        eq(appointmentTokens.role, input.role),
        eq(appointmentTokens.tokenHash, input.tokenHash)
      )
    )
    .limit(1);

  if (existing[0]) {
    await revokeOldActiveTokensBeyondLimit({
      db,
      appointmentId: input.appointmentId,
      role: input.role,
    });
    return;
  }

  await db.insert(appointmentTokens).values({
    appointmentId: input.appointmentId,
    role: input.role,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    revokedAt: input.revokedAt ?? null,
  });

  await revokeOldActiveTokensBeyondLimit({
    db,
    appointmentId: input.appointmentId,
    role: input.role,
  });
}

async function revokeOldActiveTokensBeyondLimit(input: {
  db: Awaited<ReturnType<typeof getDb>>;
  appointmentId: number;
  role: AppointmentTokenRole;
}) {
  const db = input.db;
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  const activeRows = await db
    .select({
      id: appointmentTokens.id,
      createdAt: appointmentTokens.createdAt,
    })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        eq(appointmentTokens.role, input.role),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      )
    )
    .orderBy(desc(appointmentTokens.createdAt), desc(appointmentTokens.id));

  if (activeRows.length <= ACTIVE_TOKEN_LIMIT_PER_ROLE) {
    return;
  }

  const revokeIds = activeRows
    .slice(ACTIVE_TOKEN_LIMIT_PER_ROLE)
    .map(row => row.id);

  if (revokeIds.length === 0) {
    return;
  }

  await db
    .update(appointmentTokens)
    .set({
      revokedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(appointmentTokens.id, revokeIds),
        isNull(appointmentTokens.revokedAt)
      )
    );
}

export async function createAppointmentDraft(input: {
  doctorId: number;
  triageSessionId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date;
  email: string;
  amount: number;
  currency: string;
  userId?: number | null;
  sessionId?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.insert(appointments).values({
    doctorId: input.doctorId,
    triageSessionId: input.triageSessionId,
    appointmentType: input.appointmentType,
    scheduledAt: input.scheduledAt,
    status: "draft",
    paymentStatus: "unpaid",
    amount: input.amount,
    currency: input.currency,
    email: input.email,
    userId: input.userId ?? null,
    sessionId: input.sessionId,
    lastAccessAt: null,
    doctorLastAccessAt: null,
  });
}

export async function updateAppointmentById(
  appointmentId: number,
  update: Partial<InsertAppointment>
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

export async function markAppointmentPendingPayment(input: {
  appointmentId: number;
  stripeSessionId: string;
}) {
  return updateAppointmentById(input.appointmentId, {
    stripeSessionId: input.stripeSessionId,
    paymentStatus: "pending",
    status: "pending_payment",
    updatedAt: new Date(),
  });
}

export async function tryMarkPaidByStripeSessionId(input: {
  stripeSessionId: string;
  paidAt?: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  const result = await db
    .update(appointments)
    .set({
      paymentStatus: "paid",
      status: "paid",
      paidAt: input.paidAt ?? now,
      updatedAt: now,
    })
    .where(
      and(
        eq(appointments.stripeSessionId, input.stripeSessionId),
        eq(appointments.paymentStatus, "pending"),
        eq(appointments.status, "pending_payment")
      )
    );

  return Number((result as { affectedRows?: number }).affectedRows ?? 0);
}
export async function findLatestAppointmentIdByLookup(lookup: {
  doctorId: number;
  email: string;
  scheduledAt: Date;
  triageSessionId: number;
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
        eq(appointments.scheduledAt, lookup.scheduledAt),
        eq(appointments.triageSessionId, lookup.triageSessionId)
      )
    )
    .orderBy(desc(appointments.id))
    .limit(1);

  return rows[0]?.id ?? null;
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

export async function insertStatusEvent(input: {
  appointmentId: number;
  fromStatus: string | null;
  toStatus: string;
  operatorType: "system" | "patient" | "doctor" | "admin" | "webhook";
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db.insert(appointmentStatusEvents).values({
    appointmentId: input.appointmentId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    operatorType: input.operatorType,
    operatorId: input.operatorId ?? null,
    reason: input.reason ?? null,
    payloadJson:
      typeof input.payloadJson === "undefined"
        ? null
        : (input.payloadJson as Record<string, unknown>),
  });
}

export async function markAppointmentInSessionIfNeeded(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  const currentStatus = rows[0]?.status;
  if (currentStatus !== "paid" && currentStatus !== "confirmed") {
    return null;
  }

  const result = await db
    .update(appointments)
    .set({ status: "in_session", updatedAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.status, currentStatus)));

  const affectedRows = Number((result as { affectedRows?: number }).affectedRows ?? 0);
  return affectedRows > 0 ? currentStatus : null;
}

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
