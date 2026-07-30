import {
  calculateReferralFulfillmentDeadline,
} from "./fulfillmentPolicy";
import * as referralRepo from "./repo";
import {
  notifyInternalPaidReferralOrder,
  notifyPatientReferralUpdate,
} from "./notifications";
import { toReferralDisplayHospital } from "./presentation";
import type { ReferralActorType } from "../../../shared/referrals";

export async function settleReferralPaymentTransition(input: {
  paymentSessionId: string;
  paymentProviderTransactionId?: string | null;
  actorType: ReferralActorType;
  reason: string;
  dbExecutor?: referralRepo.ReferralRepoExecutor;
}) {
  const paidAt = new Date();
  const transitioned = await referralRepo.tryMarkOrderPaidByPaymentSessionId({
    paymentSessionId: input.paymentSessionId,
    actorType: input.actorType,
    reason: input.reason,
    paidAt,
    fulfillmentDeadlineAt: calculateReferralFulfillmentDeadline(paidAt),
    paymentProviderTransactionId:
      input.paymentProviderTransactionId ?? null,
    dbExecutor: input.dbExecutor,
  });

  if (!transitioned.ok) {
    const order = await referralRepo.getReferralOrderByPaymentSessionId(
      input.paymentSessionId,
      input.dbExecutor
    );
    if (order?.paymentStatus === "paid") {
      return { orderId: order.id, alreadySettled: true };
    }
    throw new Error("REFERRAL_INVALID_STATUS_TRANSITION");
  }

  await referralRepo.insertOperation({
    orderId: transitioned.current.id,
    operatorType: input.actorType,
    actionType: "payment_success",
    actionPayload: {
      paymentSessionId: input.paymentSessionId,
      paymentProviderTransactionId:
        input.paymentProviderTransactionId ?? null,
    },
    dbExecutor: input.dbExecutor,
  });

  return {
    orderId: transitioned.current.id,
    alreadySettled: false,
  };
}

export async function publishReferralPaymentSettlement(orderId: number) {
  const bundle = await referralRepo.getReferralOrderBundleById(orderId);
  if (!bundle) {
    throw new Error("Referral order disappeared after payment settlement");
  }

  const operations = await referralRepo.listOperationsByOrderId(orderId);
  const paymentNotificationAlreadyRecorded = operations.some(operation => {
    if (
      operation.actionType !== "patient_notification" ||
      !operation.actionPayload ||
      typeof operation.actionPayload !== "object"
    ) {
      return false;
    }
    return (
      (operation.actionPayload as Record<string, unknown>).detail ===
      "Payment received. Your referral request is now waiting for internal assignment."
    );
  });
  if (!paymentNotificationAlreadyRecorded) {
    await referralRepo.insertOperation({
      orderId,
      operatorType: "system",
      actionType: "patient_notification",
      actionPayload: {
        detail:
          "Payment received. Your referral request is now waiting for internal assignment.",
      },
    });
  }
  await notifyPatientReferralUpdate({
    orderId,
    event: "payment_success",
    detail: "Payment received.",
  });

  const hospital = toReferralDisplayHospital({
    hospital: bundle.hospital,
    snapshotHospitalName:
      bundle.order.recommendedHospitalName ?? bundle.hospital?.name ?? "",
    snapshotCity: bundle.hospital?.city ?? null,
  });
  await notifyInternalPaidReferralOrder({
    orderId,
    hospitalName: hospital.name.zh || hospital.name.en,
    contactName: bundle.contact?.name ?? null,
    manualFulfillmentRequired:
      bundle.order.manualFulfillmentRequired === 1,
  });

  return bundle.order;
}
