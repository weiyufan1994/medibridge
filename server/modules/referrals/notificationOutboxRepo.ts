import { and, asc, desc, eq, lte, or, sql } from "drizzle-orm";
import {
  referralNotificationOutbox,
  type InsertReferralNotificationOutbox,
} from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";

async function resolveDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

export async function enqueueReferralNotification(input: {
  values: InsertReferralNotificationOutbox;
}) {
  const db = await resolveDb();
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
  const db = await resolveDb();
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
  const db = await resolveDb();
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
  const db = await resolveDb();
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
  const db = await resolveDb();
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
  const db = await resolveDb();
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
