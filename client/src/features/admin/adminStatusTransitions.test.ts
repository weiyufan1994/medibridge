import { describe, expect, it } from "vitest";
import { REFERRAL_ORDER_STATUS_VALUES } from "@shared/referrals";
import {
  getAdminAppointmentNextStatuses,
  getAdminAppointmentPaymentStatuses,
  getReferralAdminManualStatusTargets,
  getReferralAdminPrimaryNextStatus,
  getReferralStatusAdvanceMode,
  isAdminAppointmentStatus,
  isAdminPaymentStatus,
} from "@/features/admin/adminStatusTransitions";

describe("admin appointment status guidance", () => {
  it("returns only valid next states for the current appointment state", () => {
    expect(getAdminAppointmentNextStatuses("draft")).toEqual([
      "pending_payment",
      "canceled",
    ]);
    expect(getAdminAppointmentNextStatuses("ended")).toEqual([
      "completed",
      "refunded",
    ]);
    expect(getAdminAppointmentNextStatuses("refunded")).toEqual([]);
  });

  it("constrains payment choices to the selected appointment state", () => {
    expect(getAdminAppointmentPaymentStatuses("pending_payment")).toEqual([
      "pending",
      "failed",
    ]);
    expect(getAdminAppointmentPaymentStatuses("completed")).toEqual(["paid"]);
    expect(getAdminAppointmentPaymentStatuses("canceled")).toEqual([
      "canceled",
      "failed",
      "unpaid",
    ]);
  });

  it("rejects unknown appointment and payment statuses", () => {
    expect(isAdminAppointmentStatus("active")).toBe(true);
    expect(isAdminAppointmentStatus("unknown")).toBe(false);
    expect(isAdminPaymentStatus("paid")).toBe(true);
    expect(isAdminPaymentStatus("processing")).toBe(false);
  });
});

describe("admin referral status guidance", () => {
  it("defines guidance for every persisted referral state", () => {
    for (const status of REFERRAL_ORDER_STATUS_VALUES) {
      expect(() => getReferralAdminPrimaryNextStatus(status)).not.toThrow();
      expect(() => getReferralStatusAdvanceMode(status)).not.toThrow();
      expect(() => getReferralAdminManualStatusTargets(status)).not.toThrow();
    }
  });

  it("keeps dedicated workflow states out of manual correction targets", () => {
    expect(getReferralAdminManualStatusTargets("assigned")).toEqual([
      "contacting",
    ]);
    expect(getReferralAdminManualStatusTargets("booking_in_progress")).toEqual(
      []
    );
    expect(getReferralAdminManualStatusTargets("time_coordination")).toEqual(
      []
    );
    expect(
      getReferralAdminManualStatusTargets("refund_pending_review")
    ).toEqual([]);
  });

  it("marks automatic, manual, dynamic, and terminal progression", () => {
    expect(getReferralStatusAdvanceMode("assigned")).toBe("automatic");
    expect(getReferralStatusAdvanceMode("scheduled")).toBe("manual");
    expect(getReferralStatusAdvanceMode("refund_pending_review")).toBe(
      "dynamic"
    );
    expect(getReferralStatusAdvanceMode("completed")).toBe("terminal");
  });
});
