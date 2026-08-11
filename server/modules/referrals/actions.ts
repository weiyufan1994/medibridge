import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import {
  type ReferralOrderStatus,
  type ReferralPaymentStatus,
} from "../../../shared/referrals";
import * as referralRepo from "./repo";
import { notifyPatientReferralUpdate } from "./notifications";
import { toPublicReferralContactOrNull } from "./presentation";
import {
  REFERRAL_INVALID_TRANSITION_ERROR,
  isReferralTerminalStatus,
} from "./stateMachine";
import { initiateAutomaticReferralRefund } from "./refunds";
import {
  getOwnedOrder,
  requireUser,
  resolveActorTypeFromUser,
} from "./accessControl";
import type {
  addInternalNoteInputSchema,
  assignOrderInputSchema,
  assignOrderContactInputSchema,
  beginTimeCoordinationInputSchema,
  listMineOrdersInputSchema,
  publishPatientProgressUpdateInputSchema,
  recordBookingResultInputSchema,
  recordContactAttemptInputSchema,
  referralOrderDetailOutputSchema,
  setConsultationTimeInputSchema,
  updateOrderStatusInputSchema,
} from "./schemas";
import { isPositiveInteger } from "./triageActions";
import { mapBundleToOrderSummary } from "./orderSummary";
import {
  buildOrderDisplayContext,
  toConsultationArrangement,
} from "./readPresentation";
import {
  getAdminOrderDetailAction,
  listOrdersForAdminAction,
} from "./adminReadActions";
import { changeOrderStatus } from "./orderTransition";

export {
  getSelectionContextAction,
  getTriageRecommendationsAction,
} from "./triageActions";
export { createOrderDraftAction } from "./orderDraftActions";
export { createPaymentSessionAction } from "./paymentSessionActions";
export { confirmReturnedPaymentSessionAction } from "./returnedPaymentActions";
export { confirmMockPaymentAction } from "./mockPaymentActions";
export { getAdminOrderDetailAction, listOrdersForAdminAction };
export { initiateRefundAction } from "./refundRequestActions";
export { reviewRefundAction } from "./refundReviewActions";
type ListMineOrdersInput = z.infer<typeof listMineOrdersInputSchema>;
type AssignOrderInput = z.infer<typeof assignOrderInputSchema>;
type AssignOrderContactInput = z.infer<typeof assignOrderContactInputSchema>;
type BeginTimeCoordinationInput = z.infer<
  typeof beginTimeCoordinationInputSchema
>;
type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;
type AddInternalNoteInput = z.infer<typeof addInternalNoteInputSchema>;
type PublishPatientProgressUpdateInput = z.infer<
  typeof publishPatientProgressUpdateInputSchema
>;
type RecordContactAttemptInput = z.infer<
  typeof recordContactAttemptInputSchema
>;
type RecordBookingResultInput = z.infer<typeof recordBookingResultInputSchema>;
type SetConsultationTimeInput = z.infer<typeof setConsultationTimeInputSchema>;
type ReferralOrderDetailOutput = z.infer<
  typeof referralOrderDetailOutputSchema
>;
function toPatientVisibleOperation(
  operation: Awaited<
    ReturnType<typeof referralRepo.listOperationsByOrderId>
  >[number]
) {
  const visibleActionTypes = new Set([
    "patient_notification",
    "consultation_time_confirmed",
    "consultation_time_updated",
    "refund_requested",
    "refund_completed",
  ]);

  return visibleActionTypes.has(operation.actionType)
    ? {
        id: operation.id,
        actionType: operation.actionType,
        operatorType: operation.operatorType,
        operatorId: operation.operatorId ?? null,
        actionPayload: operation.actionPayload ?? null,
        createdAt: operation.createdAt,
      }
    : null;
}

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

export async function listMineOrdersAction(
  user: User | null,
  input: ListMineOrdersInput
) {
  const currentUser = requireUser(user);
  const rows = await referralRepo.listMineReferralOrders({
    patientUserId: currentUser.id,
    limit: input.limit,
  });

  return rows.map(row => {
    const displayContext = buildOrderDisplayContext({
      order: row.order,
      hospital: row.hospital,
      department: row.department,
    });

    return {
      id: row.order.id,
      status: row.order.status,
      paymentStatus: row.order.paymentStatus,
      totalAmount: row.order.totalAmount,
      currency: row.order.currency,
      consultationTime: row.order.consultationTime ?? null,
      createdAt: row.order.createdAt,
      updatedAt: row.order.updatedAt,
      manualFulfillmentRequired: displayContext.manualFulfillmentRequired,
      hospital: displayContext.hospital,
      department: displayContext.department,
      contact: toPublicReferralContactOrNull(row.contact),
      refundStatus: row.refundRequest?.status ?? null,
    };
  });
}

export async function getOrderDetailAction(
  user: User | null,
  orderId: number
): Promise<ReferralOrderDetailOutput> {
  const currentUser = requireUser(user);
  await getOwnedOrder({ orderId, userId: currentUser.id });
  const bundle = await referralRepo.getReferralOrderBundleById(orderId);
  if (!bundle) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  const timeline = await referralRepo.listStatusEventsByOrderId(orderId);
  const operations = await referralRepo.listOperationsByOrderId(orderId);
  const refundRequest =
    await referralRepo.getLatestRefundRequestByOrderId(orderId);
  const agreementLang = bundle.order.agreementLang === "zh" ? "zh" : "en";
  const displayContext = buildOrderDisplayContext({
    order: bundle.order,
    hospital: bundle.hospital,
    department: bundle.department,
  });

  return {
    order: {
      ...mapBundleToOrderSummary(bundle),
      triageSessionId: bundle.order.triageSessionId,
      consultationTime: bundle.order.consultationTime ?? null,
      assignedAgentId: bundle.order.assignedAgentId ?? null,
      agreementAcceptedAt: bundle.order.agreementAcceptedAt,
      agreementVersion: bundle.order.agreementVersion,
      agreementLang,
      refundReason: bundle.order.refundReason ?? null,
      completedAt: bundle.order.completedAt ?? null,
      refundedAt: bundle.order.refundedAt ?? null,
    },
    triageSummary: bundle.order.caseSummarySnapshot ?? null,
    recommendationReason: displayContext.recommendationReason,
    hospital: displayContext.hospital,
    department: displayContext.department,
    contact: toPublicReferralContactOrNull(bundle.contact),
    consultationArrangement: toConsultationArrangement(bundle.order),
    timeline: timeline.map(event => ({
      id: event.id,
      fromStatus: (event.fromStatus as ReferralOrderStatus | null) ?? null,
      toStatus: event.toStatus as ReferralOrderStatus,
      actorType: event.actorType,
      actorId: event.actorId ?? null,
      reason: event.reason ?? null,
      createdAt: event.createdAt,
    })),
    operations: operations
      .map(toPatientVisibleOperation)
      .filter(
        (
          operation
        ): operation is NonNullable<
          ReturnType<typeof toPatientVisibleOperation>
        > => Boolean(operation)
      ),
    refundRequest: refundRequest
      ? {
          id: refundRequest.id,
          reasonCode: refundRequest.reasonCode,
          reasonDetail: refundRequest.reasonDetail ?? null,
          status: refundRequest.status,
          requestedBy: refundRequest.requestedBy ?? null,
          reviewedBy: refundRequest.reviewedBy ?? null,
          approvedAt: refundRequest.approvedAt ?? null,
          refundedAt: refundRequest.refundedAt ?? null,
          createdAt: refundRequest.createdAt,
          updatedAt: refundRequest.updatedAt,
        }
      : null,
  };
}

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

export async function addInternalNoteAction(
  user: User | null,
  input: AddInternalNoteInput
) {
  const currentUser = requireUser(user);
  await referralRepo.insertOperation({
    orderId: input.orderId,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "internal_note",
    actionPayload: {
      note: input.note,
    },
  });

  return getAdminOrderDetailAction(currentUser, input.orderId);
}

export async function publishPatientProgressUpdateAction(
  user: User | null,
  input: PublishPatientProgressUpdateInput
) {
  const currentUser = requireUser(user);
  await referralRepo.insertOperation({
    orderId: input.orderId,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "patient_notification",
    actionPayload: {
      detail: input.detail,
    },
  });

  await notifyPatientReferralUpdate({
    orderId: input.orderId,
    event: "patient_progress_update",
    detail: input.detail,
  });

  return getAdminOrderDetailAction(currentUser, input.orderId);
}

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

export {
  listAssignableAgentsAction,
  listReferralContactsForAdminAction,
  listReferralDepartmentsForAdminAction,
  listReferralHospitalsForAdminAction,
  updateContactActiveAction,
  updateHospitalActiveAction,
  upsertContactAction,
  upsertHospitalAction,
} from "./catalogActions";
