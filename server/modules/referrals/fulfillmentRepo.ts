import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { referralOrders } from "../../../drizzle/schema";
import { getDb } from "../../db";

async function resolveDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

export async function listExpiredReferralSlaOrders(input: {
  now: Date;
  limit: number;
}) {
  const db = await resolveDb();
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
