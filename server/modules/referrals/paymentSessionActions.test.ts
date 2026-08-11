import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/getPublicBaseUrl", () => ({
  getPublicBaseUrl: vi.fn(),
}));
vi.mock("../payments/publicApi", () => ({
  paymentProviderApi: {
    createCheckoutSession: vi.fn(),
  },
}));
vi.mock("./accessControl", () => ({
  getOwnedOrder: vi.fn(),
  requireFormalUser: vi.fn(),
}));
vi.mock("./paymentMode", () => ({
  resolveReferralPaymentMode: vi.fn(),
}));
vi.mock("./repo", () => ({
  getReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
  markOrderPendingPayment: vi.fn(),
}));

import { getPublicBaseUrl } from "../../_core/getPublicBaseUrl";
import { paymentProviderApi } from "../payments/publicApi";
import { getOwnedOrder, requireFormalUser } from "./accessControl";
import { resolveReferralPaymentMode } from "./paymentMode";
import { createPaymentSessionAction } from "./paymentSessionActions";
import * as referralRepo from "./repo";

const user = { id: 501, isGuest: 0 };
const order = {
  id: 107,
  status: "pending_payment",
  paymentStatus: "unpaid",
  totalAmount: 19900,
  currency: "cny",
};
const request = {} as never;

describe("referral payment session actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireFormalUser).mockReturnValue(user as never);
    vi.mocked(getOwnedOrder).mockResolvedValue(order as never);
    vi.mocked(getPublicBaseUrl).mockReturnValue("https://app.medibridge.test");
    vi.mocked(resolveReferralPaymentMode).mockReturnValue("provider");
    vi.mocked(paymentProviderApi.createCheckoutSession).mockResolvedValue({
      provider: "stripe",
      id: "cs_referral_107",
      url: "https://checkout.example/referral/107",
    });
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: true,
      current: order,
    } as never);
  });

  it("creates and audits a provider checkout without changing its response", async () => {
    const result = await createPaymentSessionAction({
      user: user as never,
      createInput: { orderId: 107 },
      req: request,
    });

    expect(requireFormalUser).toHaveBeenCalledWith(user);
    expect(getOwnedOrder).toHaveBeenCalledWith({
      orderId: 107,
      userId: 501,
    });
    expect(paymentProviderApi.createCheckoutSession).toHaveBeenCalledWith({
      resource: { type: "referral_order", id: 107 },
      amount: 19900,
      currency: "cny",
      successUrl:
        "https://app.medibridge.test/referrals/payment/success?orderId=107&session_id={CHECKOUT_SESSION_ID}",
      cancelUrl:
        "https://app.medibridge.test/referrals/payment/cancel?orderId=107&session_id={CHECKOUT_SESSION_ID}",
      mockCheckoutUrl:
        "https://app.medibridge.test/referrals/mock-checkout/107",
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledWith({
      orderId: 107,
      operatorType: "patient",
      operatorId: 501,
      actionType: "payment_session_created",
      actionPayload: { paymentSessionId: "cs_referral_107" },
    });
    expect(result).toMatchObject({
      orderId: 107,
      status: "pending_payment",
      paymentStatus: "pending",
      checkoutSessionUrl: "https://checkout.example/referral/107",
    });
  });

  it("passes the explicit mock provider only in mock mode", async () => {
    vi.mocked(resolveReferralPaymentMode).mockReturnValue("mock");

    await createPaymentSessionAction({
      user: user as never,
      createInput: { orderId: 107 },
      req: request,
    });

    expect(paymentProviderApi.createCheckoutSession).toHaveBeenCalledWith(
      expect.any(Object),
      "mock"
    );
  });

  it("retries one payable write conflict and audits the successful retry", async () => {
    vi.mocked(referralRepo.markOrderPendingPayment)
      .mockResolvedValueOnce({ ok: false, reason: "conflict" } as never)
      .mockResolvedValueOnce({ ok: true, current: order } as never);
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      paymentStatus: "pending",
    } as never);

    await expect(
      createPaymentSessionAction({
        user: user as never,
        createInput: { orderId: 107 },
        req: request,
      })
    ).resolves.toMatchObject({ paymentStatus: "pending" });
    expect(referralRepo.markOrderPendingPayment).toHaveBeenCalledTimes(2);
    expect(referralRepo.insertOperation).toHaveBeenCalledTimes(1);
  });

  it("reports the latest non-payable state after a concurrent update", async () => {
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: false,
      reason: "conflict",
      current: order,
    } as never);
    vi.mocked(referralRepo.getReferralOrderById)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...order,
        status: "paid_pending_assignment",
        paymentStatus: "paid",
      } as never);

    await expect(
      createPaymentSessionAction({
        user: user as never,
        createInput: { orderId: 107 },
        req: request,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This referral order has already been paid.",
    });
  });

  it("uses the stable retry error when a failed write has no newer order", async () => {
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: false,
      reason: "conflict",
    } as never);
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

    await expect(
      createPaymentSessionAction({
        user: user as never,
        createInput: { orderId: 107 },
        req: request,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "Unable to start payment right now. Please refresh and try again.",
    });
  });

  it.each([
    ["pending_payment", "paid", "This referral order has already been paid."],
    [
      "pending_payment",
      "refunded",
      "This referral order can no longer be paid.",
    ],
    [
      "completed",
      "unpaid",
      "This referral order is no longer waiting for payment.",
    ],
    [
      "pending_payment",
      "unknown",
      "This referral order is not payable right now.",
    ],
  ])(
    "rejects non-payable state %s/%s",
    async (status, paymentStatus, message) => {
      vi.mocked(getOwnedOrder).mockResolvedValue({
        ...order,
        status,
        paymentStatus,
      } as never);

      await expect(
        createPaymentSessionAction({
          user: user as never,
          createInput: { orderId: 107 },
          req: request,
        })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message });
      expect(paymentProviderApi.createCheckoutSession).not.toHaveBeenCalled();
    }
  );
});
