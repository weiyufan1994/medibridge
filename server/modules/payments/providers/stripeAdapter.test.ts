import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from "axios";
import {
  captureOrFinalizeStripeSession,
  createStripeCheckoutSession,
  refundStripePayment,
} from "./stripeAdapter";

describe("Stripe payment adapter", () => {
  const originalSecretKey = process.env.STRIPE_SECRET_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_referral";
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = originalSecretKey;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("creates a CNY referral checkout with resource metadata", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        id: "cs_referral_1",
        url: "https://checkout.stripe.test/cs_referral_1",
      },
    });

    const result = await createStripeCheckoutSession({
      resource: { type: "referral_order", id: 701 },
      amount: 19900,
      currency: "cny",
      successUrl: "https://app.test/referrals/payment/success",
      cancelUrl: "https://app.test/referrals/payment/cancel",
    });

    const body = String(vi.mocked(axios.post).mock.calls[0]?.[1]);
    expect(body).toContain("metadata%5BresourceType%5D=referral_order");
    expect(body).toContain("metadata%5BresourceId%5D=701");
    expect(body).toContain(
      "payment_intent_data%5Bmetadata%5D%5BresourceType%5D=referral_order"
    );
    expect(body).toContain(
      "line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=cny"
    );
    expect(body).toContain(
      "line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=19900"
    );
    expect(result.id).toBe("cs_referral_1");
  });

  it("keeps legacy appointment metadata while adding generic resource metadata", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        id: "cs_appointment_1",
        url: "https://checkout.stripe.test/cs_appointment_1",
      },
    });

    await createStripeCheckoutSession({
      appointmentId: 91,
      amount: 10000,
      currency: "usd",
      successUrl: "https://app.test/payment/success",
      cancelUrl: "https://app.test/payment/cancel",
    });

    const body = String(vi.mocked(axios.post).mock.calls[0]?.[1]);
    expect(body).toContain("metadata%5BresourceType%5D=appointment");
    expect(body).toContain("metadata%5BresourceId%5D=91");
    expect(body).toContain("metadata%5BappointmentId%5D=91");
  });

  it("does not report an unpaid Checkout Session as paid", async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        id: "cs_referral_unpaid",
        payment_status: "unpaid",
        payment_intent: null,
      },
    });

    const result = await captureOrFinalizeStripeSession({
      providerSessionId: "cs_referral_unpaid",
    });

    expect(result.paymentStatus).toBe("unpaid");
    expect(result.providerTransactionId).toBeNull();
  });

  it("uses the order idempotency key for a full Stripe refund", async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        id: "re_referral_1",
        status: "succeeded",
      },
    });

    const result = await refundStripePayment({
      resource: { type: "referral_order", id: 701 },
      providerSessionId: "cs_referral_1",
      providerTransactionId: "pi_referral_1",
      amount: 19900,
      currency: "cny",
      idempotencyKey: "referral-order-701-full-refund",
    });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining("/v1/refunds"),
      expect.stringContaining("amount=19900"),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Idempotency-Key": "referral-order-701-full-refund",
        }),
      })
    );
    expect(result).toMatchObject({
      providerRefundId: "re_referral_1",
      status: "succeeded",
    });
  });

  it("supports a local mock full-refund path without Stripe credentials", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const result = await refundStripePayment({
      resource: { type: "referral_order", id: 701 },
      providerSessionId: "cs_test_referral_1",
      providerTransactionId: null,
      amount: 19900,
      currency: "cny",
      idempotencyKey: "referral-order-701-full-refund",
    });

    expect(result.status).toBe("succeeded");
    expect(result.providerRefundId).toMatch(/^re_test_/);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
