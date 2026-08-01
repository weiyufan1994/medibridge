import { describe, expect, it } from "vitest";
import {
  calculateReferralFulfillmentDeadline,
  getReferralFulfillmentTimeZone,
  isReferralSlaRefundEligible,
} from "./fulfillmentPolicy";

describe("referral fulfillment policy", () => {
  it("adds two Shanghai business days without changing the local time", () => {
    const paidAt = new Date("2026-07-29T02:30:00.000Z");

    const deadline = calculateReferralFulfillmentDeadline(paidAt);

    expect(deadline.toISOString()).toBe("2026-07-31T02:30:00.000Z");
    expect(getReferralFulfillmentTimeZone()).toBe("Asia/Shanghai");
  });

  it("skips a weekend when payment settles on Friday in Shanghai", () => {
    const paidAt = new Date("2026-07-31T08:00:00.000Z");

    const deadline = calculateReferralFulfillmentDeadline(paidAt);

    expect(deadline.toISOString()).toBe("2026-08-04T08:00:00.000Z");
  });

  it("rejects invalid business-day values", () => {
    expect(() => calculateReferralFulfillmentDeadline(new Date(), -1)).toThrow(
      "Business days must be a non-negative integer"
    );
  });

  it("limits SLA refunds to pre-coordination fulfillment states", () => {
    expect(isReferralSlaRefundEligible("paid_pending_assignment")).toBe(true);
    expect(isReferralSlaRefundEligible("booking_in_progress")).toBe(true);
    expect(isReferralSlaRefundEligible("time_coordination")).toBe(false);
    expect(isReferralSlaRefundEligible("scheduled")).toBe(false);
    expect(isReferralSlaRefundEligible("refunded")).toBe(false);
  });
});
