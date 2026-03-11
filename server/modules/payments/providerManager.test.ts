import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providers/stripeAdapter", () => ({
  stripeAdapter: {
    createSession: vi.fn(),
    parseWebhookEvent: vi.fn(),
    verifyWebhook: vi.fn(),
    extractSessionId: vi.fn(),
    captureOrFinalize: vi.fn(),
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
    captureOrFinalize: vi.fn(),
  },
  createPaypalCheckoutSession: vi.fn(),
  parsePaypalWebhookEvent: vi.fn(),
  verifyPaypalWebhookSignature: vi.fn(),
  extractSessionIdFromWebhookEvent: vi.fn(),
  extractSessionIdFromParamsFromRedirect: vi.fn(),
  captureOrFinalizePaypalSession: vi.fn(),
}));

import { createPaymentCheckoutSession, resolvePaymentProvider } from "./providerManager";
import { paypalAdapter } from "./providers/paypalAdapter";

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
    expect(() => resolvePaymentProvider()).toThrow("Unsupported PAYMENT_PROVIDER");
  });
});
