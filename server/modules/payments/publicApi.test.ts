import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./providerManager", () => ({
  createPaymentCheckoutSession: vi.fn(),
  refundPayment: vi.fn(),
  resolvePaymentAdapter: vi.fn(),
}));

import { paymentProviderApi } from "./publicApi";
import * as providerManager from "./providerManager";

describe("payment provider public API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes checkout creation without changing provider selection", async () => {
    const input = {
      resource: { type: "referral_order" as const, id: 41 },
      amount: 19900,
      currency: "cny",
      successUrl: "https://medibridge.test/payment/success",
      cancelUrl: "https://medibridge.test/payment/cancel",
    };
    vi.mocked(providerManager.createPaymentCheckoutSession).mockResolvedValue({
      provider: "mock",
      id: "mock_session_41",
      url: "https://medibridge.test/mock/41",
    });

    const result = await paymentProviderApi.createCheckoutSession(
      input,
      "mock"
    );

    expect(providerManager.createPaymentCheckoutSession).toHaveBeenCalledWith(
      input,
      "mock"
    );
    expect(result).toEqual({
      provider: "mock",
      id: "mock_session_41",
      url: "https://medibridge.test/mock/41",
    });
  });

  it("only exposes provider capture/finalization through a focused operation", async () => {
    const captureOrFinalize = vi.fn().mockResolvedValue({
      provider: "stripe",
      providerSessionId: "cs_41",
      providerTransactionId: "pi_41",
      paymentStatus: "paid",
    });
    vi.mocked(providerManager.resolvePaymentAdapter).mockReturnValue({
      captureOrFinalize,
    } as never);

    const result = await paymentProviderApi.captureOrFinalize({
      provider: "stripe",
      providerSessionId: "cs_41",
    });

    expect(providerManager.resolvePaymentAdapter).toHaveBeenCalledWith(
      "stripe"
    );
    expect(captureOrFinalize).toHaveBeenCalledWith({
      providerSessionId: "cs_41",
    });
    expect(result.paymentStatus).toBe("paid");
  });

  it("passes refund identifiers through unchanged", async () => {
    const input = {
      provider: "paypal" as const,
      resource: { type: "appointment" as const, id: 42 },
      providerSessionId: "order_42",
      providerTransactionId: "capture_42",
      amount: 4900,
      currency: "usd",
      idempotencyKey: "appointment-42-full-refund",
    };
    vi.mocked(providerManager.refundPayment).mockResolvedValue({
      provider: "paypal",
      providerRefundId: "refund_42",
      status: "succeeded",
    });

    const result = await paymentProviderApi.refund(input);

    expect(providerManager.refundPayment).toHaveBeenCalledWith(input);
    expect(result).toMatchObject({
      providerRefundId: "refund_42",
      status: "succeeded",
    });
  });
});
