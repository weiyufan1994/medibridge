import type {
  AdminAppointmentStatus,
  AdminPaymentStatus,
} from "@/features/admin/types";
import type { ReferralOrderStatus } from "@shared/referrals";

const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AdminAppointmentStatus,
  AdminAppointmentStatus[]
> = {
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

const APPOINTMENT_PAYMENT_BY_STATUS: Record<
  AdminAppointmentStatus,
  AdminPaymentStatus[]
> = {
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

const APPOINTMENT_STATUS_SET = new Set<AdminAppointmentStatus>(
  Object.keys(APPOINTMENT_STATUS_TRANSITIONS) as AdminAppointmentStatus[]
);

const PAYMENT_STATUS_SET = new Set<AdminPaymentStatus>(
  Object.values(APPOINTMENT_PAYMENT_BY_STATUS).flat()
);

const REFERRAL_PRIMARY_NEXT_STATUS: Record<
  ReferralOrderStatus,
  ReferralOrderStatus | null
> = {
  pending_payment: "paid_pending_assignment",
  paid_pending_assignment: "assigned",
  assigned: "contacting",
  contacting: "booking_in_progress",
  booking_in_progress: "time_coordination",
  time_coordination: "scheduled",
  scheduled: "completed",
  completed: null,
  refund_pending_review: null,
  refund_processing: "refunded",
  refunded: null,
  cancelled: null,
};

const REFERRAL_MANUAL_STATUS_TARGETS: Record<
  ReferralOrderStatus,
  ReferralOrderStatus[]
> = {
  pending_payment: ["cancelled"],
  paid_pending_assignment: ["assigned"],
  assigned: ["contacting"],
  contacting: ["booking_in_progress"],
  booking_in_progress: [],
  time_coordination: [],
  scheduled: ["completed"],
  completed: [],
  refund_pending_review: [],
  refund_processing: [],
  refunded: [],
  cancelled: [],
};

export type ReferralStatusAdvanceMode =
  | "automatic"
  | "manual"
  | "dynamic"
  | "terminal";

export function isAdminAppointmentStatus(
  value: string
): value is AdminAppointmentStatus {
  return APPOINTMENT_STATUS_SET.has(value as AdminAppointmentStatus);
}

export function isAdminPaymentStatus(
  value: string
): value is AdminPaymentStatus {
  return PAYMENT_STATUS_SET.has(value as AdminPaymentStatus);
}

export function getAdminAppointmentNextStatuses(
  currentStatus: AdminAppointmentStatus
) {
  return APPOINTMENT_STATUS_TRANSITIONS[currentStatus];
}

export function getAdminAppointmentPaymentStatuses(
  targetStatus: AdminAppointmentStatus
) {
  return APPOINTMENT_PAYMENT_BY_STATUS[targetStatus];
}

export function getReferralAdminPrimaryNextStatus(
  currentStatus: ReferralOrderStatus
) {
  return REFERRAL_PRIMARY_NEXT_STATUS[currentStatus];
}

export function getReferralAdminManualStatusTargets(
  currentStatus: ReferralOrderStatus
) {
  return REFERRAL_MANUAL_STATUS_TARGETS[currentStatus];
}

export function getReferralStatusAdvanceMode(
  currentStatus: ReferralOrderStatus
): ReferralStatusAdvanceMode {
  if (
    currentStatus === "completed" ||
    currentStatus === "refunded" ||
    currentStatus === "cancelled"
  ) {
    return "terminal";
  }
  if (currentStatus === "refund_pending_review") {
    return "dynamic";
  }
  if (currentStatus === "scheduled") {
    return "manual";
  }
  return "automatic";
}
