export const REFERRAL_ORDER_STATUS_VALUES = [
  "pending_payment",
  "paid_pending_assignment",
  "assigned",
  "contacting",
  "booking_in_progress",
  "time_coordination",
  "scheduled",
  "completed",
  "refund_pending_review",
  "refund_processing",
  "refunded",
  "cancelled",
] as const;

export type ReferralOrderStatus = (typeof REFERRAL_ORDER_STATUS_VALUES)[number];

export const REFERRAL_PAYMENT_STATUS_VALUES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
  "cancelled",
] as const;

export type ReferralPaymentStatus =
  (typeof REFERRAL_PAYMENT_STATUS_VALUES)[number];

export type ReferralPaymentAction =
  | "payNow"
  | "continuePayment"
  | "retryPayment";

export const REFERRAL_ACTOR_TYPE_VALUES = [
  "system",
  "patient",
  "admin",
  "ops",
  "webhook",
] as const;

export type ReferralActorType = (typeof REFERRAL_ACTOR_TYPE_VALUES)[number];

export const REFUND_REQUEST_STATUS_VALUES = [
  "pending_review",
  "approved",
  "processing",
  "refunded",
  "rejected",
] as const;

export type RefundRequestStatus = (typeof REFUND_REQUEST_STATUS_VALUES)[number];

export const REFERRAL_SERVICE_AGREEMENT_VERSION = "referral_service_v2";
export const REFERRAL_SERVICE_AMOUNT = 19900;
export const REFERRAL_SERVICE_CURRENCY = "cny";
export const REFERRAL_FULFILLMENT_BUSINESS_DAYS = 2;
export const REFERRAL_FULFILLMENT_TIME_ZONE = "Asia/Shanghai";

export type ReferralConsultationArrangement = {
  scheduledAt: Date;
  timeZone: string;
  providerName: string;
  platform: string;
  joinUrl: string;
  instructions: string;
};

export const REFERRAL_NOTIFICATION_CHANNEL_VALUES = ["email"] as const;
export const REFERRAL_NOTIFICATION_RECIPIENT_VALUES = [
  "patient",
  "ops",
] as const;
export const REFERRAL_NOTIFICATION_STATUS_VALUES = [
  "pending",
  "processing",
  "sent",
  "failed",
] as const;

export const REFERRAL_REFUND_REASON_CODE_VALUES = [
  "contact_failed",
  "booking_failed",
  "sla_expired",
  "patient_requested",
  "internal_exception",
] as const;

export type ReferralRefundReasonCode =
  (typeof REFERRAL_REFUND_REASON_CODE_VALUES)[number];

export function getReferralPaymentActionForOrder(input: {
  status: ReferralOrderStatus;
  paymentStatus: ReferralPaymentStatus;
}): ReferralPaymentAction | null {
  if (input.status !== "pending_payment") {
    return null;
  }

  if (input.paymentStatus === "unpaid") {
    return "payNow";
  }

  if (input.paymentStatus === "pending") {
    return "continuePayment";
  }

  if (input.paymentStatus === "failed") {
    return "retryPayment";
  }

  return null;
}
