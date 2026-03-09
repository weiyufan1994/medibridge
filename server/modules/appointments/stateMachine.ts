import { TRPCError } from "@trpc/server";

export const APPOINTMENT_STATUS_VALUES = [
  "draft",
  "pending_payment",
  "paid",
  "active",
  "ended",
  "completed",
  "expired",
  "refunded",
  "canceled",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS_VALUES)[number];

export const PAYMENT_STATUS_VALUES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
  "canceled",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export const APPOINTMENT_NOT_ALLOWED_ERROR = "APPOINTMENT_NOT_ALLOWED" as const;
export const APPOINTMENT_INVALID_TRANSITION_ERROR =
  "APPOINTMENT_INVALID_STATUS_TRANSITION" as const;
export const CHECKOUT_REINIT_ALLOWED_FROM: AppointmentStatus[] = [
  "draft",
  "pending_payment",
  "expired",
  "canceled",
];
export const CHECKOUT_REINIT_BLOCKED_STATUSES: AppointmentStatus[] = [
  "paid",
  "active",
  "ended",
  "completed",
  "refunded",
];

const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  draft: ["pending_payment", "canceled"],
  pending_payment: ["paid", "expired", "canceled"],
  paid: ["active", "ended", "completed", "refunded", "canceled"],
  active: ["ended", "completed", "refunded", "canceled"],
  ended: ["completed", "refunded"],
  completed: ["refunded"],
  expired: [],
  refunded: [],
  canceled: [],
};

const ALLOWED_PAYMENT_BY_STATUS: Record<AppointmentStatus, PaymentStatus[]> = {
  draft: ["unpaid"],
  pending_payment: ["pending", "failed"],
  paid: ["paid"],
  active: ["paid"],
  ended: ["paid"],
  completed: ["paid"],
  expired: ["expired", "failed"],
  refunded: ["refunded"],
  canceled: ["canceled", "failed", "unpaid"],
};

export function isAllowedStatusTransition(
  fromStatus: AppointmentStatus,
  toStatus: AppointmentStatus
): boolean {
  if (fromStatus === toStatus) {
    return true;
  }

  return ALLOWED_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

export function isAllowedPaymentStatusForAppointment(
  appointmentStatus: AppointmentStatus,
  paymentStatus: PaymentStatus
): boolean {
  return ALLOWED_PAYMENT_BY_STATUS[appointmentStatus].includes(paymentStatus);
}

export function ensureValidAppointmentStatePair(input: {
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
}) {
  if (!isAllowedPaymentStatusForAppointment(input.status, input.paymentStatus)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }
}

export function ensureValidTransitionOrThrow(input: {
  fromStatus: AppointmentStatus;
  toStatus: AppointmentStatus;
  toPaymentStatus: PaymentStatus;
}) {
  if (!isAllowedStatusTransition(input.fromStatus, input.toStatus)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  if (!isAllowedPaymentStatusForAppointment(input.toStatus, input.toPaymentStatus)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }
}

export function ensureAppointmentStatusAllowsVisitV2(input: {
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
}) {
  if (input.paymentStatus !== "paid") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: APPOINTMENT_NOT_ALLOWED_ERROR,
    });
  }

  if (
    input.status !== "paid" &&
    input.status !== "active" &&
    input.status !== "ended" &&
    input.status !== "completed"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: APPOINTMENT_NOT_ALLOWED_ERROR,
    });
  }
}
