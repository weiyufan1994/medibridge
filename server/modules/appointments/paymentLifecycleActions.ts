import { TRPCError } from "@trpc/server";
import type { appointments } from "../../../drizzle/schema";
import * as repo from "./repo";
import {
  APPOINTMENT_INVALID_TRANSITION_ERROR,
  CHECKOUT_REINIT_ALLOWED_FROM,
  CHECKOUT_REINIT_BLOCKED_STATUSES,
} from "./stateMachine";
import { setCachedPatientAccessToken } from "./tokenCache";
import { issueAppointmentAccessLinks } from "./tokenService";

type AppointmentRecord = typeof appointments.$inferSelect;
export type AppointmentCheckoutSnapshot = Pick<
  AppointmentRecord,
  "id" | "amount" | "currency" | "status" | "paymentStatus" | "stripeSessionId"
>;
export type AppointmentPaymentDbExecutor = repo.AppointmentRepoExecutor;

export function assertCheckoutCanBeReinitiated(
  appointment: AppointmentCheckoutSnapshot
) {
  if (
    appointment.paymentStatus === "paid" ||
    CHECKOUT_REINIT_BLOCKED_STATUSES.includes(appointment.status)
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }
}

async function attachReinitiatedCheckout(input: {
  appointment: AppointmentCheckoutSnapshot;
  checkoutSessionId: string;
  paymentProvider: AppointmentRecord["paymentProvider"];
  operatorType: "system" | "patient" | "admin";
  operatorId: number | null;
}) {
  await repo.revokeAppointmentTokens({
    appointmentId: input.appointment.id,
    reason: "payment_reinitiated",
  });
  const transitioned = await repo.tryTransitionAppointmentById({
    appointmentId: input.appointment.id,
    allowedFrom: CHECKOUT_REINIT_ALLOWED_FROM,
    toStatus: "pending_payment",
    toPaymentStatus: "pending",
    operatorType: input.operatorType,
    operatorId: input.operatorId,
    reason: "checkout_session_created",
    payloadJson: {
      oldStripeSessionId: input.appointment.stripeSessionId,
      newStripeSessionId: input.checkoutSessionId,
    },
    update: {
      stripeSessionId: input.checkoutSessionId,
      paymentProvider: input.paymentProvider,
    },
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }
}

export const appointmentPaymentApi = {
  get getById() {
    return repo.getAppointmentById;
  },
  get getCheckoutResultBySessionId() {
    return repo.getCheckoutResultByStripeSessionId;
  },
  get getBySessionId() {
    return repo.getAppointmentByStripeSessionId;
  },
  get claimPaidBySessionId() {
    return repo.tryMarkPaidByStripeSessionId;
  },
  get recordStatusEvent() {
    return repo.insertStatusEvent;
  },
  assertCheckoutCanBeReinitiated,
  attachReinitiatedCheckout,
  get issueAccessLinks() {
    return issueAppointmentAccessLinks;
  },
  get cachePatientAccessToken() {
    return setCachedPatientAccessToken;
  },
};
