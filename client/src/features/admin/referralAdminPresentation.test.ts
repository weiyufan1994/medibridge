import { describe, expect, it } from "vitest";
import { REFERRAL_ORDER_STATUS_VALUES } from "@shared/referrals";
import {
  formatReferralWaitingDuration,
  getReferralAdminTaskKind,
  getReferralAdminStatusTone,
  shouldShowReferralAssignment,
  shouldShowReferralBooking,
  shouldShowReferralContact,
  shouldShowReferralSchedule,
  shouldShowReferralWaitDuration,
} from "@/features/admin/referralAdminPresentation";

describe("referral admin task presentation", () => {
  it("maps every persisted referral status to one task kind", () => {
    const mapped = REFERRAL_ORDER_STATUS_VALUES.map(status =>
      getReferralAdminTaskKind(status)
    );

    expect(mapped).toHaveLength(REFERRAL_ORDER_STATUS_VALUES.length);
    expect(mapped.every(Boolean)).toBe(true);
  });

  it("shows stage forms only for the matching workflow state", () => {
    expect(shouldShowReferralAssignment("paid_pending_assignment")).toBe(true);
    expect(shouldShowReferralContact("assigned")).toBe(true);
    expect(shouldShowReferralBooking("contacting")).toBe(true);
    expect(shouldShowReferralSchedule("time_coordination")).toBe(true);
    expect(shouldShowReferralSchedule("scheduled")).toBe(true);
    expect(shouldShowReferralSchedule("booking_in_progress")).toBe(false);
  });

  it("pairs every persisted status with a non-color status tone", () => {
    const tones = REFERRAL_ORDER_STATUS_VALUES.map(status =>
      getReferralAdminStatusTone(status)
    );
    expect(tones).toHaveLength(REFERRAL_ORDER_STATUS_VALUES.length);
    expect(tones.every(Boolean)).toBe(true);
    expect(getReferralAdminStatusTone("completed")).toBe("success");
    expect(getReferralAdminStatusTone("cancelled")).toBe("danger");
  });

  it("formats active wait time without exposing raw minute totals", () => {
    expect(formatReferralWaitingDuration(17, "en")).toBe("17 min");
    expect(formatReferralWaitingDuration(138, "zh")).toBe("2小时 18分钟");
    expect(formatReferralWaitingDuration(157_318, "en")).toBe(
      "109 days 5 hr"
    );
    expect(shouldShowReferralWaitDuration("contacting")).toBe(true);
    expect(shouldShowReferralWaitDuration("completed")).toBe(false);
    expect(shouldShowReferralWaitDuration("refunded")).toBe(false);
  });
});
