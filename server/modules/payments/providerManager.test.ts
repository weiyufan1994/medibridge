import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers/stripeAdapter", () => ({
  stripeAdapter: {
    createSession: vi.fn(),
    parseWebhookEvent: vi.fn(),
    verifyWebhook: vi.fn(),
    extractSessionId: vi.fn(),
    captureOrFinalize: vi.fn(),
    refund: vi.fn(),
    provider: "stripe",
  },
}));

vi.mock("./providers/paypalAdapter", () => ({
  paypalAdapter: {
    provider: "paypal" as const,
    createSession: vi.fn(),
    createPaypalCheckoutSession: vi.fn(),
    parseWebhookEvent: vi.fn(),
    verifyWebhook: vi.fn(),
    extractSession: vi.fn(),
    extractSessionId: vi.fn(),
    captureOrFinalize: vi.fn(),
    refund: vi.fn(),
  },
  createPaypalCheckoutSession: vi.fn(),
  parsePaypalWebhookEvent: vi.fn(),
  verifyPaypalWebhookSignature: vi.fn(),
  extractSessionIdFromWebhookEvent: vi.fn(),
  extractSessionIdFromParamsFromRedirect: vi.fn(),
  captureOrFinalizePaypalSession: vi.fn(),
}));

import {
  createPaymentCheckoutSession,
  refundPayment,
  resolvePaymentAdapter,
  resolvePaymentProvider,
} from "./providerManager";
import { paypalAdapter } from "./providers/paypalAdapter";
import { stripeAdapter } from "./providers/stripeAdapter";

describe("providerManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYMENT_PROVIDER;
  });

  it("defaults to stripe provider when PAYMENT_PROVIDER is missing", () => {
    expect(resolvePaymentProvider()).toBe("stripe");
  });

  it("uses paypal provider when PAYMENT_PROVIDER=paypal", async () => {
    process.env.PAYMENT_PROVIDER = "paypal";
    vi.mocked(paypalAdapter.createSession).mockResolvedValue({
      provider: "paypal",
      id: "order_123",
      url: "https://www.sandbox.paypal.com",
    } as never);

    const session = await createPaymentCheckoutSession({
      appointmentId: 7,
      amount: 100,
      currency: "usd",
      successUrl: "https://app.test/payment/success",
      cancelUrl: "https://app.test/payment/cancel",
    });

    expect(session).toMatchObject({
      provider: "paypal",
      id: "order_123",
    });
    expect(paypalAdapter.createSession).toHaveBeenCalledTimes(1);
  });

  it("throws when PAYMENT_PROVIDER is unsupported", () => {
    process.env.PAYMENT_PROVIDER = "square";
    expect(() => resolvePaymentProvider()).toThrow(
      "Unsupported PAYMENT_PROVIDER"
    );
  });

  it("normalizes provider configuration and defaults adapter resolution", () => {
    process.env.PAYMENT_PROVIDER = " PAYPAL ";
    expect(resolvePaymentProvider()).toBe("paypal");
    expect(resolvePaymentAdapter()).toMatchObject({ provider: "paypal" });
    expect(resolvePaymentAdapter("mock")).toMatchObject({ provider: "mock" });
  });

  it("routes Stripe checkout, webhook, capture, and refund operations", async () => {
    vi.mocked(stripeAdapter.createSession).mockResolvedValue({
      provider: "stripe",
      id: "cs_123",
      url: "https://checkout.stripe.test/cs_123",
    });
    vi.mocked(stripeAdapter.extractSessionId).mockReturnValue("cs_123");
    vi.mocked(stripeAdapter.captureOrFinalize).mockResolvedValue({
      provider: "stripe",
      providerSessionId: "cs_123",
      paymentStatus: "paid",
    });
    vi.mocked(stripeAdapter.refund).mockResolvedValue({
      provider: "stripe",
      providerRefundId: "re_123",
      status: "succeeded",
    });
    const adapter = resolvePaymentAdapter("stripe");
    await createPaymentCheckoutSession({
      appointmentId: 1,
      amount: 4900,
      currency: "usd",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    adapter.verifyWebhook({
      rawBody: Buffer.from("{}"),
      headers: { "stripe-signature": "sig" },
      webhookSecret: "secret",
    });
    expect(adapter.extractSessionIdFromWebhookEvent({ id: "evt" })).toBe(
      "cs_123"
    );
    expect(adapter.getEventType({ type: "checkout.session.completed" })).toBe(
      "checkout.session.completed"
    );
    expect(adapter.getEventType(null)).toBe("");
    await expect(
      adapter.captureOrFinalize({ providerSessionId: "cs_123" })
    ).resolves.toMatchObject({ paymentStatus: "paid" });
    await expect(
      refundPayment({
        provider: "stripe",
        providerSessionId: "cs_123",
        amount: 4900,
        currency: "usd",
        idempotencyKey: "appointment-1-refund",
      })
    ).resolves.toMatchObject({ providerRefundId: "re_123" });
  });

  it("adapts PayPal webhook event operations", () => {
    vi.mocked(paypalAdapter.extractSessionId).mockReturnValue("order_123");
    const adapter = resolvePaymentAdapter("paypal");
    adapter.verifyWebhook({
      rawBody: Buffer.from("{}"),
      headers: { "paypal-transmission-id": "transmission" },
      webhookSecret: "ignored",
    });
    expect(adapter.extractSessionIdFromWebhookEvent({ id: "evt" })).toBe(
      "order_123"
    );
    expect(
      adapter.getEventType({ event_type: "PAYMENT.CAPTURE.COMPLETED" })
    ).toBe("PAYMENT.CAPTURE.COMPLETED");
    expect(adapter.getEventType({})).toBe("");
  });

  it("routes explicit mock checkouts and refunds through the mock adapter", async () => {
    const checkout = await createPaymentCheckoutSession(
      {
        resource: { type: "referral_order", id: 81 },
        amount: 19900,
        currency: "cny",
        successUrl: "https://app.test/referrals/payment/success",
        cancelUrl: "https://app.test/referrals/payment/cancel",
        mockCheckoutUrl: "https://app.test/referrals/mock-checkout/81",
      },
      "mock"
    );
    const refund = await refundPayment({
      provider: "mock",
      resource: { type: "referral_order", id: 81 },
      providerSessionId: checkout.id,
      amount: 19900,
      currency: "cny",
      idempotencyKey: "referral-order-81-full-refund",
    });

    expect(checkout.provider).toBe("mock");
    expect(refund).toMatchObject({
      provider: "mock",
      status: "succeeded",
    });
  });
});
