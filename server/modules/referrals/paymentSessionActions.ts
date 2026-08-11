import { TRPCError } from "@trpc/server";
import type { RequestMetadata } from "@shared/requestMetadata";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import {
  getReferralPaymentActionForOrder,
  type ReferralOrderStatus,
  type ReferralPaymentStatus,
} from "../../../shared/referrals";
import { getPublicBaseUrl } from "../../_core/getPublicBaseUrl";
import { paymentProviderApi } from "../payments/publicApi";
import { getOwnedOrder, requireFormalUser } from "./accessControl";
import { resolveReferralPaymentMode } from "./paymentMode";
import * as referralRepo from "./repo";
import type { createPaymentSessionInputSchema } from "./schemas";

type CreatePaymentSessionInput = z.infer<
  typeof createPaymentSessionInputSchema
>;

function throwReferralPaymentCreationError(input: {
  status: ReferralOrderStatus;
  paymentStatus: ReferralPaymentStatus;
}) {
  if (input.paymentStatus === "paid") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This referral order has already been paid.",
    });
  }

  if (
    input.paymentStatus === "refunded" ||
    input.paymentStatus === "cancelled"
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This referral order can no longer be paid.",
    });
  }

  if (input.status !== "pending_payment") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This referral order is no longer waiting for payment.",
    });
  }

  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "This referral order is not payable right now.",
  });
}

export async function createPaymentSessionAction(input: {
  user: User | null;
  createInput: CreatePaymentSessionInput;
  requestMetadata: RequestMetadata;
}) {
  const currentUser = requireFormalUser(input.user);
  const order = await getOwnedOrder({
    orderId: input.createInput.orderId,
    userId: currentUser.id,
  });
  const paymentAction = getReferralPaymentActionForOrder({
    status: order.status as ReferralOrderStatus,
    paymentStatus: order.paymentStatus as ReferralPaymentStatus,
  });
  if (!paymentAction) {
    throwReferralPaymentCreationError({
      status: order.status as ReferralOrderStatus,
      paymentStatus: order.paymentStatus as ReferralPaymentStatus,
    });
  }

  const publicBaseUrl = getPublicBaseUrl(input.requestMetadata);
  const paymentMode = resolveReferralPaymentMode();
  const checkoutInput = {
    resource: {
      type: "referral_order" as const,
      id: order.id,
    },
    amount: order.totalAmount,
    currency: order.currency,
    successUrl: `${publicBaseUrl}/referrals/payment/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${publicBaseUrl}/referrals/payment/cancel?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    mockCheckoutUrl: `${publicBaseUrl}/referrals/mock-checkout/${order.id}`,
  };
  const checkout =
    paymentMode === "mock"
      ? await paymentProviderApi.createCheckoutSession(checkoutInput, "mock")
      : await paymentProviderApi.createCheckoutSession(checkoutInput);

  const marked = await referralRepo.markOrderPendingPayment({
    orderId: order.id,
    paymentSessionId: checkout.id,
    paymentProvider: checkout.provider,
  });
  if (!marked.ok) {
    if (marked.reason === "conflict") {
      const refreshedOrder = await referralRepo.getReferralOrderById(order.id);
      if (
        refreshedOrder &&
        getReferralPaymentActionForOrder({
          status: refreshedOrder.status as ReferralOrderStatus,
          paymentStatus: refreshedOrder.paymentStatus as ReferralPaymentStatus,
        })
      ) {
        const retried = await referralRepo.markOrderPendingPayment({
          orderId: order.id,
          paymentSessionId: checkout.id,
          paymentProvider: checkout.provider,
        });
        if (retried.ok) {
          await referralRepo.insertOperation({
            orderId: order.id,
            operatorType: "patient",
            operatorId: currentUser.id,
            actionType: "payment_session_created",
            actionPayload: {
              paymentSessionId: checkout.id,
            },
          });

          return {
            orderId: order.id,
            status: "pending_payment" as const,
            paymentStatus: "pending" as const,
            checkoutSessionUrl: checkout.url,
            paymentSessionId:
              process.env.NODE_ENV === "development" ? checkout.id : undefined,
          };
        }
      }
    }

    const latestOrder =
      marked.current?.id === order.id
        ? await referralRepo.getReferralOrderById(order.id)
        : null;
    if (latestOrder) {
      const latestPaymentAction = getReferralPaymentActionForOrder({
        status: latestOrder.status as ReferralOrderStatus,
        paymentStatus: latestOrder.paymentStatus as ReferralPaymentStatus,
      });
      if (!latestPaymentAction) {
        throwReferralPaymentCreationError({
          status: latestOrder.status as ReferralOrderStatus,
          paymentStatus: latestOrder.paymentStatus as ReferralPaymentStatus,
        });
      }
    }

    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Unable to start payment right now. Please refresh and try again.",
    });
  }

  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: "patient",
    operatorId: currentUser.id,
    actionType: "payment_session_created",
    actionPayload: {
      paymentSessionId: checkout.id,
    },
  });

  return {
    orderId: order.id,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    checkoutSessionUrl: checkout.url,
    paymentSessionId:
      process.env.NODE_ENV === "development" ? checkout.id : undefined,
  };
}
