import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import {
  REFERRAL_SERVICE_AGREEMENT_VERSION,
  REFERRAL_SERVICE_AMOUNT,
  REFERRAL_SERVICE_CURRENCY,
} from "../../../shared/referrals";
import { requireFormalUser } from "./accessControl";
import { mapOrderToSummary } from "./orderSummary";
import * as referralRepo from "./repo";
import type { createOrderDraftInputSchema } from "./schemas";
import {
  resolveLocalDepartmentForRankedHospital,
  resolveLocalHospitalForRankedHospital,
  resolveRankedHospitalSelection,
} from "./triageActions";

type CreateOrderDraftInput = z.infer<typeof createOrderDraftInputSchema>;

export async function createOrderDraftAction(
  user: User | null,
  input: CreateOrderDraftInput
) {
  const currentUser = requireFormalUser(user);
  if (input.agreementVersion !== REFERRAL_SERVICE_AGREEMENT_VERSION) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported agreement version",
    });
  }

  const existingOrder = await referralRepo.getReferralOrderByClientRequest({
    patientUserId: currentUser.id,
    clientRequestId: input.clientRequestId,
  });
  if (existingOrder) {
    return mapOrderToSummary(existingOrder);
  }

  const { session, triageResult, selectedHospital } =
    await resolveRankedHospitalSelection({
      triageSessionId: input.triageSessionId,
      userId: currentUser.id,
      rankedHospitalIndex: input.rankedHospitalIndex,
      hospitalId: input.hospitalId,
    });
  const localHospital =
    await resolveLocalHospitalForRankedHospital(selectedHospital);
  const mappedDepartment = await resolveLocalDepartmentForRankedHospital({
    localHospitalId: localHospital?.id ?? null,
    rankedHospital: selectedHospital,
    triageResult,
  });
  const department =
    mappedDepartment &&
    mappedDepartment.isActive === 1 &&
    (!localHospital || mappedDepartment.hospitalId === localHospital.id)
      ? mappedDepartment
      : null;
  const contact =
    typeof input.contactId === "number" && input.contactId > 0
      ? await referralRepo.getContactById(input.contactId)
      : null;
  if (
    typeof input.contactId === "number" &&
    (!contact ||
      !localHospital ||
      contact.isActive !== 1 ||
      contact.hospitalId !== localHospital.id ||
      !department ||
      contact.departmentId !== department.id)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selected contact is invalid",
    });
  }

  const activeContacts =
    localHospital && department
      ? contact
        ? [contact]
        : await referralRepo.listActiveContactsByHospital({
            hospitalId: localHospital.id,
            departmentId: department.id,
          })
      : [];
  if (!contact && activeContacts.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selected contact is required",
    });
  }
  const recommendedDepartment =
    triageResult?.routing?.recommendedDepartment ?? null;
  const manualFulfillmentRequired =
    !localHospital || !department || activeContacts.length === 0;

  const orderId = await referralRepo.createReferralOrder({
    values: {
      patientUserId: currentUser.id,
      triageSessionId: session.id,
      clientRequestId: input.clientRequestId,
      hospitalId: localHospital?.id ?? null,
      departmentId: department?.id ?? null,
      contactId: contact?.id ?? null,
      status: "pending_payment",
      paymentStatus: "unpaid",
      totalAmount: REFERRAL_SERVICE_AMOUNT,
      currency: REFERRAL_SERVICE_CURRENCY,
      recommendedHospitalName: selectedHospital.hospitalName,
      recommendedDepartmentName: recommendedDepartment?.zh ?? null,
      recommendedDepartmentNameEn: recommendedDepartment?.en ?? null,
      recommendationReason: selectedHospital.reason,
      manualFulfillmentRequired: manualFulfillmentRequired ? 1 : 0,
      caseSummarySnapshot: session.summary ?? null,
      agreementAcceptedAt: new Date(),
      agreementVersion: input.agreementVersion,
      agreementLang: input.agreementLang,
    },
  });

  if (!orderId) {
    const racedOrder = await referralRepo.getReferralOrderByClientRequest({
      patientUserId: currentUser.id,
      clientRequestId: input.clientRequestId,
    });
    if (racedOrder) {
      return mapOrderToSummary(racedOrder);
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create referral order",
    });
  }

  await referralRepo.insertStatusEvent({
    orderId,
    fromStatus: null,
    toStatus: "pending_payment",
    actorType: "patient",
    actorId: currentUser.id,
    reason: "order_draft_created",
  });
  await referralRepo.insertOperation({
    orderId,
    operatorType: "patient",
    operatorId: currentUser.id,
    actionType: "service_agreement_accepted",
    actionPayload: {
      agreementVersion: input.agreementVersion,
      agreementLang: input.agreementLang,
    },
  });
  if (manualFulfillmentRequired) {
    await referralRepo.insertOperation({
      orderId,
      operatorType: "system",
      actionType: "manual_fulfillment_required",
      actionPayload: {
        recommendedHospitalName: selectedHospital.hospitalName,
        recommendedDepartmentName: recommendedDepartment?.zh ?? null,
        recommendationReason: selectedHospital.reason,
        missingLocalHospital: !localHospital,
        missingLocalDepartment: !department,
        missingActiveContact: activeContacts.length === 0,
      },
    });
  }

  const order = await referralRepo.getReferralOrderById(orderId);
  if (!order) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Referral order disappeared after creation",
    });
  }

  return mapOrderToSummary(order);
}
