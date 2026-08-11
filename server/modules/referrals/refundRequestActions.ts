import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import {
  notifyInternalActionRequired,
  notifyPatientReferralUpdate,
} from "./notifications";
import { changeOrderStatus } from "./orderTransition";
import * as referralRepo from "./repo";
import type { initiateRefundInputSchema } from "./schemas";

type InitiateRefundInput = z.infer<typeof initiateRefundInputSchema>;

async function recordRefundReviewNotification(orderId: number) {
  await referralRepo.insertOperation({
    orderId,
    operatorType: "system",
    actionType: "patient_notification",
    actionPayload: {
      detail: "Refund review initiated.",
    },
  });
}

export async function initiateRefundAction(
  user: User | null,
  input: InitiateRefundInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  if (order.paymentStatus !== "paid") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Only paid referral orders can enter refund review.",
    });
  }

  const latestRefund = await referralRepo.getLatestRefundRequestByOrderId(
    order.id
  );
  if (
    latestRefund &&
    latestRefund.status !== "refunded" &&
    latestRefund.status !== "rejected"
  ) {
    return getAdminOrderDetailAction(currentUser, order.id);
  }

  if (order.status !== "refund_pending_review") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "refund_pending_review",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: `refund_requested:${input.reasonCode}`,
      update: {
        refundReason: input.reasonDetail,
      },
    });
  }

  const refundRequestId = await referralRepo.createRefundRequest({
    values: {
      orderId: order.id,
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
      status: "pending_review",
      requestedBy: currentUser.id,
    },
  });

  if (!refundRequestId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create refund request",
    });
  }

  const actorType = resolveActorTypeFromUser(currentUser);
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: actorType,
    operatorId: currentUser.id,
    actionType: "refund_requested",
    actionPayload: {
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
    },
  });
  await recordRefundReviewNotification(order.id);
  await notifyPatientReferralUpdate({
    orderId: order.id,
    event: "refund_initiated",
    detail: input.reasonCode,
  });
  await notifyInternalActionRequired({
    orderId: order.id,
    status: "refund_pending_review",
    reason: input.reasonDetail,
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}
