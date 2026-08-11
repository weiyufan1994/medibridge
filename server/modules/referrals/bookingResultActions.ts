import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import type { ReferralOrderStatus } from "../../../shared/referrals";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { changeOrderStatus } from "./orderTransition";
import { initiateAutomaticReferralRefund } from "./refunds";
import * as referralRepo from "./repo";
import type { recordBookingResultInputSchema } from "./schemas";

type RecordBookingResultInput = z.infer<typeof recordBookingResultInputSchema>;

export async function recordBookingResultAction(
  user: User | null,
  input: RecordBookingResultInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }

  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "booking_result",
    actionPayload: {
      outcome: input.outcome,
      note: input.note,
    },
  });

  if (input.outcome === "progressing") {
    const currentStatus = order.status as ReferralOrderStatus;
    if (currentStatus === "contacting" || currentStatus === "assigned") {
      await changeOrderStatus({
        orderId: order.id,
        toStatus: "booking_in_progress",
        toPaymentStatus: "paid",
        actorType: resolveActorTypeFromUser(currentUser),
        actorId: currentUser.id,
        reason: "booking_progressing",
      });
    }
  }

  if (input.outcome === "failed") {
    await initiateAutomaticReferralRefund({
      orderId: order.id,
      reasonCode: "booking_failed",
      reasonDetail: input.note,
      actor: {
        type: resolveActorTypeFromUser(currentUser),
        id: currentUser.id,
      },
    });
  }

  return getAdminOrderDetailAction(currentUser, order.id);
}
