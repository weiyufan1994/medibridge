import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBundle,
  createOrderRow,
  resetReferralActionTestState,
} from "./referrals.actions.test-setup";
import { paymentProviderApi } from "./modules/payments/publicApi";
import * as referralRepo from "./modules/referrals/repo";
import {
  confirmMockPaymentAction,
  confirmReturnedPaymentSessionAction,
  createPaymentSessionAction,
} from "./modules/referrals/actions";
import {
  notifyInternalPaidReferralOrder,
  notifyPatientReferralUpdate,
} from "./modules/referrals/notifications";

describe("referral payment sessions", () => {
  beforeEach(resetReferralActionTestState);

  it("confirms returned payment sessions and moves orders into paid_pending_assignment", async () => {
    vi.mocked(paymentProviderApi.captureOrFinalize).mockResolvedValue({
      provider: "stripe",
      providerSessionId: "cs_referral_1",
      providerTransactionId: "pi_referral_1",
      paymentStatus: "paid",
    });
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue(
      createOrderRow({
        id: 101,
        contactId: 31,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentProviderSessionId: "cs_referral_1",
      }) as never
    );
    vi.mocked(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).mockResolvedValue({
      ok: true,
      current: { id: 101 },
    } as never);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: {
          id: 101,
          contactId: 31,
          status: "paid_pending_assignment",
          paymentStatus: "paid",
          paymentProviderSessionId: "cs_referral_1",
          paidAt: new Date("2026-04-11T09:00:00.000Z"),
        },
      }) as never
    );

    const result = await confirmReturnedPaymentSessionAction({
      paymentSessionId: "cs_referral_1",
    });

    expect(paymentProviderApi.captureOrFinalize).toHaveBeenCalledWith({
      provider: "stripe",
      providerSessionId: "cs_referral_1",
    });
    expect(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentSessionId: "cs_referral_1",
        actorType: "webhook",
        reason: "return_url_payment_verified",
      })
    );
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 101,
        actionType: "payment_success",
      })
    );
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 101,
        event: "payment_success",
      })
    );
    expect(notifyInternalPaidReferralOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 101,
        hospitalName: "复旦大学附属中山医院",
        manualFulfillmentRequired: false,
      })
    );
    expect(result).toMatchObject({
      ok: true,
      orderId: 101,
      status: "paid_pending_assignment",
      paymentStatus: "paid",
    });
  });

  it("creates a payment session for an existing pending referral order", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 107,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentProviderSessionId: "cs_old",
      }) as never
    );
    vi.mocked(paymentProviderApi.createCheckoutSession).mockResolvedValue({
      provider: "stripe",
      id: "cs_referral_2",
      url: "https://checkout.example/referral/2",
    } as never);
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: true,
      current: {
        id: 107,
        status: "pending_payment",
        paymentStatus: "pending",
      },
    } as never);

    const result = await createPaymentSessionAction({
      user: patientUser,
      createInput: { orderId: 107 },
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
          id: 107,
        },
        amount: 19900,
        currency: "usd",
      })
    );
    expect(referralRepo.markOrderPendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 107,
        paymentSessionId: "cs_referral_2",
      })
    );
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 107,
        actionType: "payment_session_created",
      })
    );
    expect(result).toMatchObject({
      orderId: 107,
      status: "pending_payment",
      paymentStatus: "pending",
      checkoutSessionUrl: "https://checkout.example/referral/2",
    });
  });

  it("creates a mock payment session in production when REFERRAL_PAYMENT_MODE=mock", async () => {
    const patientUser = { id: 501, role: "free" } as never;
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = "production";
    process.env.REFERRAL_PAYMENT_MODE = "mock";

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 111,
        status: "pending_payment",
        paymentStatus: "unpaid",
        paymentProviderSessionId: null,
      }) as never
    );
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: true,
      current: {
        id: 111,
        status: "pending_payment",
        paymentStatus: "pending",
      },
    } as never);
    vi.mocked(paymentProviderApi.createCheckoutSession).mockResolvedValue({
      provider: "mock",
      id: `mock_referral_order_session_${"a".repeat(32)}`,
      url: "https://app.medibridge.test/referrals/mock-checkout/111",
    });

    try {
      const result = await createPaymentSessionAction({
        user: patientUser,
        createInput: { orderId: 111 },
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
          resource: { type: "referral_order", id: 111 },
          mockCheckoutUrl:
            "https://app.medibridge.test/referrals/mock-checkout/111",
        }),
        "mock"
      );
      expect(referralRepo.markOrderPendingPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 111,
          paymentProvider: "mock",
          paymentSessionId: `mock_referral_order_session_${"a".repeat(32)}`,
        })
      );
      expect(result).toMatchObject({
        orderId: 111,
        status: "pending_payment",
        paymentStatus: "pending",
        checkoutSessionUrl:
          "https://app.medibridge.test/referrals/mock-checkout/111",
      });
      expect(result.paymentSessionId).toBeUndefined();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.REFERRAL_PAYMENT_MODE = "provider";
    }
  });

  it("confirms an owned mock payment in production without an external provider", async () => {
    const mockSessionId = `mock_referral_order_session_${"b".repeat(32)}`;
    vi.mocked(paymentProviderApi.captureOrFinalize).mockResolvedValue({
      provider: "mock",
      providerSessionId: mockSessionId,
      providerTransactionId: "mock_transaction_123",
      paymentStatus: "paid",
    });
    process.env.REFERRAL_PAYMENT_MODE = "mock";
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 112,
        paymentProvider: "mock",
        paymentProviderSessionId: mockSessionId,
        paymentStatus: "pending",
      }) as never
    );
    vi.mocked(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).mockResolvedValue({
      ok: true,
      current: { id: 112 },
    } as never);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: {
          id: 112,
          status: "paid_pending_assignment",
          paymentStatus: "paid",
          paymentProvider: "mock",
          paymentProviderSessionId: mockSessionId,
        },
      }) as never
    );

    const result = await confirmMockPaymentAction(
      { id: 501, role: "free" } as never,
      { orderId: 112 }
    );

    expect(paymentProviderApi.captureOrFinalize).toHaveBeenCalledWith({
      provider: "mock",
      providerSessionId: mockSessionId,
    });
    expect(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentSessionId: mockSessionId,
        paymentProviderTransactionId: "mock_transaction_123",
        reason: "mock_payment_confirmed",
      })
    );
    expect(result).toMatchObject({
      ok: true,
      orderId: 112,
      paymentStatus: "paid",
    });
  });
});
