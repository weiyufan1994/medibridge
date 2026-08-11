import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import type { ReferralOrderStatus } from "../../../shared/referrals";
import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { notifyPatientReferralUpdate } from "./notifications";
import { changeOrderStatus } from "./orderTransition";
import * as referralRepo from "./repo";
import type {
  beginTimeCoordinationInputSchema,
  setConsultationTimeInputSchema,
} from "./schemas";
import { REFERRAL_INVALID_TRANSITION_ERROR } from "./stateMachine";

type BeginTimeCoordinationInput = z.infer<
  typeof beginTimeCoordinationInputSchema
>;
type SetConsultationTimeInput = z.infer<typeof setConsultationTimeInputSchema>;

async function recordPatientNotification(input: {
  orderId: number;
  detail: string;
}) {
  await referralRepo.insertOperation({
    orderId: input.orderId,
    operatorType: "system",
    actionType: "patient_notification",
    actionPayload: {
      detail: input.detail,
    },
  });
}

export async function beginTimeCoordinationAction(
  user: User | null,
  input: BeginTimeCoordinationInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  if (order.status !== "booking_in_progress") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  }

  await changeOrderStatus({
    orderId: order.id,
    toStatus: "time_coordination",
    toPaymentStatus: "paid",
    actorType: resolveActorTypeFromUser(currentUser),
    actorId: currentUser.id,
    reason: "consultation_time_coordination_started",
  });
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "time_coordination_started",
    actionPayload: {
      note: input.note,
    },
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}

export async function setConsultationTimeAction(
  user: User | null,
  input: SetConsultationTimeInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }

  const currentStatus = order.status as ReferralOrderStatus;
  if (currentStatus !== "time_coordination" && currentStatus !== "scheduled") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  }

  const arrangementUpdate = {
    consultationTime: input.consultationTime,
    consultationTimeZone: input.timeZone,
    consultationProviderName: input.providerName,
    consultationPlatform: input.platform,
    consultationJoinUrl: input.joinUrl,
    consultationInstructions: input.instructions,
  };

  if (currentStatus === "time_coordination") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "scheduled",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: "consultation_time_confirmed",
      update: arrangementUpdate,
    });
    await referralRepo.insertOperation({
      orderId: order.id,
      operatorType: resolveActorTypeFromUser(currentUser),
      operatorId: currentUser.id,
      actionType: "consultation_time_confirmed",
      actionPayload: {
        consultationTime: input.consultationTime.toISOString(),
        timeZone: input.timeZone,
        providerName: input.providerName,
        platform: input.platform,
        joinUrl: input.joinUrl,
        instructions: input.instructions,
        note: input.note ?? null,
      },
    });
  } else {
    await referralRepo.updateReferralOrderById({
      orderId: order.id,
      update: arrangementUpdate,
    });
    await referralRepo.insertOperation({
      orderId: order.id,
      operatorType: resolveActorTypeFromUser(currentUser),
      operatorId: currentUser.id,
      actionType: "consultation_time_updated",
      actionPayload: {
        consultationTime: input.consultationTime.toISOString(),
        timeZone: input.timeZone,
        providerName: input.providerName,
        platform: input.platform,
        joinUrl: input.joinUrl,
        instructions: input.instructions,
        note: input.note ?? null,
      },
    });
  }

  await recordPatientNotification({
    orderId: order.id,
    detail: "Consultation time confirmed.",
  });
  await notifyPatientReferralUpdate({
    orderId: order.id,
    event: "consultation_time_confirmed",
    detail: input.consultationTime.toISOString(),
    detailByLanguage: {
      zh: `线上面诊已安排：${input.consultationTime.toISOString()}（${input.timeZone}），平台：${input.platform}。请登录订单页查看加入链接和操作说明。`,
      en: `Your online consultation is scheduled for ${input.consultationTime.toISOString()} (${input.timeZone}) on ${input.platform}. Sign in to the order page for the joining link and instructions.`,
    },
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}
