import { describe, expect, it } from "vitest";
import {
  ensureValidReferralStatePair,
  ensureValidReferralTransition,
  isAllowedReferralStatusTransition,
  isReferralTerminalStatus,
} from "./stateMachine";

describe("referral state machine", () => {
  it("allows the core fulfillment path", () => {
    expect(
      isAllowedReferralStatusTransition(
        "pending_payment",
        "paid_pending_assignment"
      )
    ).toBe(true);
    expect(
      isAllowedReferralStatusTransition(
        "paid_pending_assignment",
        "assigned"
      )
    ).toBe(true);
    expect(
      isAllowedReferralStatusTransition("assigned", "contacting")
    ).toBe(true);
    expect(
      isAllowedReferralStatusTransition("contacting", "booking_in_progress")
    ).toBe(true);
    expect(
      isAllowedReferralStatusTransition(
        "booking_in_progress",
        "time_coordination"
      )
    ).toBe(true);
    expect(
      isAllowedReferralStatusTransition("time_coordination", "scheduled")
    ).toBe(true);
    expect(isAllowedReferralStatusTransition("scheduled", "completed")).toBe(
      true
    );
  });

  it("allows refund review to resume fulfillment when review is rejected", () => {
    expect(
      isAllowedReferralStatusTransition("refund_pending_review", "assigned")
    ).toBe(true);
    expect(
      isAllowedReferralStatusTransition("refund_pending_review", "scheduled")
    ).toBe(true);
  });

  it("rejects invalid state transitions and payment/status pairs", () => {
    expect(() =>
      ensureValidReferralTransition({
        fromStatus: "scheduled",
        toStatus: "assigned",
        toPaymentStatus: "paid",
      })
    ).toThrowError("REFERRAL_INVALID_STATUS_TRANSITION");

    expect(() =>
      ensureValidReferralStatePair({
        status: "scheduled",
        paymentStatus: "pending",
      })
    ).toThrowError("REFERRAL_INVALID_STATUS_TRANSITION");
  });

  it("marks terminal statuses correctly", () => {
    expect(isReferralTerminalStatus("completed")).toBe(true);
    expect(isReferralTerminalStatus("refunded")).toBe(true);
    expect(isReferralTerminalStatus("cancelled")).toBe(true);
    expect(isReferralTerminalStatus("scheduled")).toBe(false);
  });
});
