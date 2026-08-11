import { describe, expect, it } from "vitest";
import { getBookingWorkspaceCopy } from "@/features/booking/copy";
import {
  getBookingBatchHint,
  getBookingPageSizeOptions,
  getBookingRiskCount,
} from "@/features/booking/bookingToolbarPresentation";

describe("booking toolbar presentation", () => {
  it("adds all operational risk categories", () => {
    expect(
      getBookingRiskCount({
        total: 20,
        pendingPaymentTimeout: 1,
        webhookFailure: 2,
        tokenExpiringSoon: 3,
        tokenUsageExhausted: 4,
      })
    ).toBe(10);
    expect(getBookingRiskCount(null)).toBe(0);
  });

  it("keeps the active page size in sorted unique options", () => {
    expect(getBookingPageSizeOptions([100, 25, 25], 50)).toEqual([25, 50, 100]);
  });

  it("only lists unavailable selected-booking actions", () => {
    const copy = getBookingWorkspaceCopy("en").toolbar;
    expect(
      getBookingBatchHint({
        selectedCount: 2,
        canBatchResendAccessLink: false,
        canBatchReinitiatePayment: true,
        canBatchUpdateStatus: false,
        copy,
      })
    ).toBe(`${copy.linkPermissionHint} ${copy.statusPermissionHint}`);
    expect(
      getBookingBatchHint({
        selectedCount: 0,
        canBatchResendAccessLink: false,
        canBatchReinitiatePayment: false,
        canBatchUpdateStatus: false,
        copy,
      })
    ).toBe("");
  });
});
