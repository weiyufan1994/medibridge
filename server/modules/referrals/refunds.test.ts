import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../payments/providerManager", () => ({
  refundPayment: vi.fn(),
}));

vi.mock("./repo", () => ({
  getReferralOrderById: vi.fn(),
  tryTransitionOrderById: vi.fn(),
  getLatestRefundRequestByOrderId: vi.fn(),
  updateRefundRequestById: vi.fn(),
  updateReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
}));

vi.mock("./notifications", () => ({
  notifyInternalActionRequired: vi.fn(),
  notifyPatientReferralUpdate: vi.fn(),
}));

import { refundPayment } from "../payments/providerManager";
import * as referralRepo from "./repo";
import {
  notifyInternalActionRequired,
  notifyPatientReferralUpdate,
} from "./notifications";
import { processReferralRefund } from "./refunds";

function createProcessingOrder(status = "refund_processing") {
  return {
    id: 501,
    status,
    paymentStatus: status === "refunded" ? "refunded" : "paid",
    paymentProvider: "stripe",
    paymentProviderSessionId: "cs_refund_501",
    paymentProviderTransactionId: "pi_refund_501",
    totalAmount: 19900,
    currency: "cny",
  };
}

describe("referral refunds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
      null as never
    );
  });

  it("requests an idempotent full refund and only then marks the order refunded", async () => {
    vi.mocked(referralRepo.getReferralOrderById)
      .mockResolvedValueOnce(createProcessingOrder() as never)
      .mockResolvedValueOnce(createProcessingOrder() as never)
      .mockResolvedValueOnce(createProcessingOrder("refunded") as never);
    vi.mocked(refundPayment).mockResolvedValue({
      provider: "stripe",
      providerRefundId: "re_refund_501",
      status: "succeeded",
    });
    vi.mocked(referralRepo.tryTransitionOrderById).mockResolvedValue({
      ok: true,
      current: createProcessingOrder("refunded"),
    } as never);

    const result = await processReferralRefund({
      orderId: 501,
      actor: { type: "system", id: null },
    });

    expect(refundPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 19900,
        currency: "cny",
        idempotencyKey: "referral-order-501-full-refund",
        resource: { type: "referral_order", id: 501 },
      })
    );
    expect(referralRepo.tryTransitionOrderById).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 501,
        allowedFrom: ["refund_processing"],
        toStatus: "refunded",
        toPaymentStatus: "refunded",
      })
    );
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ event: "refund_completed" })
    );
    expect(result.status).toBe("succeeded");
  });

  it("keeps the order in refund processing when the provider call fails", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createProcessingOrder() as never
    );
    vi.mocked(refundPayment).mockRejectedValue(
      new Error("Stripe temporarily unavailable")
    );

    const result = await processReferralRefund({
      orderId: 501,
      actor: { type: "system", id: null },
    });

    expect(referralRepo.tryTransitionOrderById).not.toHaveBeenCalled();
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "refund_provider_failed",
      })
    );
    expect(notifyInternalActionRequired).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "refund_processing",
        reason: "Stripe temporarily unavailable",
      })
    );
    expect(result.status).toBe("failed");
  });
});
