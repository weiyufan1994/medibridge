import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { changeOrderStatus } from "./orderTransition";
import { initiateAutomaticReferralRefund } from "./refunds";
import * as referralRepo from "./repo";
import type { recordContactAttemptInputSchema } from "./schemas";

type RecordContactAttemptInput = z.infer<
  typeof recordContactAttemptInputSchema
>;

export async function recordContactAttemptAction(
  user: User | null,
  input: RecordContactAttemptInput
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
    actionType: "contact_attempt",
    actionPayload: {
      outcome: input.outcome,
      note: input.note,
    },
  });

  if (input.outcome === "connected" && order.status === "assigned") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "contacting",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: "contact_connected",
    });
  }

  if (input.outcome === "failed") {
    await initiateAutomaticReferralRefund({
      orderId: order.id,
      reasonCode: "contact_failed",
      reasonDetail: input.note,
      actor: {
        type: resolveActorTypeFromUser(currentUser),
        id: currentUser.id,
      },
    });
  }

  return getAdminOrderDetailAction(currentUser, order.id);
}
