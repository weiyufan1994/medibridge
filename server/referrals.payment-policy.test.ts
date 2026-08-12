import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOrderRow,
  resetReferralActionTestState,
} from "./referrals.actions.test-setup";
import { paymentProviderApi } from "./modules/payments/publicApi";
import * as referralRepo from "./modules/referrals/repo";
import {
  confirmMockPaymentAction,
  createPaymentSessionAction,
} from "./modules/referrals/actions";

describe("referral payment policy", () => {
  beforeEach(resetReferralActionTestState);

  it("rejects mock payment confirmation when provider mode is active", async () => {
    await expect(
      confirmMockPaymentAction({ id: 501, role: "free" } as never, {
        orderId: 112,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Mock checkout is disabled",
    });
    expect(referralRepo.getReferralOrderById).not.toHaveBeenCalled();
  });

  it("allows snapshot/manual-fulfillment orders to create payment sessions when still pending payment", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 109,
        hospitalId: null,
        departmentId: null,
        contactId: null,
        manualFulfillmentRequired: 1,
        status: "pending_payment",
        paymentStatus: "unpaid",
      }) as never
    );
    vi.mocked(paymentProviderApi.createCheckoutSession).mockResolvedValue({
      provider: "stripe",
      id: "cs_referral_3",
      url: "https://checkout.example/referral/3",
    } as never);
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: true,
      current: {
        id: 109,
        status: "pending_payment",
        paymentStatus: "unpaid",
      },
    } as never);

    const result = await createPaymentSessionAction({
      user: patientUser,
      createInput: { orderId: 109 },
      requestMetadata: {
        clientIp: null,
        forwardedHost: null,
        forwardedProto: null,
        host: "app.medibridge.test",
        protocol: "https",
        requestId: null,
        userAgent: null,
      },
    });

    expect(paymentProviderApi.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: {
          type: "referral_order",
          id: 109,
        },
      })
    );
    expect(result).toMatchObject({
      orderId: 109,
      status: "pending_payment",
      paymentStatus: "pending",
      checkoutSessionUrl: "https://checkout.example/referral/3",
    });
  });

  it("blocks payment session creation for orders that are no longer payable", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 108,
        status: "refunded",
        paymentStatus: "refunded",
      }) as never
    );

    await expect(
      createPaymentSessionAction({
        user: patientUser,
        createInput: { orderId: 108 },
        requestMetadata: {
          clientIp: null,
          forwardedHost: null,
          forwardedProto: null,
          host: "app.medibridge.test",
          protocol: "https",
          requestId: null,
          userAgent: null,
        },
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(paymentProviderApi.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns a clear message when a referral order is no longer waiting for payment", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 110,
        status: "paid_pending_assignment",
        paymentStatus: "paid",
      }) as never
    );

    await expect(
      createPaymentSessionAction({
        user: patientUser,
        createInput: { orderId: 110 },
        requestMetadata: {
          clientIp: null,
          forwardedHost: null,
          forwardedProto: null,
          host: "app.medibridge.test",
          protocol: "https",
          requestId: null,
          userAgent: null,
        },
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This referral order has already been paid.",
    });
  });
});
