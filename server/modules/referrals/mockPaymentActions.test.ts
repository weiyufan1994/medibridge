import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../payments/publicApi", () => ({
  paymentProviderApi: {
    captureOrFinalize: vi.fn(),
  },
}));
vi.mock("./accessControl", () => ({
  getOwnedOrder: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("./paymentMode", () => ({
  resolveReferralPaymentMode: vi.fn(),
}));
vi.mock("./paymentSettlement", () => ({
  settleReferralOrderPaymentBySessionId: vi.fn(),
}));

import { paymentProviderApi } from "../payments/publicApi";
import { getOwnedOrder, requireUser } from "./accessControl";
import { confirmMockPaymentAction } from "./mockPaymentActions";
import { resolveReferralPaymentMode } from "./paymentMode";
import { settleReferralOrderPaymentBySessionId } from "./paymentSettlement";

const user = { id: 501 };
const order = {
  id: 112,
  paymentProvider: "mock",
  paymentProviderSessionId: "mock_referral_session_112",
};
const settledOrder = {
  id: 112,
  status: "paid_pending_assignment",
  paymentStatus: "paid",
  paymentProviderSessionId: "mock_referral_session_112",
};

describe("mock referral payment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveReferralPaymentMode).mockReturnValue("mock");
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(getOwnedOrder).mockResolvedValue(order as never);
    vi.mocked(paymentProviderApi.captureOrFinalize).mockResolvedValue({
      provider: "mock",
      providerSessionId: "mock_referral_session_112",
      providerTransactionId: "mock_transaction_112",
      paymentStatus: "paid",
    });
    vi.mocked(settleReferralOrderPaymentBySessionId).mockResolvedValue(
      settledOrder as never
    );
  });

  it("confirms and settles an authenticated owned mock payment", async () => {
    const result = await confirmMockPaymentAction(user as never, {
      orderId: 112,
    });

    expect(requireUser).toHaveBeenCalledWith(user);
    expect(getOwnedOrder).toHaveBeenCalledWith({
      orderId: 112,
      userId: 501,
    });
    expect(paymentProviderApi.captureOrFinalize).toHaveBeenCalledWith({
      provider: "mock",
      providerSessionId: "mock_referral_session_112",
    });
    expect(settleReferralOrderPaymentBySessionId).toHaveBeenCalledWith({
      paymentSessionId: "mock_referral_session_112",
      paymentProviderTransactionId: "mock_transaction_112",
      actorType: "system",
      reason: "mock_payment_confirmed",
    });
    expect(result).toEqual({
      ok: true,
      orderId: 112,
      status: "paid_pending_assignment",
      paymentStatus: "paid",
      paymentSessionId: "mock_referral_session_112",
    });
  });

  it("rejects before authentication when mock mode is disabled", async () => {
    vi.mocked(resolveReferralPaymentMode).mockReturnValue("provider");

    await expect(
      confirmMockPaymentAction(user as never, { orderId: 112 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Mock checkout is disabled",
    });
    expect(requireUser).not.toHaveBeenCalled();
  });

  it("preserves the authentication failure from access control", async () => {
    vi.mocked(requireUser).mockImplementation(() => {
      throw Object.assign(new Error("Please sign in to continue."), {
        code: "UNAUTHORIZED",
      });
    });

    await expect(
      confirmMockPaymentAction(null, { orderId: 112 })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    });
    expect(getOwnedOrder).not.toHaveBeenCalled();
  });

  it("rejects an owned order without a payment session", async () => {
    vi.mocked(getOwnedOrder).mockResolvedValue({
      ...order,
      paymentProviderSessionId: null,
    } as never);

    await expect(
      confirmMockPaymentAction(user as never, { orderId: 112 })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Payment session is missing for referral order",
    });
    expect(paymentProviderApi.captureOrFinalize).not.toHaveBeenCalled();
  });

  it("rejects an order that belongs to a real payment provider", async () => {
    vi.mocked(getOwnedOrder).mockResolvedValue({
      ...order,
      paymentProvider: "stripe",
    } as never);

    await expect(
      confirmMockPaymentAction(user as never, { orderId: 112 })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Referral order is not using mock payment",
    });
    expect(paymentProviderApi.captureOrFinalize).not.toHaveBeenCalled();
  });

  it("normalizes missing transaction and response session ids", async () => {
    vi.mocked(paymentProviderApi.captureOrFinalize).mockResolvedValue({
      provider: "mock",
      providerSessionId: "mock_referral_session_112",
      providerTransactionId: null,
      paymentStatus: "paid",
    });
    vi.mocked(settleReferralOrderPaymentBySessionId).mockResolvedValue({
      ...settledOrder,
      paymentProviderSessionId: null,
    } as never);

    await expect(
      confirmMockPaymentAction(user as never, { orderId: 112 })
    ).resolves.toMatchObject({ paymentSessionId: null });
    expect(settleReferralOrderPaymentBySessionId).toHaveBeenCalledWith(
      expect.objectContaining({ paymentProviderTransactionId: null })
    );
  });
});
