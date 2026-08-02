import { describe, expect, it } from "vitest";
import { resolveReferralPaymentMode } from "./paymentMode";

describe("referral payment mode", () => {
  it("defaults to provider mode when the variable is missing", () => {
    expect(resolveReferralPaymentMode(undefined)).toBe("provider");
  });

  it("accepts explicit mock mode regardless of NODE_ENV", () => {
    expect(resolveReferralPaymentMode(" mock ")).toBe("mock");
  });

  it("rejects unsupported values instead of silently falling back", () => {
    expect(() => resolveReferralPaymentMode("test")).toThrow(
      "Unsupported REFERRAL_PAYMENT_MODE"
    );
  });
});
