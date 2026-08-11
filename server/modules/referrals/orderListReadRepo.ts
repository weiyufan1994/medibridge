import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import {
  departments,
  hospitals,
  referralContacts,
  referralOrderOperations,
  referralOrders,
  referralOrderStatusEvents,
  refundRequests,
  users,
} from "../../../drizzle/schema";
import { type ReferralOrderStatus } from "../../../shared/referrals";
import { getDb } from "../../db";

type ReferralOrderRow = typeof referralOrders.$inferSelect;

async function resolveDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

export async function listStatusEventsByOrderId(orderId: number) {
  const db = await resolveDb();
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
  const db = await resolveDb();
  return db
    .select()
    .from(referralOrderOperations)
    .where(eq(referralOrderOperations.orderId, orderId))
    .orderBy(
      desc(referralOrderOperations.createdAt),
      desc(referralOrderOperations.id)
    );
}

export async function listMineReferralOrders(input: {
  patientUserId: number;
  limit: number;
}) {
  const db = await resolveDb();
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
  const db = await resolveDb();
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

export function isOrderOwnedByUser(order: ReferralOrderRow, userId: number) {
  return order.patientUserId === userId;
}
