import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  listExpiredReferralSlaOrders: vi.fn(),
  listRefundProcessingOrders: vi.fn(),
}));

vi.mock("./refunds", () => ({
  initiateAutomaticReferralRefund: vi.fn(),
  processReferralRefund: vi.fn(),
}));

import * as referralRepo from "./repo";
import {
  initiateAutomaticReferralRefund,
  processReferralRefund,
} from "./refunds";
import { processReferralFulfillment } from "./fulfillmentWorker";

describe("referral fulfillment worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralRepo.listExpiredReferralSlaOrders).mockResolvedValue(
      [] as never
    );
    vi.mocked(referralRepo.listRefundProcessingOrders).mockResolvedValue(
      [] as never
    );
  });

  it("starts automatic full refunds for orders returned by the SLA query", async () => {
    const now = new Date("2026-08-04T08:00:00.000Z");
    vi.mocked(referralRepo.listExpiredReferralSlaOrders).mockResolvedValue([
      { id: 701, status: "booking_in_progress", paymentStatus: "paid" },
    ] as never);

    await processReferralFulfillment(now);

    expect(referralRepo.listExpiredReferralSlaOrders).toHaveBeenCalledWith({
      now,
      limit: 100,
    });
    expect(initiateAutomaticReferralRefund).toHaveBeenCalledWith({
      orderId: 701,
      reasonCode: "sla_expired",
      reasonDetail:
        "No arrangeable consultation response was confirmed within two business days.",
      actor: { type: "system", id: null },
    });
  });

  it("retries provider calls for refunds that remain processing", async () => {
    vi.mocked(referralRepo.listRefundProcessingOrders).mockResolvedValue([
      { id: 702, status: "refund_processing", paymentStatus: "paid" },
    ] as never);

    await processReferralFulfillment();

    expect(processReferralRefund).toHaveBeenCalledWith({
      orderId: 702,
      actor: { type: "system", id: null },
    });
  });
});
