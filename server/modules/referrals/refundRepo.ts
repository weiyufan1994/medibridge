import { and, asc, desc, eq } from "drizzle-orm";
import {
  referralOrders,
  refundRequests,
  type InsertRefundRequest,
} from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";

type BaseDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type DbExecutor = Pick<BaseDb, "select" | "insert" | "update">;

async function resolveDbExecutor(dbExecutor?: DbExecutor) {
  const db = dbExecutor ?? (await getDb());
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
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
