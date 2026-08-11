import { and, eq } from "drizzle-orm";
import {
  referralOrderOperations,
  referralOrders,
  referralOrderStatusEvents,
  type InsertReferralOrder,
} from "../../../drizzle/schema";
import {
  type ReferralActorType,
  type ReferralOrderStatus,
  type ReferralPaymentProvider,
  type ReferralPaymentStatus,
} from "../../../shared/referrals";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";
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
