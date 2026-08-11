import { desc, eq, or } from "drizzle-orm";
import { stripeWebhookEvents } from "../../../drizzle/schema";
import { getDb } from "../../db";
import {
  resolveAppointmentRepoExecutor,
  type AppointmentRepoExecutor,
} from "./repoExecutor";

type PaymentProvider = "stripe" | "paypal";

export async function insertStripeWebhookEvent(input: {
  eventId: string;
  type: string;
  provider?: PaymentProvider;
  stripeSessionId?: string | null;
  appointmentId?: number | null;
  resourceType?: string | null;
  resourceId?: number | null;
  payloadHash?: string | null;
  dbExecutor?: AppointmentRepoExecutor;
}) {
  const db = await resolveAppointmentRepoExecutor(input.dbExecutor);

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
