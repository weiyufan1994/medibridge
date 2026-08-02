import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  departments,
  hospitals,
  referralContacts,
  referralNotificationOutbox,
  referralOrderOperations,
  referralOrders,
  referralOrderStatusEvents,
  refundRequests,
  users,
  type InsertReferralContact,
  type InsertReferralNotificationOutbox,
  type InsertReferralOrder,
  type InsertRefundRequest,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import { extractAffectedRows } from "../../_core/dbCompat";
import {
  type ReferralActorType,
  type ReferralOrderStatus,
  type ReferralPaymentProvider,
  type ReferralPaymentStatus,
} from "../../../shared/referrals";
import {
  isAllowedPaymentStatusForReferralOrder,
  isAllowedReferralStatusTransition,
} from "./stateMachine";

type BaseDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
export type ReferralRepoExecutor = Pick<BaseDb, "select" | "insert" | "update">;
type DbExecutor = ReferralRepoExecutor;

async function resolveDbExecutor(dbExecutor?: DbExecutor) {
  const db = dbExecutor ?? (await getDb());
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

type ReferralOrderRow = typeof referralOrders.$inferSelect;
type UpsertReferralContactValues = InsertReferralContact & { id?: number };

async function readOrderStateById(input: {
  orderId: number;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .select({
      id: referralOrders.id,
      status: referralOrders.status,
      paymentStatus: referralOrders.paymentStatus,
      paymentProviderSessionId: referralOrders.paymentProviderSessionId,
    })
    .from(referralOrders)
    .where(eq(referralOrders.id, input.orderId))
    .limit(1);

  return rows[0] ?? null;
}

async function readOrderStateByPaymentSessionId(input: {
  paymentSessionId: string;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .select({
      id: referralOrders.id,
      status: referralOrders.status,
      paymentStatus: referralOrders.paymentStatus,
      paymentProviderSessionId: referralOrders.paymentProviderSessionId,
    })
    .from(referralOrders)
    .where(eq(referralOrders.paymentProviderSessionId, input.paymentSessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getHospitalById(hospitalId: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select()
    .from(hospitals)
    .where(eq(hospitals.id, hospitalId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getDepartmentById(departmentId: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getContactById(contactId: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select()
    .from(referralContacts)
    .where(eq(referralContacts.id, contactId))
    .limit(1);

  return rows[0] ?? null;
}

export async function listActiveContactsByHospital(input: {
  hospitalId: number;
  departmentId?: number | null;
}) {
  const db = await resolveDbExecutor();
  const filters = [
    eq(referralContacts.hospitalId, input.hospitalId),
    eq(referralContacts.isActive, 1),
  ];

  if (typeof input.departmentId === "number" && input.departmentId > 0) {
    filters.push(eq(referralContacts.departmentId, input.departmentId));
  }

  return db
    .select()
    .from(referralContacts)
    .where(and(...filters))
    .orderBy(
      asc(referralContacts.avgResponseTimeMinutes),
      desc(referralContacts.successRate),
      asc(referralContacts.id)
    );
}

export async function createReferralOrder(input: {
  values: InsertReferralOrder;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .insert(referralOrders)
    .values(input.values)
    .onConflictDoNothing({
      target: [referralOrders.patientUserId, referralOrders.clientRequestId],
    })
    .returning({ id: referralOrders.id });

  return rows[0]?.id ?? null;
}

export async function getReferralOrderByClientRequest(input: {
  patientUserId: number;
  clientRequestId: string;
}) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select()
    .from(referralOrders)
    .where(
      and(
        eq(referralOrders.patientUserId, input.patientUserId),
        eq(referralOrders.clientRequestId, input.clientRequestId)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getReferralOrderById(
  orderId: number,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(referralOrders)
    .where(eq(referralOrders.id, orderId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getReferralOrderByPaymentSessionId(
  paymentSessionId: string,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(referralOrders)
    .where(eq(referralOrders.paymentProviderSessionId, paymentSessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getReferralOrderByProviderReference(input: {
  providerRefundId?: string | null;
  providerTransactionId?: string | null;
}) {
  const db = await resolveDbExecutor();
  const filters = [];
  if (input.providerRefundId) {
    filters.push(
      eq(referralOrders.paymentProviderRefundId, input.providerRefundId)
    );
  }
  if (input.providerTransactionId) {
    filters.push(
      eq(
        referralOrders.paymentProviderTransactionId,
        input.providerTransactionId
      )
    );
  }
  if (filters.length === 0) {
    return null;
  }

  const rows = await db
    .select()
    .from(referralOrders)
    .where(or(...filters))
    .limit(1);

  return rows[0] ?? null;
}

export async function getReferralOrderBundleById(orderId: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select({
      order: referralOrders,
      hospital: hospitals,
      department: departments,
      contact: referralContacts,
      patient: users,
    })
    .from(referralOrders)
    .leftJoin(hospitals, eq(referralOrders.hospitalId, hospitals.id))
    .leftJoin(departments, eq(referralOrders.departmentId, departments.id))
    .leftJoin(
      referralContacts,
      eq(referralOrders.contactId, referralContacts.id)
    )
    .leftJoin(users, eq(referralOrders.patientUserId, users.id))
    .where(eq(referralOrders.id, orderId))
    .limit(1);

  return rows[0] ?? null;
}

export async function updateReferralOrderById(input: {
  orderId: number;
  update: Partial<InsertReferralOrder>;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const result = await db
    .update(referralOrders)
    .set({
      ...input.update,
      updatedAt: new Date(),
    })
    .where(eq(referralOrders.id, input.orderId));

  return extractAffectedRows(result);
}

export async function insertStatusEvent(input: {
  orderId: number;
  fromStatus: string | null;
  toStatus: string;
  actorType: ReferralActorType;
  actorId?: number | null;
  reason?: string | null;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  await db.insert(referralOrderStatusEvents).values({
    orderId: input.orderId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    reason: input.reason ?? null,
  });
}

export async function insertOperation(input: {
  orderId: number;
  operatorType: ReferralActorType;
  operatorId?: number | null;
  actionType: string;
  actionPayload?: unknown;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  await db.insert(referralOrderOperations).values({
    orderId: input.orderId,
    operatorType: input.operatorType,
    operatorId: input.operatorId ?? null,
    actionType: input.actionType,
    actionPayload:
      typeof input.actionPayload === "undefined"
        ? null
        : (input.actionPayload as Record<string, unknown>),
  });
}

export async function tryTransitionOrderById(input: {
  orderId: number;
  allowedFrom: ReferralOrderStatus[];
  toStatus: ReferralOrderStatus;
  toPaymentStatus: ReferralPaymentStatus;
  actorType: ReferralActorType;
  actorId?: number | null;
  reason?: string | null;
  update?: Partial<InsertReferralOrder>;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const current = await readOrderStateById({
    orderId: input.orderId,
    dbExecutor: db,
  });

  if (!current) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const currentStatus = current.status as ReferralOrderStatus;
  const currentPaymentStatus = current.paymentStatus as ReferralPaymentStatus;
  const allowedFromState = input.allowedFrom.includes(currentStatus);
  const allowedTransition = isAllowedReferralStatusTransition(
    currentStatus,
    input.toStatus
  );
  const allowedPair = isAllowedPaymentStatusForReferralOrder(
    input.toStatus,
    input.toPaymentStatus
  );

  if (!allowedFromState || !allowedTransition || !allowedPair) {
    return {
      ok: false as const,
      reason: "illegal_transition" as const,
      current,
    };
  }

  const result = await db
    .update(referralOrders)
    .set({
      status: input.toStatus,
      paymentStatus: input.toPaymentStatus,
      updatedAt: new Date(),
      ...(input.update ?? {}),
    })
    .where(
      and(
        eq(referralOrders.id, current.id),
        eq(referralOrders.status, current.status),
        eq(referralOrders.paymentStatus, current.paymentStatus)
      )
    );

  if (extractAffectedRows(result) !== 1) {
    return { ok: false as const, reason: "conflict" as const, current };
  }

  if (
    currentStatus !== input.toStatus ||
    currentPaymentStatus !== input.toPaymentStatus
  ) {
    await insertStatusEvent({
      orderId: current.id,
      fromStatus: current.status,
      toStatus: input.toStatus,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      reason: input.reason ?? null,
      dbExecutor: db,
    });
  }

  return { ok: true as const, reason: "updated" as const, current };
}

export async function markOrderPendingPayment(input: {
  orderId: number;
  paymentSessionId: string;
  paymentProvider: ReferralPaymentProvider;
  dbExecutor?: DbExecutor;
}) {
  return tryTransitionOrderById({
    orderId: input.orderId,
    allowedFrom: ["pending_payment"],
    toStatus: "pending_payment",
    toPaymentStatus: "pending",
    actorType: "system",
    reason: "checkout_session_created",
    update: {
      paymentProvider: input.paymentProvider,
      paymentProviderSessionId: input.paymentSessionId,
    },
    dbExecutor: input.dbExecutor,
  });
}

export async function markOrderPaymentFailed(input: {
  orderId: number;
  reason: string;
  actorType?: ReferralActorType;
  dbExecutor?: DbExecutor;
}) {
  return tryTransitionOrderById({
    orderId: input.orderId,
    allowedFrom: ["pending_payment"],
    toStatus: "pending_payment",
    toPaymentStatus: "failed",
    actorType: input.actorType ?? "webhook",
    reason: input.reason,
    dbExecutor: input.dbExecutor,
  });
}

export async function tryMarkOrderPaidByPaymentSessionId(input: {
  paymentSessionId: string;
  actorType?: ReferralActorType;
  reason?: string | null;
  paidAt?: Date;
  fulfillmentDeadlineAt?: Date;
  paymentProviderTransactionId?: string | null;
  dbExecutor?: DbExecutor;
}) {
  return tryTransitionOrderById({
    orderId:
      (
        await readOrderStateByPaymentSessionId({
          paymentSessionId: input.paymentSessionId,
          dbExecutor: input.dbExecutor,
        })
      )?.id ?? 0,
    allowedFrom: ["pending_payment"],
    toStatus: "paid_pending_assignment",
    toPaymentStatus: "paid",
    actorType: input.actorType ?? "webhook",
    reason: input.reason ?? "payment_settled",
    update: {
      paidAt: input.paidAt ?? new Date(),
      fulfillmentDeadlineAt: input.fulfillmentDeadlineAt,
      paymentProviderTransactionId:
        input.paymentProviderTransactionId ?? undefined,
    },
    dbExecutor: input.dbExecutor,
  });
}

export async function listExpiredReferralSlaOrders(input: {
  now: Date;
  limit: number;
}) {
  const db = await resolveDbExecutor();
  return db
    .select()
    .from(referralOrders)
    .where(
      and(
        inArray(referralOrders.status, [
          "paid_pending_assignment",
          "assigned",
          "contacting",
          "booking_in_progress",
        ]),
        eq(referralOrders.paymentStatus, "paid"),
        lte(referralOrders.fulfillmentDeadlineAt, input.now)
      )
    )
    .orderBy(asc(referralOrders.fulfillmentDeadlineAt), asc(referralOrders.id))
    .limit(input.limit);
}

export async function listRefundProcessingOrders(limit: number) {
  const db = await resolveDbExecutor();
  return db
    .select()
    .from(referralOrders)
    .where(
      and(
        eq(referralOrders.status, "refund_processing"),
        eq(referralOrders.paymentStatus, "paid")
      )
    )
    .orderBy(asc(referralOrders.updatedAt), asc(referralOrders.id))
    .limit(limit);
}

export async function listStatusEventsByOrderId(orderId: number) {
  const db = await resolveDbExecutor();
  return db
    .select()
    .from(referralOrderStatusEvents)
    .where(eq(referralOrderStatusEvents.orderId, orderId))
    .orderBy(
      desc(referralOrderStatusEvents.createdAt),
      desc(referralOrderStatusEvents.id)
    );
}

export async function listOperationsByOrderId(orderId: number) {
  const db = await resolveDbExecutor();
  return db
    .select()
    .from(referralOrderOperations)
    .where(eq(referralOrderOperations.orderId, orderId))
    .orderBy(
      desc(referralOrderOperations.createdAt),
      desc(referralOrderOperations.id)
    );
}

export async function getLatestRefundRequestByOrderId(orderId: number) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select()
    .from(refundRequests)
    .where(eq(refundRequests.orderId, orderId))
    .orderBy(desc(refundRequests.createdAt), desc(refundRequests.id))
    .limit(1);

  return rows[0] ?? null;
}

export async function createRefundRequest(input: {
  values: InsertRefundRequest;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .insert(refundRequests)
    .values(input.values)
    .returning({ id: refundRequests.id });

  return rows[0]?.id ?? null;
}

export async function updateRefundRequestById(input: {
  refundRequestId: number;
  update: Partial<InsertRefundRequest>;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const result = await db
    .update(refundRequests)
    .set({
      ...input.update,
      updatedAt: new Date(),
    })
    .where(eq(refundRequests.id, input.refundRequestId));

  return extractAffectedRows(result);
}

export async function enqueueReferralNotification(input: {
  values: InsertReferralNotificationOutbox;
}) {
  const db = await resolveDbExecutor();
  await db
    .insert(referralNotificationOutbox)
    .values(input.values)
    .onConflictDoNothing({
      target: referralNotificationOutbox.dedupeKey,
    });
}

export async function listDueReferralNotificationIds(input: {
  now: Date;
  staleProcessingBefore: Date;
  limit: number;
}) {
  const db = await resolveDbExecutor();
  const rows = await db
    .select({ id: referralNotificationOutbox.id })
    .from(referralNotificationOutbox)
    .where(
      or(
        and(
          eq(referralNotificationOutbox.status, "pending"),
          lte(referralNotificationOutbox.nextAttemptAt, input.now)
        ),
        and(
          eq(referralNotificationOutbox.status, "processing"),
          lte(
            referralNotificationOutbox.processingStartedAt,
            input.staleProcessingBefore
          )
        )
      )
    )
    .orderBy(
      asc(referralNotificationOutbox.nextAttemptAt),
      asc(referralNotificationOutbox.id)
    )
    .limit(input.limit);

  return rows.map(row => row.id);
}

export async function claimReferralNotification(input: {
  notificationId: number;
  now: Date;
  staleProcessingBefore: Date;
}) {
  const db = await resolveDbExecutor();
  const result = await db
    .update(referralNotificationOutbox)
    .set({
      status: "processing",
      processingStartedAt: input.now,
      attemptCount: sql`${referralNotificationOutbox.attemptCount} + 1`,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(referralNotificationOutbox.id, input.notificationId),
        or(
          eq(referralNotificationOutbox.status, "pending"),
          and(
            eq(referralNotificationOutbox.status, "processing"),
            lte(
              referralNotificationOutbox.processingStartedAt,
              input.staleProcessingBefore
            )
          )
        )
      )
    );

  if (extractAffectedRows(result) !== 1) {
    return null;
  }

  const rows = await db
    .select()
    .from(referralNotificationOutbox)
    .where(eq(referralNotificationOutbox.id, input.notificationId))
    .limit(1);

  return rows[0] ?? null;
}

export async function markReferralNotificationSent(input: {
  notificationId: number;
  sentAt: Date;
}) {
  const db = await resolveDbExecutor();
  await db
    .update(referralNotificationOutbox)
    .set({
      status: "sent",
      sentAt: input.sentAt,
      lastError: null,
      processingStartedAt: null,
      updatedAt: input.sentAt,
    })
    .where(eq(referralNotificationOutbox.id, input.notificationId));
}

export async function markReferralNotificationFailed(input: {
  notificationId: number;
  error: string;
  nextAttemptAt: Date;
  terminal: boolean;
}) {
  const db = await resolveDbExecutor();
  await db
    .update(referralNotificationOutbox)
    .set({
      status: input.terminal ? "failed" : "pending",
      lastError: input.error,
      nextAttemptAt: input.nextAttemptAt,
      processingStartedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(referralNotificationOutbox.id, input.notificationId));
}

export async function listFailedReferralNotificationsByOrderId(
  orderId: number
) {
  const db = await resolveDbExecutor();
  return db
    .select()
    .from(referralNotificationOutbox)
    .where(
      and(
        eq(referralNotificationOutbox.orderId, orderId),
        eq(referralNotificationOutbox.status, "failed")
      )
    )
    .orderBy(
      desc(referralNotificationOutbox.updatedAt),
      desc(referralNotificationOutbox.id)
    );
}

export async function listMineReferralOrders(input: {
  patientUserId: number;
  limit: number;
}) {
  const db = await resolveDbExecutor();
  return db
    .select({
      order: referralOrders,
      hospital: hospitals,
      department: departments,
      contact: referralContacts,
      refundRequest: refundRequests,
    })
    .from(referralOrders)
    .leftJoin(hospitals, eq(referralOrders.hospitalId, hospitals.id))
    .leftJoin(departments, eq(referralOrders.departmentId, departments.id))
    .leftJoin(
      referralContacts,
      eq(referralOrders.contactId, referralContacts.id)
    )
    .leftJoin(
      refundRequests,
      and(
        eq(refundRequests.orderId, referralOrders.id),
        isNull(refundRequests.refundedAt)
      )
    )
    .where(eq(referralOrders.patientUserId, input.patientUserId))
    .orderBy(desc(referralOrders.createdAt), desc(referralOrders.id))
    .limit(input.limit);
}

export async function listReferralOrdersForAdmin(input: {
  page: number;
  pageSize: number;
  status?: ReferralOrderStatus;
  assignedToUserId?: number;
  hospitalId?: number;
  sortDirection?: "asc" | "desc";
}) {
  const db = await resolveDbExecutor();
  const page = Math.max(1, input.page);
  const pageSize = Math.min(Math.max(1, input.pageSize), 100);
  const offset = (page - 1) * pageSize;

  const filters = [];
  if (input.status) {
    filters.push(eq(referralOrders.status, input.status));
  }
  if (
    typeof input.assignedToUserId === "number" &&
    input.assignedToUserId > 0
  ) {
    filters.push(eq(referralOrders.assignedAgentId, input.assignedToUserId));
  }
  if (typeof input.hospitalId === "number" && input.hospitalId > 0) {
    filters.push(eq(referralOrders.hospitalId, input.hospitalId));
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;
  const direction = input.sortDirection === "asc" ? asc : desc;

  const rows = await db
    .select({
      order: referralOrders,
      hospital: hospitals,
      department: departments,
      contact: referralContacts,
      patient: users,
      urgencyMinutes: sql<number>`greatest(cast(extract(epoch from (now() - ${referralOrders.updatedAt})) / 60 as integer), 0)`,
    })
    .from(referralOrders)
    .leftJoin(hospitals, eq(referralOrders.hospitalId, hospitals.id))
    .leftJoin(departments, eq(referralOrders.departmentId, departments.id))
    .leftJoin(
      referralContacts,
      eq(referralOrders.contactId, referralContacts.id)
    )
    .leftJoin(users, eq(referralOrders.patientUserId, users.id))
    .where(whereClause)
    .orderBy(direction(referralOrders.updatedAt), desc(referralOrders.id))
    .limit(pageSize)
    .offset(offset);

  const totalRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(referralOrders)
    .where(whereClause);
  const total = Number(totalRows[0]?.count ?? 0);

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows,
  };
}

export async function listHospitalsForReferralCatalog() {
  const db = await resolveDbExecutor();
  return db
    .select()
    .from(hospitals)
    .orderBy(asc(hospitals.name), asc(hospitals.id));
}

export async function listDepartmentsByHospitalId(hospitalId: number) {
  const db = await resolveDbExecutor();
  return db
    .select()
    .from(departments)
    .where(eq(departments.hospitalId, hospitalId))
    .orderBy(asc(departments.name), asc(departments.id));
}

export async function listReferralContactsForAdmin(input?: {
  hospitalId?: number;
}) {
  const db = await resolveDbExecutor();
  const whereClause =
    typeof input?.hospitalId === "number" && input.hospitalId > 0
      ? eq(referralContacts.hospitalId, input.hospitalId)
      : undefined;

  return db
    .select()
    .from(referralContacts)
    .where(whereClause)
    .orderBy(
      asc(referralContacts.hospitalId),
      asc(referralContacts.departmentId),
      asc(referralContacts.id)
    );
}

function sanitizeInsertReferralContact(input: UpsertReferralContactValues) {
  return {
    ...input,
    languages: Array.isArray(input.languages) ? input.languages : [],
    specialtyTags: Array.isArray(input.specialtyTags)
      ? input.specialtyTags
      : [],
    updatedAt: new Date(),
  };
}

export async function upsertReferralContact(input: {
  values: UpsertReferralContactValues;
}) {
  const db = await resolveDbExecutor();
  const sanitized = sanitizeInsertReferralContact(input.values);

  if (typeof sanitized.id === "number" && sanitized.id > 0) {
    const { id, ...rest } = sanitized;
    await db
      .update(referralContacts)
      .set(rest)
      .where(eq(referralContacts.id, id));

    return getContactById(id);
  }

  const rows = await db
    .insert(referralContacts)
    .values(sanitized)
    .returning({ id: referralContacts.id });

  const contactId = rows[0]?.id;
  return typeof contactId === "number" ? getContactById(contactId) : null;
}

export async function updateReferralContactActive(input: {
  contactId: number;
  isActive: boolean;
}) {
  const db = await resolveDbExecutor();
  const result = await db
    .update(referralContacts)
    .set({
      isActive: input.isActive ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(referralContacts.id, input.contactId));

  return extractAffectedRows(result);
}

export async function upsertHospital(input: {
  id?: number;
  name: string;
  nameEn?: string;
  city?: string;
  cityEn?: string;
  isActive: boolean;
}) {
  const db = await resolveDbExecutor();
  if (typeof input.id === "number" && input.id > 0) {
    await db
      .update(hospitals)
      .set({
        name: input.name,
        nameEn: input.nameEn ?? null,
        city: input.city ?? "上海",
        cityEn: input.cityEn ?? null,
        isActive: input.isActive ? 1 : 0,
        updatedAt: new Date(),
      })
      .where(eq(hospitals.id, input.id));

    return getHospitalById(input.id);
  }

  const rows = await db
    .insert(hospitals)
    .values({
      name: input.name,
      nameEn: input.nameEn ?? null,
      city: input.city ?? "上海",
      cityEn: input.cityEn ?? null,
      isActive: input.isActive ? 1 : 0,
    })
    .returning({ id: hospitals.id });

  const hospitalId = rows[0]?.id;
  return typeof hospitalId === "number" ? getHospitalById(hospitalId) : null;
}

export async function updateHospitalActive(input: {
  hospitalId: number;
  isActive: boolean;
}) {
  const db = await resolveDbExecutor();
  const result = await db
    .update(hospitals)
    .set({
      isActive: input.isActive ? 1 : 0,
      updatedAt: new Date(),
    })
    .where(eq(hospitals.id, input.hospitalId));

  return extractAffectedRows(result);
}

export function isOrderOwnedByUser(order: ReferralOrderRow, userId: number) {
  return order.patientUserId === userId;
}
