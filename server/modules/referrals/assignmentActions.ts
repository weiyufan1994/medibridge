import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import type { ReferralOrderStatus } from "../../../shared/referrals";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { changeOrderStatus } from "./orderTransition";
import * as referralRepo from "./repo";
import type {
  assignOrderContactInputSchema,
  assignOrderInputSchema,
} from "./schemas";
import { isReferralTerminalStatus } from "./stateMachine";
import { isPositiveInteger } from "./triageActions";

type AssignOrderInput = z.infer<typeof assignOrderInputSchema>;
type AssignOrderContactInput = z.infer<typeof assignOrderContactInputSchema>;

export async function claimOrderAction(
  user: User | null,
  input: { orderId: number }
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  if (order.assignedAgentId && order.assignedAgentId !== currentUser.id) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Referral order is already assigned",
    });
  }

  await referralRepo.updateReferralOrderById({
    orderId: order.id,
    update: {
      assignedAgentId: currentUser.id,
    },
  });
  if (order.status === "paid_pending_assignment") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "assigned",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: "order_claimed",
    });
  }
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "order_claimed",
    actionPayload: {
      assignedAgentId: currentUser.id,
    },
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}

export async function assignOrderAction(
  user: User | null,
  input: AssignOrderInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }

  await referralRepo.updateReferralOrderById({
    orderId: order.id,
    update: {
      assignedAgentId: input.assigneeId,
    },
  });
  if (order.status === "paid_pending_assignment") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "assigned",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: "order_assigned",
    });
  }
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "order_assigned",
    actionPayload: {
      assigneeId: input.assigneeId,
    },
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}

export async function assignOrderContactAction(
  user: User | null,
  input: AssignOrderContactInput
) {
  const currentUser = requireUser(user);
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
      message: "Terminal referral orders cannot be modified.",
    });
  }
  if (!isPositiveInteger(order.hospitalId)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "This order has no local hospital mapping yet.",
    });
  }

  const contact = await referralRepo.getContactById(input.contactId);
  if (
    !contact ||
    contact.isActive !== 1 ||
    contact.hospitalId !== order.hospitalId
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selected contact is invalid",
    });
  }

  await referralRepo.updateReferralOrderById({
    orderId: order.id,
    update: {
      departmentId: contact.departmentId,
      contactId: contact.id,
      manualFulfillmentRequired: 0,
    },
  });
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "contact_assigned",
    actionPayload: {
      contactId: contact.id,
      contactName: contact.name,
    },
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}
