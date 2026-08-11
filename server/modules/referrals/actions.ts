import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import type { ReferralOrderStatus } from "../../../shared/referrals";
import * as referralRepo from "./repo";
import { notifyPatientReferralUpdate } from "./notifications";
import { toPublicReferralContactOrNull } from "./presentation";
import {
  getOwnedOrder,
  requireUser,
  resolveActorTypeFromUser,
} from "./accessControl";
import type {
  addInternalNoteInputSchema,
  listMineOrdersInputSchema,
  publishPatientProgressUpdateInputSchema,
  referralOrderDetailOutputSchema,
} from "./schemas";
import { mapBundleToOrderSummary } from "./orderSummary";
import {
  buildOrderDisplayContext,
  toConsultationArrangement,
} from "./readPresentation";
import {
  getAdminOrderDetailAction,
  listOrdersForAdminAction,
} from "./adminReadActions";

export {
  getSelectionContextAction,
  getTriageRecommendationsAction,
} from "./triageActions";
export { createOrderDraftAction } from "./orderDraftActions";
export { createPaymentSessionAction } from "./paymentSessionActions";
export { confirmReturnedPaymentSessionAction } from "./returnedPaymentActions";
export { confirmMockPaymentAction } from "./mockPaymentActions";
export { getAdminOrderDetailAction, listOrdersForAdminAction };
export {
  assignOrderAction,
  assignOrderContactAction,
  claimOrderAction,
} from "./assignmentActions";
export { recordBookingResultAction } from "./bookingResultActions";
export { recordContactAttemptAction } from "./contactAttemptActions";
export { initiateRefundAction } from "./refundRequestActions";
export { reviewRefundAction } from "./refundReviewActions";
export { updateOrderStatusAction } from "./manualStatusActions";
export {
  beginTimeCoordinationAction,
  setConsultationTimeAction,
} from "./schedulingActions";
type ListMineOrdersInput = z.infer<typeof listMineOrdersInputSchema>;
type AddInternalNoteInput = z.infer<typeof addInternalNoteInputSchema>;
type PublishPatientProgressUpdateInput = z.infer<
  typeof publishPatientProgressUpdateInputSchema
>;
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
