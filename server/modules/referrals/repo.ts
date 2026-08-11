import { and, asc, eq, inArray, lte, or } from "drizzle-orm";
import {
  departments,
  hospitals,
  referralContacts,
  referralOrders,
  users,
  type InsertReferralOrder,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import type { ReferralRepoExecutor } from "./orderStateRepo";

type DbExecutor = ReferralRepoExecutor;

async function resolveDbExecutor(dbExecutor?: DbExecutor) {
  const db = dbExecutor ?? (await getDb());
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

export {
  getContactById,
  getDepartmentById,
  getHospitalById,
  listActiveContactsByHospital,
  listDepartmentsByHospitalId,
  listHospitalsForReferralCatalog,
  listReferralContactsForAdmin,
  updateHospitalActive,
  updateReferralContactActive,
  upsertHospital,
  upsertReferralContact,
} from "./catalogRepo";
export {
  isOrderOwnedByUser,
  listMineReferralOrders,
  listOperationsByOrderId,
  listReferralOrdersForAdmin,
  listStatusEventsByOrderId,
} from "./orderListReadRepo";
export {
  claimReferralNotification,
  enqueueReferralNotification,
  listDueReferralNotificationIds,
  listFailedReferralNotificationsByOrderId,
  markReferralNotificationFailed,
  markReferralNotificationSent,
} from "./notificationOutboxRepo";
export {
  createRefundRequest,
  getLatestRefundRequestByOrderId,
  listRefundProcessingOrders,
  updateRefundRequestById,
} from "./refundRepo";
export {
  insertOperation,
  insertStatusEvent,
  markOrderPaymentFailed,
  markOrderPendingPayment,
  tryMarkOrderPaidByPaymentSessionId,
  tryTransitionOrderById,
  updateReferralOrderById,
  type ReferralRepoExecutor,
} from "./orderStateRepo";

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
