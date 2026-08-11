import { TRPCError } from "@trpc/server";
import type { User } from "../../../drizzle/schema";
import { paymentProviderApi } from "../payments/publicApi";
import { getOwnedOrder, requireUser } from "./accessControl";
import { resolveReferralPaymentMode } from "./paymentMode";
import { settleReferralOrderPaymentBySessionId } from "./paymentSettlement";

export async function confirmMockPaymentAction(
  user: User | null,
  input: { orderId: number }
) {
  if (resolveReferralPaymentMode() !== "mock") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mock checkout is disabled",
    });
  }

  const currentUser = requireUser(user);
  const order = await getOwnedOrder({
    orderId: input.orderId,
    userId: currentUser.id,
  });
  if (!order.paymentProviderSessionId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Payment session is missing for referral order",
    });
  }
  if (order.paymentProvider !== "mock") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Referral order is not using mock payment",
    });
  }

  const verification = await paymentProviderApi.captureOrFinalize({
    provider: "mock",
    providerSessionId: order.paymentProviderSessionId,
  });

  const settledOrder = await settleReferralOrderPaymentBySessionId({
    paymentSessionId: order.paymentProviderSessionId,
    paymentProviderTransactionId: verification.providerTransactionId ?? null,
    actorType: "system",
    reason: "mock_payment_confirmed",
  });

  return {
    ok: true as const,
    orderId: settledOrder.id,
    status: settledOrder.status,
    paymentStatus: settledOrder.paymentStatus,
    paymentSessionId: settledOrder.paymentProviderSessionId ?? null,
  };
}
