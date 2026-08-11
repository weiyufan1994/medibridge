import { TRPCError } from "@trpc/server";
import type {
  ReferralActorType,
  ReferralOrderStatus,
  ReferralPaymentStatus,
} from "../../../shared/referrals";
import * as referralRepo from "./repo";
import {
  REFERRAL_INVALID_TRANSITION_ERROR,
  isReferralTerminalStatus,
} from "./stateMachine";

export async function changeOrderStatus(input: {
  orderId: number;
  toStatus: ReferralOrderStatus;
  toPaymentStatus: ReferralPaymentStatus;
  actorType: ReferralActorType;
  actorId?: number | null;
  reason: string;
  update?: Record<string, unknown>;
}) {
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  if (isReferralTerminalStatus(order.status as ReferralOrderStatus)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Terminal referral orders cannot re-enter fulfillment.",
    });
  }

  const transitioned = await referralRepo.tryTransitionOrderById({
    orderId: order.id,
    allowedFrom: [order.status as ReferralOrderStatus],
    toStatus: input.toStatus,
    toPaymentStatus: input.toPaymentStatus,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    reason: input.reason,
    update: input.update,
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  }
}
