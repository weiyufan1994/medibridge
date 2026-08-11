import { and, asc, desc, eq, gt, like, lt, sql } from "drizzle-orm";
import {
  appointmentTokens,
  appointments,
  stripeWebhookEvents,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import { type AppointmentStatus, type PaymentStatus } from "./stateMachine";

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
