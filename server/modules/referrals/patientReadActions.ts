import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import type { ReferralOrderStatus } from "../../../shared/referrals";
import { getOwnedOrder, requireUser } from "./accessControl";
import { mapBundleToOrderSummary } from "./orderSummary";
import { toPublicReferralContactOrNull } from "./presentation";
import {
  buildOrderDisplayContext,
  toConsultationArrangement,
} from "./readPresentation";
import * as referralRepo from "./repo";
import type {
  listMineOrdersInputSchema,
  referralOrderDetailOutputSchema,
} from "./schemas";

type ListMineOrdersInput = z.infer<typeof listMineOrdersInputSchema>;
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
