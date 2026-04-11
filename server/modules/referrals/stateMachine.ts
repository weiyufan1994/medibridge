import { TRPCError } from "@trpc/server";
import {
  type ReferralOrderStatus,
  type ReferralPaymentStatus,
} from "../../../shared/referrals";

export const REFERRAL_INVALID_TRANSITION_ERROR =
  "REFERRAL_INVALID_STATUS_TRANSITION" as const;

const ALLOWED_STATUS_TRANSITIONS: Record<
  ReferralOrderStatus,
  ReferralOrderStatus[]
> = {
  pending_payment: ["paid_pending_assignment", "cancelled"],
  paid_pending_assignment: [
    "assigned",
    "refund_pending_review",
    "cancelled",
  ],
  assigned: ["contacting", "refund_pending_review", "cancelled"],
  contacting: ["booking_in_progress", "refund_pending_review", "cancelled"],
  booking_in_progress: [
    "time_coordination",
    "refund_pending_review",
    "cancelled",
  ],
  time_coordination: ["scheduled", "refund_pending_review", "cancelled"],
  scheduled: ["completed", "refund_pending_review", "cancelled"],
  completed: [],
  refund_pending_review: [
    "paid_pending_assignment",
    "assigned",
    "contacting",
    "booking_in_progress",
    "time_coordination",
    "scheduled",
    "refund_processing",
    "cancelled",
  ],
  refund_processing: ["refunded"],
  refunded: [],
  cancelled: [],
};

const ALLOWED_PAYMENT_BY_STATUS: Record<
  ReferralOrderStatus,
  ReferralPaymentStatus[]
> = {
  pending_payment: ["unpaid", "pending", "failed", "cancelled"],
  paid_pending_assignment: ["paid"],
  assigned: ["paid"],
  contacting: ["paid"],
  booking_in_progress: ["paid"],
  time_coordination: ["paid"],
  scheduled: ["paid"],
  completed: ["paid"],
  refund_pending_review: ["paid"],
  refund_processing: ["paid"],
  refunded: ["refunded"],
  cancelled: ["cancelled", "failed"],
};

export function isAllowedReferralStatusTransition(
  fromStatus: ReferralOrderStatus,
  toStatus: ReferralOrderStatus
) {
  if (fromStatus === toStatus) {
    return true;
  }

  return ALLOWED_STATUS_TRANSITIONS[fromStatus].includes(toStatus);
}

export function isAllowedPaymentStatusForReferralOrder(
  status: ReferralOrderStatus,
  paymentStatus: ReferralPaymentStatus
) {
  return ALLOWED_PAYMENT_BY_STATUS[status].includes(paymentStatus);
}

export function ensureValidReferralStatePair(input: {
  status: ReferralOrderStatus;
  paymentStatus: ReferralPaymentStatus;
}) {
  if (
    !isAllowedPaymentStatusForReferralOrder(
      input.status,
      input.paymentStatus
    )
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  }
}

export function ensureValidReferralTransition(input: {
  fromStatus: ReferralOrderStatus;
  toStatus: ReferralOrderStatus;
  toPaymentStatus: ReferralPaymentStatus;
}) {
  if (
    !isAllowedReferralStatusTransition(input.fromStatus, input.toStatus) ||
    !isAllowedPaymentStatusForReferralOrder(
      input.toStatus,
      input.toPaymentStatus
    )
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  }
}

export function isReferralTerminalStatus(status: ReferralOrderStatus) {
  return status === "completed" || status === "refunded" || status === "cancelled";
}

export function canReferralOrderReenterFulfillment(status: ReferralOrderStatus) {
  return !["refunded", "cancelled", "completed"].includes(status);
}
