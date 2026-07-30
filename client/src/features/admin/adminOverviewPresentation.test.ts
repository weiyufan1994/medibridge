import { describe, expect, it } from "vitest";
import {
  ADMIN_OVERVIEW_REFERRAL_STATUS,
  getAdminOverviewTodayStart,
} from "@/features/admin/adminOverviewPresentation";

describe("admin overview presentation", () => {
  it("uses the local calendar day as the appointment metric scope", () => {
    const start = getAdminOverviewTodayStart(
      new Date(2026, 6, 30, 15, 42, 17, 500)
    );
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(30);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it("derives actionable referral counts from persisted workflow states", () => {
    expect(ADMIN_OVERVIEW_REFERRAL_STATUS).toEqual({
      unassigned: "paid_pending_assignment",
      refundReview: "refund_pending_review",
    });
  });
});
