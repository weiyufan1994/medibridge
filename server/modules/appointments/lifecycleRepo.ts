import { and, eq } from "drizzle-orm";
import {
  appointmentStatusEvents,
  appointments,
  type InsertAppointment,
} from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import {
  resolveAppointmentRepoExecutor,
  type AppointmentRepoExecutor,
} from "./repoExecutor";
import {
  type AppointmentStatus,
  type PaymentStatus,
  isAllowedPaymentStatusForAppointment,
  isAllowedStatusTransition,
} from "./stateMachine";

type DbExecutor = AppointmentRepoExecutor;
const resolveDbExecutor = resolveAppointmentRepoExecutor;
type PaymentProvider = "stripe" | "paypal";

type TransitionOperator = "system" | "patient" | "doctor" | "admin" | "webhook";

async function readAppointmentStateById(input: {
  appointmentId: number;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      stripeSessionId: appointments.stripeSessionId,
    })
    .from(appointments)
    .where(eq(appointments.id, input.appointmentId))
    .limit(1);

  return rows[0] ?? null;
}

async function readAppointmentStateByStripeSessionId(input: {
  stripeSessionId: string;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      stripeSessionId: appointments.stripeSessionId,
    })
    .from(appointments)
    .where(eq(appointments.stripeSessionId, input.stripeSessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function recordIllegalStatusTransition(input: {
  appointmentId: number;
  fromStatus: AppointmentStatus;
  attemptedStatus: AppointmentStatus;
  attemptedPaymentStatus: PaymentStatus;
  operatorType: TransitionOperator;
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
  dbExecutor?: DbExecutor;
}) {
  await insertStatusEvent({
    appointmentId: input.appointmentId,
    fromStatus: input.fromStatus,
    toStatus: input.fromStatus,
    operatorType: input.operatorType,
    operatorId: input.operatorId ?? null,
    reason: input.reason ?? "illegal_transition_attempt",
    payloadJson: {
      attemptedStatus: input.attemptedStatus,
      attemptedPaymentStatus: input.attemptedPaymentStatus,
      ...(typeof input.payloadJson === "object" && input.payloadJson
        ? (input.payloadJson as Record<string, unknown>)
        : {}),
    },
    dbExecutor: input.dbExecutor,
  });
}

export async function tryTransitionAppointmentById(input: {
  appointmentId: number;
  allowedFrom: AppointmentStatus[];
  toStatus: AppointmentStatus;
  toPaymentStatus: PaymentStatus;
  operatorType: TransitionOperator;
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
  update?: Partial<InsertAppointment>;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const current = await readAppointmentStateById({
    appointmentId: input.appointmentId,
    dbExecutor: db,
  });
  if (!current) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const allowedFromState = input.allowedFrom.includes(
    current.status as AppointmentStatus
  );
  const allowedTransition = isAllowedStatusTransition(
    current.status as AppointmentStatus,
    input.toStatus
  );
  const allowedPair = isAllowedPaymentStatusForAppointment(
    input.toStatus,
    input.toPaymentStatus
  );

  if (!allowedFromState || !allowedTransition || !allowedPair) {
    await recordIllegalStatusTransition({
      appointmentId: current.id,
      fromStatus: current.status as AppointmentStatus,
      attemptedStatus: input.toStatus,
      attemptedPaymentStatus: input.toPaymentStatus,
      operatorType: input.operatorType,
      operatorId: input.operatorId,
      reason: input.reason ?? "illegal_transition_attempt",
      payloadJson: input.payloadJson,
      dbExecutor: db,
    });
    return {
      ok: false as const,
      reason: "illegal_transition" as const,
      current,
    };
  }

  const now = new Date();
  const result = await db
    .update(appointments)
    .set({
      status: input.toStatus,
      paymentStatus: input.toPaymentStatus,
      updatedAt: now,
      ...(input.update ?? {}),
    })
    .where(
      and(
        eq(appointments.id, current.id),
        eq(appointments.status, current.status),
        eq(appointments.paymentStatus, current.paymentStatus)
      )
    );

  const affectedRows = extractAffectedRows(result);
  if (affectedRows !== 1) {
    return { ok: false as const, reason: "conflict" as const, current };
  }

  if (
    current.status !== input.toStatus ||
    current.paymentStatus !== input.toPaymentStatus
  ) {
    await insertStatusEvent({
      appointmentId: current.id,
      fromStatus: current.status,
      toStatus: input.toStatus,
      operatorType: input.operatorType,
      operatorId: input.operatorId ?? null,
      reason: input.reason ?? null,
      payloadJson: input.payloadJson,
      dbExecutor: db,
    });
  }

  return { ok: true as const, reason: "updated" as const, current };
}

export async function tryTransitionAppointmentByStripeSessionId(input: {
  stripeSessionId: string;
  allowedFrom: AppointmentStatus[];
  toStatus: AppointmentStatus;
  toPaymentStatus: PaymentStatus;
  operatorType: TransitionOperator;
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
  update?: Partial<InsertAppointment>;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const current = await readAppointmentStateByStripeSessionId({
    stripeSessionId: input.stripeSessionId,
    dbExecutor: db,
  });
  if (!current) {
    return { ok: false as const, reason: "not_found" as const };
  }

  return tryTransitionAppointmentById({
    appointmentId: current.id,
    allowedFrom: input.allowedFrom,
    toStatus: input.toStatus,
    toPaymentStatus: input.toPaymentStatus,
    operatorType: input.operatorType,
    operatorId: input.operatorId,
    reason: input.reason,
    payloadJson: {
      stripeSessionId: input.stripeSessionId,
      ...(typeof input.payloadJson === "object" && input.payloadJson
        ? (input.payloadJson as Record<string, unknown>)
        : {}),
    },
    update: input.update,
    dbExecutor: db,
  });
}

export async function markAppointmentPendingPayment(input: {
  appointmentId: number;
  stripeSessionId: string;
  paymentProvider?: PaymentProvider;
}) {
  return tryTransitionAppointmentById({
    appointmentId: input.appointmentId,
    allowedFrom: ["draft", "pending_payment"],
    toStatus: "pending_payment",
    toPaymentStatus: "pending",
    operatorType: "system",
    reason: "checkout_session_created",
    payloadJson: {
      stripeSessionId: input.stripeSessionId,
    },
    update: {
      stripeSessionId: input.stripeSessionId,
      paymentProvider: input.paymentProvider ?? "stripe",
    },
  });
}

export async function tryMarkPaidByStripeSessionId(input: {
  stripeSessionId: string;
  paidAt?: Date;
  operatorType?: TransitionOperator;
  reason?: string | null;
  payloadJson?: unknown;
  dbExecutor?: DbExecutor;
}) {
  const transitioned = await tryTransitionAppointmentByStripeSessionId({
    stripeSessionId: input.stripeSessionId,
    allowedFrom: ["pending_payment"],
    toStatus: "paid",
    toPaymentStatus: "paid",
    operatorType: input.operatorType ?? "webhook",
    reason: input.reason ?? "stripe_webhook_paid",
    payloadJson: input.payloadJson,
    update: {
      paidAt: input.paidAt ?? new Date(),
    },
    dbExecutor: input.dbExecutor,
  });

  return transitioned.ok ? 1 : 0;
}

export async function insertStatusEvent(input: {
  appointmentId: number;
  fromStatus: string | null;
  toStatus: string;
  operatorType: "system" | "patient" | "doctor" | "admin" | "webhook";
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);

  await db.insert(appointmentStatusEvents).values({
    appointmentId: input.appointmentId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    operatorType: input.operatorType,
    operatorId: input.operatorId ?? null,
    reason: input.reason ?? null,
    payloadJson:
      typeof input.payloadJson === "undefined"
        ? null
        : (input.payloadJson as Record<string, unknown>),
  });
}
