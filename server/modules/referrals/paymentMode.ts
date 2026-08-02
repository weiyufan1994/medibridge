export const REFERRAL_PAYMENT_MODE_VALUES = ["provider", "mock"] as const;

export type ReferralPaymentMode = (typeof REFERRAL_PAYMENT_MODE_VALUES)[number];

export function resolveReferralPaymentMode(
  value = process.env.REFERRAL_PAYMENT_MODE
): ReferralPaymentMode {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized || normalized === "provider") {
    return "provider";
  }
  if (normalized === "mock") {
    return "mock";
  }
  throw new Error(`Unsupported REFERRAL_PAYMENT_MODE: ${value}`);
}
