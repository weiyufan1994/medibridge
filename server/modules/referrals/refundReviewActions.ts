import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { notifyPatientReferralUpdate } from "./notifications";
import { changeOrderStatus } from "./orderTransition";
import { processReferralRefund } from "./refunds";
import * as referralRepo from "./repo";
import type { reviewRefundInputSchema } from "./schemas";

type ReviewRefundInput = z.infer<typeof reviewRefundInputSchema>;

function deriveRefundResumeStatus(
  order: Awaited<ReturnType<typeof referralRepo.getReferralOrderById>>
) {
  if (!order) {
    return "paid_pending_assignment" as const;
  }
  if (order.consultationTime) {
    return "scheduled" as const;
  }
  if (order.assignedAgentId) {
    return "assigned" as const;
  }
  return "paid_pending_assignment" as const;
}

async function recordRefundProcessingNotification(orderId: number) {
  await referralRepo.insertOperation({
    orderId,
    operatorType: "system",
    actionType: "patient_notification",
    actionPayload: {
      detail: "Your full refund is being processed.",
    },
  });
}

export async function reviewRefundAction(
  user: User | null,
  input: ReviewRefundInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  const refundRequest = await referralRepo.getLatestRefundRequestByOrderId(
    order.id
  );
  if (!refundRequest || refundRequest.id !== input.refundRequestId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Refund request not found",
    });
  }
  if (refundRequest.status === "refunded") {
    return getAdminOrderDetailAction(currentUser, order.id);
  }

  if (!input.approve) {
    await referralRepo.updateRefundRequestById({
      refundRequestId: refundRequest.id,
      update: {
        status: "rejected",
        reviewedBy: currentUser.id,
      },
    });
    await changeOrderStatus({
      orderId: order.id,
      toStatus: deriveRefundResumeStatus(order),
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: input.note?.trim() || "refund_rejected",
      update: {
        refundReason: null,
      },
    });
    await referralRepo.insertOperation({
      orderId: order.id,
      operatorType: resolveActorTypeFromUser(currentUser),
      operatorId: currentUser.id,
      actionType: "refund_rejected",
      actionPayload: {
        note: input.note ?? null,
      },
    });
    return getAdminOrderDetailAction(currentUser, order.id);
  }

  await referralRepo.updateRefundRequestById({
    refundRequestId: refundRequest.id,
    update: {
      status: "approved",
      reviewedBy: currentUser.id,
      approvedAt: new Date(),
    },
  });
  if (order.status !== "refund_processing") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "refund_processing",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: input.note?.trim() || "refund_approved",
    });
  }
  await referralRepo.updateRefundRequestById({
    refundRequestId: refundRequest.id,
    update: {
      status: "processing",
    },
  });
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "refund_approved",
    actionPayload: {
      note: input.note ?? null,
    },
  });
  await recordRefundProcessingNotification(order.id);
  await notifyPatientReferralUpdate({
    orderId: order.id,
    event: "refund_processing",
    detail: "Your full refund is being processed.",
  });
  await processReferralRefund({
    orderId: order.id,
    actor: {
      type: resolveActorTypeFromUser(currentUser),
      id: currentUser.id,
    },
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}
