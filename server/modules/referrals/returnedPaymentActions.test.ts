import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../payments/publicApi", () => ({
  paymentProviderApi: {
    captureOrFinalize: vi.fn(),
  },
}));
vi.mock("./paymentSettlement", () => ({
  settleReferralOrderPaymentBySessionId: vi.fn(),
}));
vi.mock("./repo", () => ({
  getReferralOrderByPaymentSessionId: vi.fn(),
}));

import { paymentProviderApi } from "../payments/publicApi";
import { settleReferralOrderPaymentBySessionId } from "./paymentSettlement";
import * as referralRepo from "./repo";
import { confirmReturnedPaymentSessionAction } from "./returnedPaymentActions";

const pendingOrder = {
  id: 101,
  paymentStatus: "pending",
  paymentProvider: "stripe",
  paymentProviderTransactionId: null,
};
const settledOrder = {
  id: 101,
  status: "paid_pending_assignment",
  paymentStatus: "paid",
  paymentProviderSessionId: "cs_referral_101",
};

describe("returned referral payment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue(pendingOrder as never);
    vi.mocked(paymentProviderApi.captureOrFinalize).mockResolvedValue({
      provider: "stripe",
      providerSessionId: "cs_referral_101",
      providerTransactionId: "pi_referral_101",
      paymentStatus: "paid",
    });
    vi.mocked(settleReferralOrderPaymentBySessionId).mockResolvedValue(
      settledOrder as never
    );
  });

  it("verifies a provider payment and settles with the existing actor semantics", async () => {
    const result = await confirmReturnedPaymentSessionAction({
      paymentSessionId: "cs_referral_101",
    });

    expect(paymentProviderApi.captureOrFinalize).toHaveBeenCalledWith({
      provider: "stripe",
      providerSessionId: "cs_referral_101",
    });
    expect(settleReferralOrderPaymentBySessionId).toHaveBeenCalledWith({
      paymentSessionId: "cs_referral_101",
      paymentProviderTransactionId: "pi_referral_101",
      actorType: "webhook",
      reason: "return_url_payment_verified",
    });
    expect(result).toEqual({
      ok: true,
      orderId: 101,
      status: "paid_pending_assignment",
      paymentStatus: "paid",
      paymentSessionId: "cs_referral_101",
    });
  });

  it("keeps an already-paid session idempotent without provider recapture", async () => {
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue({
      ...pendingOrder,
      paymentStatus: "paid",
      paymentProviderTransactionId: "pi_existing",
    } as never);

    await confirmReturnedPaymentSessionAction({
      paymentSessionId: "cs_referral_101",
    });

    expect(paymentProviderApi.captureOrFinalize).not.toHaveBeenCalled();
    expect(settleReferralOrderPaymentBySessionId).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentProviderTransactionId: "pi_existing",
      })
    );
  });

  it("rejects an unknown payment session before provider access", async () => {
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue(null);

    await expect(
      confirmReturnedPaymentSessionAction({
        paymentSessionId: "cs_missing",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found for payment session",
    });
    expect(paymentProviderApi.captureOrFinalize).not.toHaveBeenCalled();
  });

  it("rejects mock sessions on the unauthenticated return path", async () => {
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue({
      ...pendingOrder,
      paymentProvider: "mock",
    } as never);

    await expect(
      confirmReturnedPaymentSessionAction({
        paymentSessionId: "mock_session",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message:
        "Mock payments must be confirmed by the authenticated mock checkout flow.",
    });
    expect(paymentProviderApi.captureOrFinalize).not.toHaveBeenCalled();
  });

  it("does not settle when the provider has not confirmed payment", async () => {
    vi.mocked(paymentProviderApi.captureOrFinalize).mockResolvedValue({
      provider: "stripe",
      providerSessionId: "cs_referral_101",
      providerTransactionId: null,
      paymentStatus: "pending",
    });

    await expect(
      confirmReturnedPaymentSessionAction({
        paymentSessionId: "cs_referral_101",
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Payment has not been confirmed by the provider.",
    });
    expect(settleReferralOrderPaymentBySessionId).not.toHaveBeenCalled();
  });

  it("normalizes a missing provider transaction id and response session id", async () => {
    vi.mocked(paymentProviderApi.captureOrFinalize).mockResolvedValue({
      provider: "paypal",
      providerSessionId: "paypal_session_101",
      providerTransactionId: null,
      paymentStatus: "paid",
    });
    vi.mocked(settleReferralOrderPaymentBySessionId).mockResolvedValue({
      ...settledOrder,
      paymentProviderSessionId: null,
    } as never);

    await expect(
      confirmReturnedPaymentSessionAction({
        paymentSessionId: "paypal_session_101",
      })
    ).resolves.toMatchObject({ paymentSessionId: null });
    expect(settleReferralOrderPaymentBySessionId).toHaveBeenCalledWith(
      expect.objectContaining({ paymentProviderTransactionId: null })
    );
  });
});
