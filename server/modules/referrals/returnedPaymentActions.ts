import { TRPCError } from "@trpc/server";
import {
  paymentProviderApi,
  type PaymentProvider,
} from "../payments/publicApi";
import { settleReferralOrderPaymentBySessionId } from "./paymentSettlement";
import * as referralRepo from "./repo";

export async function confirmReturnedPaymentSessionAction(input: {
  paymentSessionId: string;
}) {
  const order = await referralRepo.getReferralOrderByPaymentSessionId(
    input.paymentSessionId
  );
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found for payment session",
    });
  }

  let paymentProviderTransactionId = order.paymentProviderTransactionId ?? null;
  if (order.paymentStatus !== "paid") {
    if (order.paymentProvider === "mock") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Mock payments must be confirmed by the authenticated mock checkout flow.",
      });
    }
    const verification = await paymentProviderApi.captureOrFinalize({
      provider: order.paymentProvider as PaymentProvider,
      providerSessionId: input.paymentSessionId,
    });
    if (verification.paymentStatus !== "paid") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Payment has not been confirmed by the provider.",
      });
    }
    paymentProviderTransactionId = verification.providerTransactionId ?? null;
  }

  const settledOrder = await settleReferralOrderPaymentBySessionId({
    paymentSessionId: input.paymentSessionId,
    paymentProviderTransactionId,
    actorType: "webhook",
    reason: "return_url_payment_verified",
  });

  return {
    ok: true as const,
    orderId: settledOrder.id,
    status: settledOrder.status,
    paymentStatus: settledOrder.paymentStatus,
    paymentSessionId: settledOrder.paymentProviderSessionId ?? null,
  };
}
