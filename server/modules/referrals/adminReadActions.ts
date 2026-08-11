import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import type { ReferralOrderStatus } from "../../../shared/referrals";
import { requireUser } from "./accessControl";
import { mapBundleToOrderSummary } from "./orderSummary";
import { toPublicReferralContactOrNull } from "./presentation";
import {
  buildOrderDisplayContext,
  toConsultationArrangement,
} from "./readPresentation";
import * as referralRepo from "./repo";
import type {
  adminReferralOrderDetailOutputSchema,
  listOrdersInputSchema,
} from "./schemas";

type ListOrdersInput = z.infer<typeof listOrdersInputSchema>;
type AdminReferralOrderDetailOutput = z.infer<
  typeof adminReferralOrderDetailOutputSchema
>;

export async function listOrdersForAdminAction(
  user: User | null,
  input: ListOrdersInput
) {
  const currentUser = requireUser(user);
  const rows = await referralRepo.listReferralOrdersForAdmin({
    page: input.page,
    pageSize: input.pageSize,
    status: input.status,
    hospitalId: input.hospitalId,
    assignedToUserId: input.assignedToMe ? currentUser.id : undefined,
    sortDirection: input.sortDirection,
  });

  return {
    page: rows.page,
    pageSize: rows.pageSize,
    total: rows.total,
    totalPages: rows.totalPages,
    items: rows.items.map(row => {
      const displayContext = buildOrderDisplayContext({
        order: row.order,
        hospital: row.hospital,
        department: row.department,
      });

      return {
        id: row.order.id,
        patientUserId: row.order.patientUserId,
        patientEmail: row.patient?.email?.trim().toLowerCase() ?? null,
        status: row.order.status,
        paymentStatus: row.order.paymentStatus,
        totalAmount: row.order.totalAmount,
        currency: row.order.currency,
        consultationTime: row.order.consultationTime ?? null,
        assignedAgentId: row.order.assignedAgentId ?? null,
        hospitalName: displayContext.hospital.name,
        departmentName: displayContext.department.name,
        contactName: row.contact?.name ?? null,
        manualFulfillmentRequired: displayContext.manualFulfillmentRequired,
        createdAt: row.order.createdAt,
        updatedAt: row.order.updatedAt,
        urgencyMinutes: Number(row.urgencyMinutes ?? 0),
      };
    }),
  };
}

export async function getAdminOrderDetailAction(
  user: User | null,
  orderId: number
): Promise<AdminReferralOrderDetailOutput> {
  requireUser(user);
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
  const notificationFailures =
    await referralRepo.listFailedReferralNotificationsByOrderId(orderId);
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
    patient: {
      id: bundle.order.patientUserId,
      email: bundle.patient?.email?.trim().toLowerCase() ?? null,
      role: bundle.patient?.role ?? null,
    },
    notificationFailures: notificationFailures.map(notification => ({
      id: notification.id,
      eventType: notification.eventType,
      recipientType: notification.recipientType,
      recipient: notification.recipient,
      attemptCount: notification.attemptCount,
      lastError: notification.lastError ?? null,
      updatedAt: notification.updatedAt,
    })),
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
    operations: operations.map(operation => ({
      id: operation.id,
      actionType: operation.actionType,
      operatorType: operation.operatorType,
      operatorId: operation.operatorId ?? null,
      actionPayload: operation.actionPayload ?? null,
      createdAt: operation.createdAt,
    })),
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
