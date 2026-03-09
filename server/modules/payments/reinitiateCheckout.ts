import { TRPCError } from "@trpc/server";
import type { appointments } from "../../../drizzle/schema";
import * as appointmentsRepo from "../appointments/repo";
import {
  APPOINTMENT_INVALID_TRANSITION_ERROR,
  CHECKOUT_REINIT_ALLOWED_FROM,
  CHECKOUT_REINIT_BLOCKED_STATUSES,
} from "../appointments/stateMachine";
import { createStripeCheckoutSession } from "./stripe";

type AppointmentRow = typeof appointments.$inferSelect;

export async function reinitiateCheckoutForAppointment(input: {
  appointment: AppointmentRow;
  baseUrl: string;
  operatorType: "system" | "patient" | "admin";
  operatorId: number | null;
}) {
  if (
    input.appointment.paymentStatus === "paid" ||
    CHECKOUT_REINIT_BLOCKED_STATUSES.includes(input.appointment.status)
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  const normalizedBaseUrl = input.baseUrl.trim().replace(/\/$/, "");
  if (!normalizedBaseUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "APP_BASE_URL_MISSING",
    });
  }

  const checkout = createStripeCheckoutSession({
    appointmentId: input.appointment.id,
    amount: input.appointment.amount,
    currency: input.appointment.currency,
    successUrl: `${normalizedBaseUrl}/payment/success`,
    cancelUrl: `${normalizedBaseUrl}/payment/cancel`,
  });

  await appointmentsRepo.revokeAppointmentTokens({
    appointmentId: input.appointment.id,
    reason: "payment_reinitiated",
  });
  const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
    appointmentId: input.appointment.id,
    allowedFrom: CHECKOUT_REINIT_ALLOWED_FROM,
    toStatus: "pending_payment",
    toPaymentStatus: "pending",
    operatorType: input.operatorType,
    operatorId: input.operatorId,
    reason: "checkout_session_created",
    payloadJson: {
      oldStripeSessionId: input.appointment.stripeSessionId,
      newStripeSessionId: checkout.id,
    },
    update: {
      stripeSessionId: checkout.id,
    },
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  return {
    appointmentId: input.appointment.id,
    checkoutSessionUrl: checkout.url,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    stripeSessionId:
      process.env.NODE_ENV === "development" ? checkout.id : undefined,
  };
}
