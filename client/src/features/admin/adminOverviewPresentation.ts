import type { ReferralOrderStatus } from "@shared/referrals";

export const ADMIN_OVERVIEW_REFERRAL_STATUS = {
  unassigned: "paid_pending_assignment",
  refundReview: "refund_pending_review",
} as const satisfies Record<string, ReferralOrderStatus>;

export function getAdminOverviewTodayStart(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}
