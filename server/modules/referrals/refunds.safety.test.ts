import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../payments/publicApi", () => ({
  paymentProviderApi: { refund: vi.fn() },
}));
vi.mock("./repo", () => ({
  getReferralOrderById: vi.fn(),
  tryTransitionOrderById: vi.fn(),
  getLatestRefundRequestByOrderId: vi.fn(),
  updateRefundRequestById: vi.fn(),
  updateReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
  createRefundRequest: vi.fn(),
}));
vi.mock("./notifications", () => ({
  notifyInternalActionRequired: vi.fn(),
  notifyPatientReferralUpdate: vi.fn(),
}));

import { paymentProviderApi } from "../payments/publicApi";
import {
  notifyInternalActionRequired,
  notifyPatientReferralUpdate,
} from "./notifications";
import * as referralRepo from "./repo";
import {
  finalizeReferralRefund,
  initiateAutomaticReferralRefund,
  processReferralRefund,
} from "./refunds";

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    status: "refund_processing",
    paymentStatus: "paid",
    paymentProvider: "stripe",
    paymentProviderSessionId: "cs-501",
    paymentProviderTransactionId: "pi-501",
    totalAmount: 19900,
    currency: "cny",
    ...overrides,
  } as never;
}

const actor = { type: "system" as const, id: null };

describe("referral refund safety behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralRepo.tryTransitionOrderById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
      null as never
    );
    vi.mocked(referralRepo.updateReferralOrderById).mockResolvedValue(
      undefined as never
    );
    vi.mocked(referralRepo.insertOperation).mockResolvedValue(
      undefined as never
    );
    vi.mocked(notifyPatientReferralUpdate).mockResolvedValue(
      undefined as never
    );
    vi.mocked(notifyInternalActionRequired).mockResolvedValue(
      undefined as never
    );
  });

  it("rejects finalization for missing orders", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      null as never
    );
    await expect(
      finalizeReferralRefund({
        orderId: 501,
        providerRefundId: "re-501",
        actorType: "webhook",
        reason: "provider_refund_succeeded",
      })
    ).rejects.toThrow("Referral order not found");
  });

  it("returns an already-refunded order without duplicate side effects", async () => {
    const refunded = order({ status: "refunded", paymentStatus: "refunded" });
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      refunded as never
    );
    await expect(
      finalizeReferralRefund({
        orderId: 501,
        providerRefundId: "re-501",
        actorType: "webhook",
        reason: "provider_refund_succeeded",
      })
    ).resolves.toBe(refunded);
    expect(referralRepo.tryTransitionOrderById).not.toHaveBeenCalled();
    expect(notifyPatientReferralUpdate).not.toHaveBeenCalled();
  });

  it("rejects a failed final refund transition", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(order());
    vi.mocked(referralRepo.tryTransitionOrderById).mockResolvedValue({
      ok: false,
      reason: "conflict",
    } as never);
    await expect(
      finalizeReferralRefund({
        orderId: 501,
        providerRefundId: "re-501",
        actorType: "system",
        reason: "provider_refund_succeeded",
      })
    ).rejects.toThrow("REFERRAL_INVALID_STATUS_TRANSITION");
  });

  it("finalizes the order, refund request, audit, and patient notification", async () => {
    const processing = order();
    const refunded = order({ status: "refunded", paymentStatus: "refunded" });
    vi.mocked(referralRepo.getReferralOrderById)
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(refunded);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue({
      id: 81,
    } as never);

    await expect(
      finalizeReferralRefund({
        orderId: 501,
        providerRefundId: "re-501",
        actorType: "webhook",
        reason: "stripe_refund_webhook_succeeded",
      })
    ).resolves.toBe(refunded);
    expect(referralRepo.tryTransitionOrderById).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedFrom: ["refund_processing"],
        toStatus: "refunded",
        toPaymentStatus: "refunded",
        update: expect.objectContaining({ paymentProviderRefundId: "re-501" }),
      })
    );
    expect(referralRepo.updateRefundRequestById).toHaveBeenCalledWith({
      refundRequestId: 81,
      update: expect.objectContaining({ status: "refunded" }),
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "refund_completed" })
    );
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith({
      orderId: 501,
      event: "refund_completed",
      detail: "Refund completed.",
    });
  });

  it("rejects missing orders and provider sessions before refund calls", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValueOnce(
      null as never
    );
    await expect(
      processReferralRefund({ orderId: 501, actor })
    ).rejects.toThrow("Referral order not found");
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValueOnce(
      order({ paymentProviderSessionId: null })
    );
    await expect(
      processReferralRefund({ orderId: 501, actor })
    ).rejects.toThrow("Payment provider session is required");
    expect(paymentProviderApi.refund).not.toHaveBeenCalled();
  });

  it("returns success idempotently for an already-refunded order", async () => {
    const refunded = order({ status: "refunded", paymentStatus: "refunded" });
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(refunded);
    await expect(
      processReferralRefund({ orderId: 501, actor })
    ).resolves.toEqual({
      status: "succeeded",
      order: refunded,
    });
    expect(paymentProviderApi.refund).not.toHaveBeenCalled();
  });

  it("stores a pending provider refund without finalizing the order", async () => {
    const processing = order();
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(processing);
    vi.mocked(paymentProviderApi.refund).mockResolvedValue({
      provider: "stripe",
      providerRefundId: "re-pending",
      status: "pending",
    });
    await expect(
      processReferralRefund({ orderId: 501, actor })
    ).resolves.toEqual({
      status: "pending",
      order: processing,
    });
    expect(referralRepo.updateReferralOrderById).toHaveBeenCalledWith({
      orderId: 501,
      update: { paymentProviderRefundId: "re-pending" },
    });
    expect(referralRepo.tryTransitionOrderById).not.toHaveBeenCalled();
  });

  it("records a stable fallback when a provider rejects without an Error", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(order());
    vi.mocked(paymentProviderApi.refund).mockRejectedValue({ failure: true });
    await expect(
      processReferralRefund({ orderId: 501, actor })
    ).resolves.toMatchObject({
      status: "failed",
      error: "Unknown refund provider error",
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "refund_provider_failed",
        actionPayload: { error: "Unknown refund provider error" },
      })
    );
    expect(notifyInternalActionRequired).toHaveBeenCalledWith({
      orderId: 501,
      status: "refund_processing",
      reason: "Unknown refund provider error",
    });
  });

  it("rejects automatic refunds for missing, unpaid, or invalid-transition orders", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValueOnce(
      null as never
    );
    await expect(
      initiateAutomaticReferralRefund({
        orderId: 501,
        reasonCode: "sla_expired",
        reasonDetail: "SLA expired",
        actor,
      })
    ).rejects.toThrow("Referral order not found");

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValueOnce(
      order({ status: "contacting", paymentStatus: "pending" })
    );
    await expect(
      initiateAutomaticReferralRefund({
        orderId: 501,
        reasonCode: "sla_expired",
        reasonDetail: "SLA expired",
        actor,
      })
    ).rejects.toThrow("Only paid referral orders can be refunded");

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValueOnce(
      order({ status: "contacting" })
    );
    vi.mocked(referralRepo.tryTransitionOrderById).mockResolvedValueOnce({
      ok: false,
      reason: "conflict",
    } as never);
    await expect(
      initiateAutomaticReferralRefund({
        orderId: 501,
        reasonCode: "contact_failed",
        reasonDetail: "No contact",
        actor,
      })
    ).rejects.toThrow("REFERRAL_INVALID_STATUS_TRANSITION");
  });

  it("returns success for an automatically refunded order", async () => {
    const refunded = order({ status: "refunded", paymentStatus: "refunded" });
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(refunded);
    await expect(
      initiateAutomaticReferralRefund({
        orderId: 501,
        reasonCode: "booking_failed",
        reasonDetail: "Booking failed",
        actor,
      })
    ).resolves.toEqual({ status: "succeeded", order: refunded });
    expect(referralRepo.createRefundRequest).not.toHaveBeenCalled();
  });

  it("creates and processes an approved automatic refund request", async () => {
    const paid = order({ status: "contacting" });
    const pendingReview = order({ status: "refund_pending_review" });
    const processing = order();
    vi.mocked(referralRepo.getReferralOrderById)
      .mockResolvedValueOnce(paid)
      .mockResolvedValueOnce(pendingReview)
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(processing);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 82, status: "approved" } as never);
    vi.mocked(paymentProviderApi.refund).mockResolvedValue({
      provider: "stripe",
      providerRefundId: "re-pending",
      status: "pending",
    });

    await expect(
      initiateAutomaticReferralRefund({
        orderId: 501,
        reasonCode: "contact_failed",
        reasonDetail: "No patient contact",
        actor,
      })
    ).resolves.toMatchObject({ status: "pending" });
    expect(referralRepo.createRefundRequest).toHaveBeenCalledWith({
      values: expect.objectContaining({
        orderId: 501,
        reasonCode: "contact_failed",
        status: "approved",
      }),
    });
    expect(referralRepo.updateRefundRequestById).toHaveBeenCalledWith({
      refundRequestId: 82,
      update: { status: "processing" },
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "automatic_refund_started" })
    );
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith({
      orderId: 501,
      event: "refund_processing",
      detail: "Your full refund is being processed.",
    });
  });

  it("reuses an existing request and processing transition idempotently", async () => {
    const pendingReview = order({ status: "refund_pending_review" });
    const processing = order();
    vi.mocked(referralRepo.getReferralOrderById)
      .mockResolvedValueOnce(pendingReview)
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce(processing);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId)
      .mockResolvedValueOnce({ id: 83, status: "approved" } as never)
      .mockResolvedValueOnce({ id: 83, status: "processing" } as never);
    vi.mocked(paymentProviderApi.refund).mockResolvedValue({
      provider: "stripe",
      providerRefundId: "re-pending",
      status: "pending",
    });
    await initiateAutomaticReferralRefund({
      orderId: 501,
      reasonCode: "sla_expired",
      reasonDetail: "SLA expired",
      actor,
    });
    expect(referralRepo.createRefundRequest).not.toHaveBeenCalled();
    expect(referralRepo.updateRefundRequestById).not.toHaveBeenCalled();
  });

  it("rejects failure to enter refund processing", async () => {
    const pendingReview = order({ status: "refund_pending_review" });
    vi.mocked(referralRepo.getReferralOrderById)
      .mockResolvedValueOnce(pendingReview)
      .mockResolvedValueOnce(pendingReview);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue({
      id: 84,
      status: "approved",
    } as never);
    vi.mocked(referralRepo.tryTransitionOrderById).mockResolvedValue({
      ok: false,
      reason: "conflict",
    } as never);
    await expect(
      initiateAutomaticReferralRefund({
        orderId: 501,
        reasonCode: "sla_expired",
        reasonDetail: "SLA expired",
        actor,
      })
    ).rejects.toThrow("REFERRAL_INVALID_STATUS_TRANSITION");
  });
});
