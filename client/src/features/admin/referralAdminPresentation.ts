import type { ReferralOrderStatus } from "@shared/referrals";
import type { AdminStatusTone } from "@/features/admin/components/AdminStatusBadge";

export type ReferralAdminTaskKind =
  | "await_payment"
  | "assign"
  | "contact"
  | "booking"
  | "coordinate_time"
  | "schedule"
  | "complete"
  | "refund_review"
  | "refund_processing"
  | "terminal";

const TASK_BY_STATUS: Record<ReferralOrderStatus, ReferralAdminTaskKind> = {
  pending_payment: "await_payment",
  paid_pending_assignment: "assign",
  assigned: "contact",
  contacting: "booking",
  booking_in_progress: "coordinate_time",
  time_coordination: "schedule",
  scheduled: "complete",
  completed: "terminal",
  refund_pending_review: "refund_review",
  refund_processing: "refund_processing",
  refunded: "terminal",
  cancelled: "terminal",
};

const TONE_BY_STATUS: Record<ReferralOrderStatus, AdminStatusTone> = {
  pending_payment: "warning",
  paid_pending_assignment: "warning",
  assigned: "info",
  contacting: "info",
  booking_in_progress: "info",
  time_coordination: "info",
  scheduled: "success",
  completed: "success",
  refund_pending_review: "warning",
  refund_processing: "warning",
  refunded: "neutral",
  cancelled: "danger",
};

const DURATION_LOCALE_BY_LANGUAGE = {
  en: "en-US",
  zh: "zh-CN",
} as const;

function formatDurationUnit(
  value: number,
  unit: "minute" | "hour" | "day",
  lang: "zh" | "en"
) {
  return new Intl.NumberFormat(DURATION_LOCALE_BY_LANGUAGE[lang], {
    style: "unit",
    unit,
    unitDisplay: "short",
  }).format(value);
}

export function getReferralAdminTaskKind(status: ReferralOrderStatus) {
  return TASK_BY_STATUS[status];
}

export function getReferralAdminStatusTone(status: ReferralOrderStatus) {
  return TONE_BY_STATUS[status];
}

export function formatReferralWaitingDuration(
  minutes: number,
  lang: "zh" | "en"
) {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  if (safeMinutes < 60) {
    return formatDurationUnit(safeMinutes, "minute", lang);
  }
  if (safeMinutes < 1_440) {
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
    if (remainingMinutes === 0) {
      return formatDurationUnit(hours, "hour", lang);
    }
    return [
      formatDurationUnit(hours, "hour", lang),
      formatDurationUnit(remainingMinutes, "minute", lang),
    ].join(" ");
  }
  const days = Math.floor(safeMinutes / 1_440);
  const remainingHours = Math.floor((safeMinutes % 1_440) / 60);
  if (remainingHours === 0) {
    return formatDurationUnit(days, "day", lang);
  }
  return [
    formatDurationUnit(days, "day", lang),
    formatDurationUnit(remainingHours, "hour", lang),
  ].join(" ");
}

export function shouldShowReferralWaitDuration(status: ReferralOrderStatus) {
  return !["completed", "refunded", "cancelled"].includes(status);
}

export function shouldShowReferralAssignment(status: ReferralOrderStatus) {
  return status === "paid_pending_assignment";
}

export function shouldShowReferralContact(status: ReferralOrderStatus) {
  return status === "assigned";
}

export function shouldShowReferralBooking(status: ReferralOrderStatus) {
  return status === "contacting";
}

export function shouldShowReferralSchedule(status: ReferralOrderStatus) {
  return status === "time_coordination" || status === "scheduled";
}
