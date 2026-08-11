import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import {
  type ReferralOrderStatus,
  type ReferralPaymentStatus,
} from "../../../shared/referrals";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { changeOrderStatus } from "./orderTransition";
import * as referralRepo from "./repo";
import type { updateOrderStatusInputSchema } from "./schemas";

type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

function derivePaymentStatusForManualStatusChange(input: {
  currentPaymentStatus: ReferralPaymentStatus;
  toStatus: ReferralOrderStatus;
}) {
  if (input.toStatus === "refunded") {
    return "refunded" as const;
  }
  if (
    input.toStatus === "refund_pending_review" ||
    input.toStatus === "refund_processing"
  ) {
    return "paid" as const;
  }
  if (input.toStatus === "cancelled") {
    if (
      input.currentPaymentStatus === "unpaid" ||
      input.currentPaymentStatus === "failed"
    ) {
      return "cancelled" as const;
    }
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Use the refund flow for paid referral orders.",
    });
  }
  if (input.toStatus === "pending_payment") {
    return input.currentPaymentStatus === "pending" ? "pending" : "unpaid";
  }
  return "paid" as const;
}

export async function updateOrderStatusAction(
  user: User | null,
  input: UpdateOrderStatusInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  if (
    [
      "paid_pending_assignment",
      "time_coordination",
      "scheduled",
      "refund_pending_review",
      "refund_processing",
      "refunded",
    ].includes(input.toStatus)
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "This referral status requires its dedicated payment, coordination, or refund action.",
    });
  }

  const toPaymentStatus = derivePaymentStatusForManualStatusChange({
    currentPaymentStatus: order.paymentStatus as ReferralPaymentStatus,
    toStatus: input.toStatus,
  });
  await changeOrderStatus({
    orderId: order.id,
    toStatus: input.toStatus,
    toPaymentStatus,
    actorType: resolveActorTypeFromUser(currentUser),
    actorId: currentUser.id,
    reason: input.reason,
    update:
      input.toStatus === "completed" ? { completedAt: new Date() } : undefined,
  });
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "status_updated",
    actionPayload: {
      toStatus: input.toStatus,
      reason: input.reason,
    },
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}
