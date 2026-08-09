import {
  paymentProviderApi,
  type PaymentProvider,
} from "../payments/publicApi";
import {
  type ReferralActorType,
  type ReferralRefundReasonCode,
} from "../../../shared/referrals";
import * as referralRepo from "./repo";
import {
  notifyInternalActionRequired,
  notifyPatientReferralUpdate,
} from "./notifications";

export type AutomaticReferralRefundReason = Extract<
  ReferralRefundReasonCode,
  "contact_failed" | "booking_failed" | "sla_expired"
>;

type RefundActor = {
  type: ReferralActorType;
  id: number | null;
};

async function transitionToRefundProcessing(input: {
  orderId: number;
  actor: RefundActor;
  reason: string;
}) {
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new Error("Referral order not found");
  }
  if (order.status === "refund_processing" || order.status === "refunded") {
    return order;
  }

  const transitioned = await referralRepo.tryTransitionOrderById({
    orderId: order.id,
    allowedFrom: ["refund_pending_review"],
    toStatus: "refund_processing",
    toPaymentStatus: "paid",
    actorType: input.actor.type,
    actorId: input.actor.id,
    reason: input.reason,
  });
  if (!transitioned.ok) {
    throw new Error("REFERRAL_INVALID_STATUS_TRANSITION");
  }

  return referralRepo.getReferralOrderById(order.id);
}

export async function finalizeReferralRefund(input: {
  orderId: number;
  providerRefundId: string;
  actorType: ReferralActorType;
  reason: string;
}) {
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new Error("Referral order not found");
  }
  if (order.status === "refunded" && order.paymentStatus === "refunded") {
    return order;
  }

  const refundedAt = new Date();
  const transitioned = await referralRepo.tryTransitionOrderById({
    orderId: order.id,
    allowedFrom: ["refund_processing"],
    toStatus: "refunded",
    toPaymentStatus: "refunded",
    actorType: input.actorType,
    reason: input.reason,
    update: {
      paymentProviderRefundId: input.providerRefundId,
      refundedAt,
    },
  });
  if (!transitioned.ok) {
    throw new Error("REFERRAL_INVALID_STATUS_TRANSITION");
  }

  const refundRequest = await referralRepo.getLatestRefundRequestByOrderId(
    order.id
  );
  if (refundRequest) {
    await referralRepo.updateRefundRequestById({
      refundRequestId: refundRequest.id,
      update: {
        status: "refunded",
        refundedAt,
      },
    });
  }
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: input.actorType,
    actionType: "refund_completed",
    actionPayload: {
      providerRefundId: input.providerRefundId,
    },
  });
  await notifyPatientReferralUpdate({
    orderId: order.id,
    event: "refund_completed",
    detail: "Refund completed.",
  });

  return referralRepo.getReferralOrderById(order.id);
}

export async function processReferralRefund(input: {
  orderId: number;
  actor: RefundActor;
}) {
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new Error("Referral order not found");
  }
  if (order.status === "refunded") {
    return { status: "succeeded" as const, order };
  }
  if (!order.paymentProviderSessionId) {
    throw new Error("Payment provider session is required for refund");
  }

  try {
    const refund = await paymentProviderApi.refund({
      provider: order.paymentProvider as PaymentProvider,
      resource: {
        type: "referral_order",
        id: order.id,
      },
      providerSessionId: order.paymentProviderSessionId,
      providerTransactionId: order.paymentProviderTransactionId,
      amount: order.totalAmount,
      currency: order.currency,
      idempotencyKey: `referral-order-${order.id}-full-refund`,
    });
    await referralRepo.updateReferralOrderById({
      orderId: order.id,
      update: {
        paymentProviderRefundId: refund.providerRefundId,
      },
    });

    if (refund.status === "succeeded") {
      const refundedOrder = await finalizeReferralRefund({
        orderId: order.id,
        providerRefundId: refund.providerRefundId,
        actorType: input.actor.type,
        reason: "provider_refund_succeeded",
      });
      return { status: "succeeded" as const, order: refundedOrder };
    }

    return { status: "pending" as const, order };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Unknown refund provider error";
    await referralRepo.insertOperation({
      orderId: order.id,
      operatorType: input.actor.type,
      operatorId: input.actor.id,
      actionType: "refund_provider_failed",
      actionPayload: { error: message },
    });
    await notifyInternalActionRequired({
      orderId: order.id,
      status: "refund_processing",
      reason: message,
    });
    return { status: "failed" as const, order, error: message };
  }
}

export async function initiateAutomaticReferralRefund(input: {
  orderId: number;
  reasonCode: AutomaticReferralRefundReason;
  reasonDetail: string;
  actor: RefundActor;
}) {
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new Error("Referral order not found");
  }
  if (order.status === "refunded") {
    return { status: "succeeded" as const, order };
  }
  if (order.paymentStatus !== "paid") {
    throw new Error("Only paid referral orders can be refunded");
  }

  const existingRequest = await referralRepo.getLatestRefundRequestByOrderId(
    order.id
  );
  if (!existingRequest || existingRequest.status === "rejected") {
    const reviewTransition = await referralRepo.tryTransitionOrderById({
      orderId: order.id,
      allowedFrom: [order.status],
      toStatus: "refund_pending_review",
      toPaymentStatus: "paid",
      actorType: input.actor.type,
      actorId: input.actor.id,
      reason: `automatic_refund:${input.reasonCode}`,
      update: { refundReason: input.reasonDetail },
    });
    if (!reviewTransition.ok) {
      throw new Error("REFERRAL_INVALID_STATUS_TRANSITION");
    }

    await referralRepo.createRefundRequest({
      values: {
        orderId: order.id,
        reasonCode: input.reasonCode,
        reasonDetail: input.reasonDetail,
        status: "approved",
        requestedBy: input.actor.id,
        reviewedBy: input.actor.id,
        approvedAt: new Date(),
      },
    });
  }

  await transitionToRefundProcessing({
    orderId: order.id,
    actor: input.actor,
    reason: `automatic_refund_approved:${input.reasonCode}`,
  });
  const latestRequest = await referralRepo.getLatestRefundRequestByOrderId(
    order.id
  );
  if (latestRequest && latestRequest.status !== "processing") {
    await referralRepo.updateRefundRequestById({
      refundRequestId: latestRequest.id,
      update: { status: "processing" },
    });
  }
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: input.actor.type,
    operatorId: input.actor.id,
    actionType: "automatic_refund_started",
    actionPayload: {
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
    },
  });
  await notifyPatientReferralUpdate({
    orderId: order.id,
    event: "refund_processing",
    detail: "Your full refund is being processed.",
  });

  return processReferralRefund({
    orderId: order.id,
    actor: input.actor,
  });
}
