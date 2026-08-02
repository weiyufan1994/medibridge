import { describe, expect, it } from "vitest";
import { mockAdapter } from "./mockAdapter";

describe("mock payment adapter", () => {
  it("creates a mock referral checkout without an external provider", async () => {
    const result = await mockAdapter.createSession({
      resource: { type: "referral_order", id: 701 },
      amount: 19900,
      currency: "cny",
      successUrl: "https://app.test/referrals/payment/success",
      cancelUrl: "https://app.test/referrals/payment/cancel",
      mockCheckoutUrl: "https://app.test/referrals/mock-checkout/701",
    });

    expect(result).toMatchObject({
      provider: "mock",
      url: "https://app.test/referrals/mock-checkout/701",
    });
    expect(result.id).toMatch(/^mock_referral_order_session_[0-9a-f]{32}$/);
  });

  it("settles a valid mock session with a stable transaction id", async () => {
    const sessionId = `mock_referral_order_session_${"a".repeat(32)}`;
    const first = await mockAdapter.captureOrFinalize({
      providerSessionId: sessionId,
    });
    const second = await mockAdapter.captureOrFinalize({
      providerSessionId: sessionId,
    });

    expect(first.paymentStatus).toBe("paid");
    expect(first.providerTransactionId).toBe(second.providerTransactionId);
  });

  it("returns the same successful refund for the same idempotency key", async () => {
    const input = {
      providerSessionId: `mock_referral_order_session_${"b".repeat(32)}`,
      amount: 19900,
      currency: "cny",
      idempotencyKey: "referral-order-701-full-refund",
    };
    const first = await mockAdapter.refund(input);
    const second = await mockAdapter.refund(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({ provider: "mock", status: "succeeded" });
    expect(first.providerRefundId).toMatch(/^mock_refund_[0-9a-f]{32}$/);
  });

  it("rejects malformed mock session ids", async () => {
    await expect(
      mockAdapter.captureOrFinalize({ providerSessionId: "mock_guessed" })
    ).rejects.toThrow("Invalid mock payment session id");
    await expect(
      mockAdapter.refund({
        providerSessionId: "mock_guessed",
        idempotencyKey: "referral-order-701-full-refund",
      })
    ).rejects.toThrow("Invalid mock payment session id");
  });
});
