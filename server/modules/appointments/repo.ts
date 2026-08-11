import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNull,
  like,
  lt,
  gte,
  or,
  sql,
} from "drizzle-orm";
import {
  appointmentTokens,
  appointmentStatusEvents,
  appointments,
  stripeWebhookEvents,
  type InsertAppointment,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import { type AppointmentStatus, type PaymentStatus } from "./stateMachine";
import { extractAffectedRows } from "../../_core/dbCompat";
import { insertStatusEvent } from "./lifecycleRepo";
import {
  resolveAppointmentRepoExecutor as resolveDbExecutor,
  type AppointmentRepoExecutor,
} from "./repoExecutor";

export {
  getActiveAppointmentTokenByHash,
  getAppointmentTokenByHash,
  getAppointmentTokenCooldownRemainingSeconds,
  getLatestAppointmentTokenIssuedAt,
  listActiveAppointmentTokens,
} from "./tokenReadRepo";
export type { AppointmentTokenRole } from "./tokenReadRepo";
export {
  createAppointmentTokenIfMissing,
  revokeAppointmentTokens,
  saveTokenFirstSeen,
  updateActiveAppointmentTokenExpiry,
  updateTokenUsageIfAllowed,
} from "./tokenWriteRepo";
export {
  insertStatusEvent,
  markAppointmentPendingPayment,
  recordIllegalStatusTransition,
  tryMarkPaidByStripeSessionId,
  tryTransitionAppointmentById,
  tryTransitionAppointmentByStripeSessionId,
} from "./lifecycleRepo";
export {
  getMedicalSummaryByAppointmentId,
  upsertMedicalSummaryByAppointmentId,
} from "./medicalSummaryRepo";

type PaymentProvider = "stripe" | "paypal";
type DbExecutor = AppointmentRepoExecutor;
export type { AppointmentRepoExecutor };

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
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);

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

export async function createAppointmentDraft(input: {
  slotId?: number | null;
  doctorId: number;
  triageSessionId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date;
  email: string;
  amount: number;
  currency: string;
  userId?: number | null;
  sessionId?: string;
  notes?: string | null;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);

  const rows = await db
    .insert(appointments)
    .values({
      slotId: input.slotId ?? null,
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
      notes: input.notes ?? null,
      lastAccessAt: null,
      doctorLastAccessAt: null,
    })
    .returning({ id: appointments.id });

  return rows[0]?.id ?? null;
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

export async function updateAppointmentNotesIfMatch(input: {
  appointmentId: number;
  expectedNotes: string | null;
  nextNotes: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const expectedClause =
    input.expectedNotes === null
      ? isNull(appointments.notes)
      : eq(appointments.notes, input.expectedNotes);

  const result = await db
    .update(appointments)
    .set({
      notes: input.nextNotes,
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, input.appointmentId), expectedClause));

  return extractAffectedRows(result);
}

export async function findLatestAppointmentIdByLookup(lookup: {
  slotId?: number | null;
  doctorId: number;
  email: string;
  scheduledAt: Date;
  triageSessionId: number;
  status?: AppointmentStatus;
  paymentStatus?: PaymentStatus;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(lookup.dbExecutor);

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

export async function listAppointmentsForAdmin(input: {
  page?: number;
  pageSize?: number;
  status?: AppointmentStatus;
  paymentStatus?: PaymentStatus;
  emailQuery?: string;
  doctorId?: number;
  amountMin?: number;
  amountMax?: number;
  createdAtFrom?: Date | string;
  createdAtTo?: Date | string;
  scheduledAtFrom?: Date | string;
  scheduledAtTo?: Date | string;
  hasRisk?: boolean;
  sortBy?:
    | "createdAt"
    | "scheduledAt"
    | "amount"
    | "status"
    | "paymentStatus"
    | "id";
  sortDirection?: "asc" | "desc";
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const page =
    Number.isInteger(input.page) && input.page! > 0 ? input.page! : 1;
  const pageSize =
    Number.isInteger(input.pageSize) && input.pageSize! > 0
      ? Math.min(200, input.pageSize!)
      : 50;
  const offset = (page - 1) * pageSize;
  const now = new Date();
  const pendingPaymentTimeoutThreshold = new Date(
    now.getTime() - 30 * 60 * 1000
  );
  const tokenExpiryThreshold = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const createdAtFrom =
    input.createdAtFrom instanceof Date
      ? input.createdAtFrom
      : typeof input.createdAtFrom === "string" &&
          input.createdAtFrom.trim().length > 0
        ? new Date(input.createdAtFrom)
        : null;
  const createdAtTo =
    input.createdAtTo instanceof Date
      ? input.createdAtTo
      : typeof input.createdAtTo === "string" &&
          input.createdAtTo.trim().length > 0
        ? new Date(input.createdAtTo)
        : null;
  const scheduledAtFrom =
    input.scheduledAtFrom instanceof Date
      ? input.scheduledAtFrom
      : typeof input.scheduledAtFrom === "string" &&
          input.scheduledAtFrom.trim().length > 0
        ? new Date(input.scheduledAtFrom)
        : null;
  const scheduledAtTo =
    input.scheduledAtTo instanceof Date
      ? input.scheduledAtTo
      : typeof input.scheduledAtTo === "string" &&
          input.scheduledAtTo.trim().length > 0
        ? new Date(input.scheduledAtTo)
        : null;
  const validCreatedAtFrom =
    createdAtFrom instanceof Date && !Number.isNaN(createdAtFrom.getTime());
  const validCreatedAtTo =
    createdAtTo instanceof Date && !Number.isNaN(createdAtTo.getTime());
  const validScheduledAtFrom =
    scheduledAtFrom instanceof Date && !Number.isNaN(scheduledAtFrom.getTime());
  const validScheduledAtTo =
    scheduledAtTo instanceof Date && !Number.isNaN(scheduledAtTo.getTime());

  const hasPendingPaymentTimeout = sql<boolean>`${appointments.status} = 'pending_payment'
    AND ${appointments.paymentStatus} = 'pending'
    AND ${appointments.createdAt} <= ${pendingPaymentTimeoutThreshold}`;
  const hasWebhookFailure = sql<boolean>`EXISTS (
    SELECT 1
    FROM ${stripeWebhookEvents}
    WHERE ${stripeWebhookEvents.appointmentId} = ${appointments.id}
      AND (
        ${stripeWebhookEvents.type} LIKE '%failed%' OR
        ${stripeWebhookEvents.type} LIKE '%invalid%' OR
        ${stripeWebhookEvents.type} LIKE '%error%' OR
        ${stripeWebhookEvents.type} LIKE '%malformed%' OR
        ${stripeWebhookEvents.type} LIKE '%unavailable%'
      )
  )`;
  const hasTokenExpiringSoon = sql<boolean>`EXISTS (
    SELECT 1
    FROM ${appointmentTokens}
    WHERE ${appointmentTokens.appointmentId} = ${appointments.id}
      AND ${appointmentTokens.revokedAt} IS NULL
      AND ${appointmentTokens.expiresAt} > ${now}
      AND ${appointmentTokens.expiresAt} <= ${tokenExpiryThreshold}
  )`;
  const hasTokenUsageExhausted = sql<boolean>`EXISTS (
    SELECT 1
    FROM ${appointmentTokens}
    WHERE ${appointmentTokens.appointmentId} = ${appointments.id}
      AND ${appointmentTokens.revokedAt} IS NULL
      AND ${appointmentTokens.useCount} >= ${appointmentTokens.maxUses}
  )`;

  const filters = [];
  if (input.status) {
    filters.push(eq(appointments.status, input.status));
  }
  if (input.paymentStatus) {
    filters.push(eq(appointments.paymentStatus, input.paymentStatus));
  }
  if (input.emailQuery && input.emailQuery.trim().length > 0) {
    filters.push(like(appointments.email, `%${input.emailQuery.trim()}%`));
  }
  if (
    input.doctorId &&
    Number.isInteger(input.doctorId) &&
    input.doctorId > 0
  ) {
    filters.push(eq(appointments.doctorId, input.doctorId));
  }
  if (typeof input.amountMin === "number" && Number.isFinite(input.amountMin)) {
    filters.push(gt(appointments.amount, input.amountMin - 1));
  }
  if (typeof input.amountMax === "number" && Number.isFinite(input.amountMax)) {
    filters.push(lt(appointments.amount, input.amountMax + 1));
  }
  if (validCreatedAtFrom) {
    filters.push(gt(appointments.createdAt, createdAtFrom!));
  }
  if (validCreatedAtTo) {
    filters.push(lt(appointments.createdAt, createdAtTo!));
  }
  if (validScheduledAtFrom) {
    filters.push(gt(appointments.scheduledAt, scheduledAtFrom!));
  }
  if (validScheduledAtTo) {
    filters.push(lt(appointments.scheduledAt, scheduledAtTo!));
  }
  if (input.hasRisk) {
    filters.push(
      sql`(
        ${hasPendingPaymentTimeout}
        OR ${hasWebhookFailure}
        OR ${hasTokenExpiringSoon}
        OR ${hasTokenUsageExhausted}
      )`
    );
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const sortBy = input.sortBy ?? "createdAt";
  const sortDirection = input.sortDirection === "asc" ? asc : desc;
  const sortColumn =
    sortBy === "amount"
      ? appointments.amount
      : sortBy === "scheduledAt"
        ? appointments.scheduledAt
        : sortBy === "id"
          ? appointments.id
          : sortBy === "status"
            ? appointments.status
            : sortBy === "paymentStatus"
              ? appointments.paymentStatus
              : appointments.createdAt;

  const rows = await db
    .select({
      id: appointments.id,
      userId: appointments.userId,
      email: appointments.email,
      doctorId: appointments.doctorId,
      triageSessionId: appointments.triageSessionId,
      appointmentType: appointments.appointmentType,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      amount: appointments.amount,
      currency: appointments.currency,
      stripeSessionId: appointments.stripeSessionId,
      scheduledAt: appointments.scheduledAt,
      paidAt: appointments.paidAt,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      hasPendingPaymentTimeout,
      hasWebhookFailure,
      hasTokenExpiringSoon,
      hasTokenUsageExhausted,
    })
    .from(appointments)
    .where(whereClause)
    .orderBy(sortDirection(sortColumn), desc(appointments.id))
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointments)
    .where(whereClause);
  const total = Number(totalRows[0]?.count ?? 0);

  const items = rows.map(row => {
    const riskCodes = [
      row.hasPendingPaymentTimeout ? "PENDING_PAYMENT_TIMEOUT" : null,
      row.hasWebhookFailure ? "WEBHOOK_FAILURE" : null,
      row.hasTokenExpiringSoon ? "TOKEN_EXPIRING_SOON" : null,
      row.hasTokenUsageExhausted ? "TOKEN_USAGE_EXHAUSTED" : null,
    ].filter(Boolean) as string[];

    return {
      id: row.id,
      userId: row.userId,
      email: row.email,
      doctorId: row.doctorId,
      triageSessionId: row.triageSessionId,
      appointmentType: row.appointmentType,
      status: row.status,
      paymentStatus: row.paymentStatus,
      amount: row.amount,
      currency: row.currency,
      stripeSessionId: row.stripeSessionId,
      scheduledAt: row.scheduledAt,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      riskCodes,
      hasRisk: riskCodes.length > 0,
    };
  });

  const riskSummary = {
    total: items.length,
    pendingPaymentTimeout: items.filter(item =>
      item.riskCodes.includes("PENDING_PAYMENT_TIMEOUT")
    ).length,
    webhookFailure: items.filter(item =>
      item.riskCodes.includes("WEBHOOK_FAILURE")
    ).length,
    tokenExpiringSoon: items.filter(item =>
      item.riskCodes.includes("TOKEN_EXPIRING_SOON")
    ).length,
    tokenUsageExhausted: items.filter(item =>
      item.riskCodes.includes("TOKEN_USAGE_EXHAUSTED")
    ).length,
  };

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items,
    riskSummary,
  } as const;
}

export async function insertStripeWebhookEvent(input: {
  eventId: string;
  type: string;
  provider?: PaymentProvider;
  stripeSessionId?: string | null;
  appointmentId?: number | null;
  resourceType?: string | null;
  resourceId?: number | null;
  payloadHash?: string | null;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);

  await db.insert(stripeWebhookEvents).values({
    eventId: input.eventId,
    type: input.type,
    provider: input.provider ?? "stripe",
    stripeSessionId: input.stripeSessionId ?? null,
    appointmentId: input.appointmentId ?? null,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    payloadHash: input.payloadHash ?? null,
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
  if (currentStatus !== "paid") {
    return null;
  }

  const result = await db
    .update(appointments)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(appointments.id, appointmentId),
        eq(appointments.status, currentStatus)
      )
    );

  const affectedRows = extractAffectedRows(result);
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

export async function getStripeWebhookEventById(eventId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.eventId, eventId))
    .limit(1);

  return rows[0] ?? null;
}

export async function listStripeWebhookEventsForAppointment(input: {
  appointmentId: number;
  stripeSessionId?: string | null;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = input.limit ?? 100;
  const filters = [eq(stripeWebhookEvents.appointmentId, input.appointmentId)];
  if (input.stripeSessionId && input.stripeSessionId.trim().length > 0) {
    filters.push(
      eq(stripeWebhookEvents.stripeSessionId, input.stripeSessionId.trim())
    );
  }

  return db
    .select()
    .from(stripeWebhookEvents)
    .where(or(...filters))
    .orderBy(desc(stripeWebhookEvents.createdAt))
    .limit(limit);
}
