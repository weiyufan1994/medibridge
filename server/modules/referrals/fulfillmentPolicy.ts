import {
  REFERRAL_FULFILLMENT_BUSINESS_DAYS,
  REFERRAL_FULFILLMENT_TIME_ZONE,
  type ReferralOrderStatus,
} from "../../../shared/referrals";

const SLA_ELIGIBLE_STATUSES = new Set<ReferralOrderStatus>([
  "paid_pending_assignment",
  "assigned",
  "contacting",
  "booking_in_progress",
]);

const SHANGHAI_UTC_OFFSET_HOURS = 8;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

function toShanghaiCalendarDate(value: Date): Date {
  return new Date(value.getTime() + SHANGHAI_UTC_OFFSET_HOURS * MILLISECONDS_PER_HOUR);
}

function fromShanghaiCalendarDate(value: Date): Date {
  return new Date(value.getTime() - SHANGHAI_UTC_OFFSET_HOURS * MILLISECONDS_PER_HOUR);
}

function isWeekend(value: Date): boolean {
  const day = value.getUTCDay();
  return day === 0 || day === 6;
}

export function calculateReferralFulfillmentDeadline(
  paidAt: Date,
  businessDays = REFERRAL_FULFILLMENT_BUSINESS_DAYS
): Date {
  if (!Number.isInteger(businessDays) || businessDays < 0) {
    throw new Error("Business days must be a non-negative integer");
  }

  let calendarDate = toShanghaiCalendarDate(paidAt);
  let remainingDays = businessDays;

  while (remainingDays > 0) {
    calendarDate = new Date(calendarDate.getTime() + MILLISECONDS_PER_DAY);
    if (!isWeekend(calendarDate)) {
      remainingDays -= 1;
    }
  }

  return fromShanghaiCalendarDate(calendarDate);
}

export function isReferralSlaRefundEligible(status: ReferralOrderStatus): boolean {
  return SLA_ELIGIBLE_STATUSES.has(status);
}

export function getReferralFulfillmentTimeZone(): string {
  return REFERRAL_FULFILLMENT_TIME_ZONE;
}
