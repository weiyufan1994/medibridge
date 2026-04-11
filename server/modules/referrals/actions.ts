import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { z } from "zod";
import type { User } from "../../../drizzle/schema";
import * as adminRepo from "../admin/repo";
import * as aiRepo from "../ai/repo";
import {
  TRIAGE_RESULT_FLAG_TYPE,
  parseStoredHistoricalTriageResult,
  rebuildHistoricalTriageResultFromSummary,
} from "../ai/historyResult";
import { getPublicBaseUrl } from "../../_core/getPublicBaseUrl";
import {
  createPaymentCheckoutSession,
  resolvePaymentAdapter,
} from "../payments/providerManager";
import {
  REFERRAL_SERVICE_AGREEMENT_VERSION,
  REFERRAL_SERVICE_AMOUNT,
  REFERRAL_SERVICE_CURRENCY,
  type ReferralActorType,
  type ReferralOrderStatus,
  type ReferralPaymentStatus,
} from "../../../shared/referrals";
import * as referralRepo from "./repo";
import {
  notifyInternalActionRequired,
  notifyInternalPaidReferralOrder,
  notifyPatientReferralUpdate,
} from "./notifications";
import {
  toPublicReferralContact,
  toPublicReferralContactOrNull,
  toReferralDisplayDepartment,
  toReferralDisplayHospital,
  toPublicReferralDepartment,
  toPublicReferralHospital,
} from "./presentation";
import {
  REFERRAL_INVALID_TRANSITION_ERROR,
  isReferralTerminalStatus,
} from "./stateMachine";
import type {
  createOrderDraftInputSchema,
  addInternalNoteInputSchema,
  adminReferralOrderDetailOutputSchema,
  assignOrderInputSchema,
  assignOrderContactInputSchema,
  createPaymentSessionInputSchema,
  getSelectionContextInputSchema,
  getTriageRecommendationsInputSchema,
  initiateRefundInputSchema,
  listMineOrdersInputSchema,
  listOrdersInputSchema,
  recordBookingResultInputSchema,
  recordContactAttemptInputSchema,
  referralOrderDetailOutputSchema,
  reviewRefundInputSchema,
  setConsultationTimeInputSchema,
  updateOrderStatusInputSchema,
  upsertContactInputSchema,
  upsertHospitalInputSchema,
} from "./schemas";

type CurrentUser = User;
type TriageRecommendationsInput = z.infer<typeof getTriageRecommendationsInputSchema>;
type SelectionContextInput = z.infer<typeof getSelectionContextInputSchema>;
type CreateOrderDraftInput = z.infer<typeof createOrderDraftInputSchema>;
type CreatePaymentSessionInput = z.infer<typeof createPaymentSessionInputSchema>;
type ListMineOrdersInput = z.infer<typeof listMineOrdersInputSchema>;
type ListOrdersInput = z.infer<typeof listOrdersInputSchema>;
type AssignOrderInput = z.infer<typeof assignOrderInputSchema>;
type AssignOrderContactInput = z.infer<typeof assignOrderContactInputSchema>;
type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;
type AddInternalNoteInput = z.infer<typeof addInternalNoteInputSchema>;
type RecordContactAttemptInput = z.infer<typeof recordContactAttemptInputSchema>;
type RecordBookingResultInput = z.infer<typeof recordBookingResultInputSchema>;
type SetConsultationTimeInput = z.infer<typeof setConsultationTimeInputSchema>;
type InitiateRefundInput = z.infer<typeof initiateRefundInputSchema>;
type ReviewRefundInput = z.infer<typeof reviewRefundInputSchema>;
type UpsertHospitalInput = z.infer<typeof upsertHospitalInputSchema>;
type UpsertContactInput = z.infer<typeof upsertContactInputSchema>;
type ReferralOrderDetailOutput = z.infer<
  typeof referralOrderDetailOutputSchema
>;
type AdminReferralOrderDetailOutput = z.infer<
  typeof adminReferralOrderDetailOutputSchema
>;

type OwnedTriageRecommendation = Awaited<
  ReturnType<typeof getOwnedTriageRecommendation>
>;
type RankedHospitalRecommendation = NonNullable<
  NonNullable<OwnedTriageRecommendation["triageResult"]>["routing"]
>["hospitals"][number];
type NullableLocalHospital = Awaited<ReturnType<typeof referralRepo.getHospitalById>> | null;
type NullableLocalDepartment =
  | Awaited<ReturnType<typeof referralRepo.getDepartmentById>>
  | null;

function requireUser(user: User | null): CurrentUser {
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    });
  }

  return user;
}

function resolveActorTypeFromUser(user: User): ReferralActorType {
  return user.role === "ops" ? "ops" : "admin";
}

async function getOwnedTriageRecommendation(input: {
  triageSessionId: number;
  userId: number;
}) {
  const session = await aiRepo.getAiChatSessionById(input.triageSessionId);
  if (!session || session.userId !== input.userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Triage session not found",
    });
  }

  const storedResultFlag = await aiRepo.getLatestSessionFlagByType(
    input.triageSessionId,
    TRIAGE_RESULT_FLAG_TYPE
  );
  const storedResult = parseStoredHistoricalTriageResult(
    storedResultFlag?.flagValue
  );
  const triageResult =
    storedResult ??
    (await rebuildHistoricalTriageResultFromSummary(session.summary));

  return {
    session,
    triageResult,
  };
}

async function getOwnedOrder(input: {
  orderId: number;
  userId: number;
}) {
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order || !referralRepo.isOrderOwnedByUser(order, input.userId)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Referral order not found",
    });
  }

  return order;
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）[\]【】{}<>《》.,，。:：;；'"`‘’“”·•\-_/\\|]/g, "");
}

function isPositiveInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function matchesDepartmentLabel(input: {
  departmentName: string;
  candidates: Array<string | null | undefined>;
}) {
  const normalizedDepartmentName = normalizeLookupText(input.departmentName);
  if (!normalizedDepartmentName) {
    return false;
  }

  return input.candidates.some(candidate => {
    const normalizedCandidate = normalizeLookupText(candidate);
    return (
      normalizedCandidate.length > 0 &&
      (normalizedDepartmentName.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedDepartmentName))
    );
  });
}

async function resolveRankedHospitalSelection(input: {
  triageSessionId: number;
  userId: number;
  rankedHospitalIndex?: number;
  hospitalId?: number;
}) {
  const owned = await getOwnedTriageRecommendation({
    triageSessionId: input.triageSessionId,
    userId: input.userId,
  });
  const rankedHospitals = owned.triageResult?.routing?.hospitals ?? [];

  const selectedByIndex =
    typeof input.rankedHospitalIndex === "number"
      ? rankedHospitals[input.rankedHospitalIndex] ?? null
      : null;
  const selectedHospital =
    selectedByIndex ??
    (isPositiveInteger(input.hospitalId)
      ? rankedHospitals.find(
          hospital => hospital.matchedHospitalId === input.hospitalId
        ) ?? null
      : null);

  if (!selectedHospital) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Ranked hospital not found",
    });
  }

  return {
    ...owned,
    selectedHospital,
  };
}

async function resolveLocalHospitalForRankedHospital(
  rankedHospital: RankedHospitalRecommendation
) {
  const matchedHospitalId = rankedHospital.matchedHospitalId;
  if (isPositiveInteger(matchedHospitalId)) {
    const hospitalId = matchedHospitalId as number;
    const matchedHospital = await referralRepo.getHospitalById(hospitalId);
    if (matchedHospital && matchedHospital.isActive === 1) {
      return matchedHospital;
    }
  }

  const normalizedTargetName = normalizeLookupText(rankedHospital.hospitalName);
  if (!normalizedTargetName) {
    return null;
  }

  const hospitals = await referralRepo.listHospitalsForReferralCatalog();
  return (
    hospitals.find(
      hospital =>
        hospital.isActive === 1 &&
        [
          normalizeLookupText(hospital.name),
          normalizeLookupText(hospital.nameEn),
        ].includes(normalizedTargetName)
    ) ?? null
  );
}

async function resolveLocalDepartmentForRankedHospital(input: {
  localHospitalId: number | null;
  rankedHospital: RankedHospitalRecommendation;
  triageResult: OwnedTriageRecommendation["triageResult"];
}) {
  const localHospitalId = input.localHospitalId;
  if (!isPositiveInteger(localHospitalId)) {
    return null;
  }

  const matchedDepartmentId = input.rankedHospital.matchedDepartmentId;
  if (isPositiveInteger(matchedDepartmentId)) {
    const departmentId = matchedDepartmentId as number;
    const matchedDepartment = await referralRepo.getDepartmentById(
      departmentId
    );
    if (
      matchedDepartment &&
      matchedDepartment.isActive === 1 &&
      matchedDepartment.hospitalId === localHospitalId
    ) {
      return matchedDepartment;
    }
  }

  const hospitalId = localHospitalId as number;
  const departments = await referralRepo.listDepartmentsByHospitalId(hospitalId);
  const activeDepartments = departments.filter(department => department.isActive === 1);
  const recommendedDepartment = input.triageResult?.routing?.recommendedDepartment;

  return (
    activeDepartments.find(department =>
      matchesDepartmentLabel({
        departmentName: department.name,
        candidates: [recommendedDepartment?.zh, recommendedDepartment?.en],
      })
    ) ?? null
  );
}

function buildOrderDisplayContext(input: {
  order: {
    recommendedHospitalName: string | null;
    recommendedDepartmentName: string | null;
    recommendedDepartmentNameEn: string | null;
    recommendationReason: string | null;
    manualFulfillmentRequired: number;
  };
  hospital: NullableLocalHospital;
  department: NullableLocalDepartment;
}) {
  return {
    manualFulfillmentRequired: input.order.manualFulfillmentRequired === 1,
    recommendationReason: input.order.recommendationReason ?? null,
    hospital: toReferralDisplayHospital({
      hospital: input.hospital,
      snapshotHospitalName:
        input.order.recommendedHospitalName ?? input.hospital?.name ?? "",
      snapshotCity: input.hospital?.city ?? null,
    }),
    department: toReferralDisplayDepartment({
      department: input.department,
      snapshotDepartmentName:
        input.order.recommendedDepartmentName ?? input.department?.name ?? "",
      snapshotDepartmentNameEn:
        input.order.recommendedDepartmentNameEn ?? input.department?.nameEn ?? "",
    }),
  };
}

function mapBundleToOrderSummary(bundle: NonNullable<
  Awaited<ReturnType<typeof referralRepo.getReferralOrderBundleById>>
>) {
  return {
    id: bundle.order.id,
    status: bundle.order.status,
    paymentStatus: bundle.order.paymentStatus,
    manualFulfillmentRequired: bundle.order.manualFulfillmentRequired === 1,
    totalAmount: bundle.order.totalAmount,
    currency: bundle.order.currency,
    createdAt: bundle.order.createdAt,
    updatedAt: bundle.order.updatedAt,
    paidAt: bundle.order.paidAt ?? null,
  };
}

function toPatientVisibleOperation(operation: Awaited<
  ReturnType<typeof referralRepo.listOperationsByOrderId>
>[number]) {
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
  if (input.toStatus === "refund_pending_review" || input.toStatus === "refund_processing") {
    return "paid" as const;
  }
  if (input.toStatus === "cancelled") {
    if (input.currentPaymentStatus === "unpaid" || input.currentPaymentStatus === "failed") {
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

async function settleReferralOrderPaymentBySessionId(input: {
  paymentSessionId: string;
  actorType: ReferralActorType;
  reason: string;
}) {
  const transitioned = await referralRepo.tryMarkOrderPaidByPaymentSessionId({
    paymentSessionId: input.paymentSessionId,
    actorType: input.actorType,
    reason: input.reason,
  });

  if (!transitioned.ok) {
    const order = await referralRepo.getReferralOrderByPaymentSessionId(
      input.paymentSessionId
    );

    if (!order) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Referral order not found for payment session",
      });
    }

    if (order.paymentStatus === "paid") {
      return order;
    }

    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  }

  const bundle = await referralRepo.getReferralOrderBundleById(transitioned.current.id);
  if (!bundle) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Referral order disappeared after payment settlement",
    });
  }

  await referralRepo.insertOperation({
    orderId: bundle.order.id,
    operatorType: "system",
    actionType: "payment_success",
    actionPayload: {
      paymentSessionId: input.paymentSessionId,
    },
  });

  await recordPatientNotification({
    orderId: bundle.order.id,
    detail: "Payment received. Your referral request is now waiting for internal assignment.",
  });

  await notifyPatientReferralUpdate({
    orderId: bundle.order.id,
    event: "payment_success",
    detail: "Payment received",
  });
  const displayContext = buildOrderDisplayContext({
    order: bundle.order,
    hospital: bundle.hospital,
    department: bundle.department,
  });
  await notifyInternalPaidReferralOrder({
    orderId: bundle.order.id,
    hospitalName: displayContext.hospital.name.zh || displayContext.hospital.name.en,
    contactName: bundle.contact?.name ?? null,
    manualFulfillmentRequired: displayContext.manualFulfillmentRequired,
  });

  return bundle.order;
}

async function changeOrderStatus(input: {
  orderId: number;
  toStatus: ReferralOrderStatus;
  toPaymentStatus: ReferralPaymentStatus;
  actorType: ReferralActorType;
  actorId?: number | null;
  reason: string;
  update?: Record<string, unknown>;
}) {
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
      message: "Terminal referral orders cannot re-enter fulfillment.",
    });
  }

  const transitioned = await referralRepo.tryTransitionOrderById({
    orderId: order.id,
    allowedFrom: [order.status as ReferralOrderStatus],
    toStatus: input.toStatus,
    toPaymentStatus: input.toPaymentStatus,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    reason: input.reason,
    update: input.update,
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  }
}

export async function getTriageRecommendationsAction(
  user: User | null,
  input: TriageRecommendationsInput
) {
  const currentUser = requireUser(user);
  const { session, triageResult } = await getOwnedTriageRecommendation({
    triageSessionId: input.triageSessionId,
    userId: currentUser.id,
  });

  return {
    triageSessionId: session.id,
    summary: session.summary ?? null,
    recommendedDepartment: triageResult?.routing
      ? triageResult.routing.recommendedDepartment
      : null,
    hospitals: triageResult?.routing?.hospitals ?? [],
  };
}

export async function getSelectionContextAction(
  user: User | null,
  input: SelectionContextInput
) {
  const currentUser = requireUser(user);
  const { session, triageResult, selectedHospital } =
    await resolveRankedHospitalSelection({
      triageSessionId: input.triageSessionId,
      userId: currentUser.id,
      rankedHospitalIndex: input.rankedHospitalIndex,
      hospitalId: input.hospitalId,
    });
  const localHospital = await resolveLocalHospitalForRankedHospital(selectedHospital);
  const localDepartment = await resolveLocalDepartmentForRankedHospital({
    localHospitalId: localHospital?.id ?? null,
    rankedHospital: selectedHospital,
    triageResult,
  });
  const contacts = localHospital
    ? await referralRepo.listActiveContactsByHospital({
        hospitalId: localHospital.id,
        departmentId: localDepartment?.id ?? null,
      })
    : [];
  const recommendedDepartment = triageResult?.routing?.recommendedDepartment ?? null;
  const manualFulfillmentRequired =
    !localHospital || !localDepartment || contacts.length === 0;

  return {
    triageSessionId: session.id,
    triageSummary: session.summary ?? null,
    recommendationReason: selectedHospital.reason,
    manualFulfillmentRequired,
    hospital: toReferralDisplayHospital({
      hospital: localHospital,
      snapshotHospitalName: selectedHospital.hospitalName,
      snapshotCity: selectedHospital.city,
    }),
    department: toReferralDisplayDepartment({
      department: localDepartment,
      snapshotDepartmentName: recommendedDepartment?.zh ?? null,
      snapshotDepartmentNameEn: recommendedDepartment?.en ?? null,
    }),
    contacts: contacts.map(toPublicReferralContact),
  };
}

export async function createOrderDraftAction(
  user: User | null,
  input: CreateOrderDraftInput
) {
  const currentUser = requireUser(user);
  if (input.agreementVersion !== REFERRAL_SERVICE_AGREEMENT_VERSION) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported agreement version",
    });
  }

  const { session, triageResult, selectedHospital } =
    await resolveRankedHospitalSelection({
      triageSessionId: input.triageSessionId,
      userId: currentUser.id,
      rankedHospitalIndex: input.rankedHospitalIndex,
      hospitalId: input.hospitalId,
    });
  const localHospital = await resolveLocalHospitalForRankedHospital(selectedHospital);
  const contact =
    typeof input.contactId === "number" && input.contactId > 0
      ? await referralRepo.getContactById(input.contactId)
      : null;
  if (
    contact &&
    (!localHospital ||
      contact.isActive !== 1 ||
      contact.hospitalId !== localHospital.id)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selected contact is invalid",
    });
  }

  const mappedDepartment =
    contact && isPositiveInteger(contact.departmentId)
      ? await referralRepo.getDepartmentById(contact.departmentId)
      : await resolveLocalDepartmentForRankedHospital({
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
  const activeContacts = localHospital
    ? contact
      ? [contact]
      : await referralRepo.listActiveContactsByHospital({
          hospitalId: localHospital.id,
          departmentId: department?.id ?? null,
        })
    : [];
  const recommendedDepartment = triageResult?.routing?.recommendedDepartment ?? null;
  const manualFulfillmentRequired =
    !localHospital || !department || activeContacts.length === 0;

  const orderId = await referralRepo.createReferralOrder({
    values: {
      patientUserId: currentUser.id,
      triageSessionId: session.id,
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

  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    manualFulfillmentRequired: order.manualFulfillmentRequired === 1,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt ?? null,
  };
}

export async function createPaymentSessionAction(input: {
  user: User | null;
  createInput: CreatePaymentSessionInput;
  req: Request;
}) {
  const currentUser = requireUser(input.user);
  const order = await getOwnedOrder({
    orderId: input.createInput.orderId,
    userId: currentUser.id,
  });

  if (order.paymentStatus === "paid") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Referral order is already paid",
    });
  }

  const publicBaseUrl = getPublicBaseUrl(input.req);
  const checkout = await createPaymentCheckoutSession({
    appointmentId: order.id,
    amount: order.totalAmount,
    currency: order.currency,
    successUrl: `${publicBaseUrl}/referrals/payment/success?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${publicBaseUrl}/referrals/payment/cancel?orderId=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
  });

  const marked = await referralRepo.markOrderPendingPayment({
    orderId: order.id,
    paymentSessionId: checkout.id,
    paymentProvider: checkout.provider,
  });
  if (!marked.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  }

  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: "patient",
    operatorId: currentUser.id,
    actionType: "payment_session_created",
    actionPayload: {
      paymentSessionId: checkout.id,
    },
  });

  return {
    orderId: order.id,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    checkoutSessionUrl: checkout.url,
    paymentSessionId:
      process.env.NODE_ENV === "development" ? checkout.id : undefined,
  };
}

export async function confirmReturnedPaymentSessionAction(input: {
  paymentSessionId: string;
}) {
  const order = await referralRepo.getReferralOrderByPaymentSessionId(
    input.paymentSessionId
  );
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found for payment session",
    });
  }

  if (order.paymentStatus !== "paid") {
    await resolvePaymentAdapter().captureOrFinalize({
      providerSessionId: input.paymentSessionId,
    });
  }

  const settledOrder = await settleReferralOrderPaymentBySessionId({
    paymentSessionId: input.paymentSessionId,
    actorType: "webhook",
    reason: "return_url_payment_confirmed",
  });

  return {
    ok: true as const,
    orderId: settledOrder.id,
    status: settledOrder.status,
    paymentStatus: settledOrder.paymentStatus,
    paymentSessionId: settledOrder.paymentProviderSessionId ?? null,
  };
}

export async function confirmMockPaymentAction(
  user: User | null,
  input: { orderId: number }
) {
  if (process.env.NODE_ENV === "production") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mock checkout is disabled in production",
    });
  }

  const currentUser = requireUser(user);
  const order = await getOwnedOrder({
    orderId: input.orderId,
    userId: currentUser.id,
  });
  if (!order.paymentProviderSessionId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Payment session is missing for referral order",
    });
  }

  const settledOrder = await settleReferralOrderPaymentBySessionId({
    paymentSessionId: order.paymentProviderSessionId,
    actorType: "system",
    reason: "mock_payment_confirmed",
  });

  return {
    ok: true as const,
    orderId: settledOrder.id,
    status: settledOrder.status,
    paymentStatus: settledOrder.paymentStatus,
    paymentSessionId: settledOrder.paymentProviderSessionId ?? null,
  };
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
  const refundRequest = await referralRepo.getLatestRefundRequestByOrderId(orderId);
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
        ): operation is NonNullable<ReturnType<typeof toPatientVisibleOperation>> =>
          Boolean(operation)
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
  const refundRequest = await referralRepo.getLatestRefundRequestByOrderId(orderId);
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
    recommendationReason: displayContext.recommendationReason,
    hospital: displayContext.hospital,
    department: displayContext.department,
    contact: toPublicReferralContactOrNull(bundle.contact),
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

export async function claimOrderAction(user: User | null, input: { orderId: number }) {
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

export async function assignOrderAction(user: User | null, input: AssignOrderInput) {
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
  if (!contact || contact.isActive !== 1 || contact.hospitalId !== order.hospitalId) {
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
      input.toStatus === "completed"
        ? { completedAt: new Date() }
        : undefined,
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

  if (input.toStatus === "scheduled") {
    await recordPatientNotification({
      orderId: order.id,
      detail: "Consultation time has been confirmed.",
    });
    await notifyPatientReferralUpdate({
      orderId: order.id,
      event: "consultation_time_confirmed",
      detail: "Consultation time confirmed",
    });
  }
  if (input.toStatus === "refund_pending_review" || input.toStatus === "refund_processing") {
    await recordPatientNotification({
      orderId: order.id,
      detail: "A refund review is in progress for your referral order.",
    });
  }

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
    await initiateRefundAction(currentUser, {
      orderId: order.id,
      reasonCode: "contact_failed",
      reasonDetail: input.note,
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
    await initiateRefundAction(currentUser, {
      orderId: order.id,
      reasonCode: "booking_failed",
      reasonDetail: input.note,
    });
  }

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
  if (currentStatus === "booking_in_progress") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "time_coordination",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: "consultation_time_coordination_started",
    });
  }

  if (currentStatus !== "scheduled") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "scheduled",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: "consultation_time_confirmed",
      update: {
        consultationTime: input.consultationTime,
      },
    });
    await referralRepo.insertOperation({
      orderId: order.id,
      operatorType: resolveActorTypeFromUser(currentUser),
      operatorId: currentUser.id,
      actionType: "consultation_time_confirmed",
      actionPayload: {
        consultationTime: input.consultationTime.toISOString(),
        note: input.note ?? null,
      },
    });
  } else {
    await referralRepo.updateReferralOrderById({
      orderId: order.id,
      update: {
        consultationTime: input.consultationTime,
      },
    });
    await referralRepo.insertOperation({
      orderId: order.id,
      operatorType: resolveActorTypeFromUser(currentUser),
      operatorId: currentUser.id,
      actionType: "consultation_time_updated",
      actionPayload: {
        consultationTime: input.consultationTime.toISOString(),
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
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}

export async function initiateRefundAction(
  user: User | null,
  input: InitiateRefundInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  if (order.paymentStatus !== "paid") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Only paid referral orders can enter refund review.",
    });
  }

  const latestRefund = await referralRepo.getLatestRefundRequestByOrderId(order.id);
  if (
    latestRefund &&
    latestRefund.status !== "refunded" &&
    latestRefund.status !== "rejected"
  ) {
    return getAdminOrderDetailAction(currentUser, order.id);
  }

  if (order.status !== "refund_pending_review") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "refund_pending_review",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: `refund_requested:${input.reasonCode}`,
      update: {
        refundReason: input.reasonDetail,
      },
    });
  }

  const refundRequestId = await referralRepo.createRefundRequest({
    values: {
      orderId: order.id,
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
      status: "pending_review",
      requestedBy: currentUser.id,
    },
  });

  if (!refundRequestId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create refund request",
    });
  }

  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "refund_requested",
    actionPayload: {
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
    },
  });
  await recordPatientNotification({
    orderId: order.id,
    detail: "Refund review initiated.",
  });
  await notifyPatientReferralUpdate({
    orderId: order.id,
    event: "refund_initiated",
    detail: input.reasonCode,
  });
  await notifyInternalActionRequired({
    orderId: order.id,
    status: "refund_pending_review",
    reason: input.reasonDetail,
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}

function deriveRefundResumeStatus(order: Awaited<ReturnType<typeof referralRepo.getReferralOrderById>>) {
  if (!order) {
    return "paid_pending_assignment" as const;
  }
  if (order.consultationTime) {
    return "scheduled" as const;
  }
  if (order.assignedAgentId) {
    return "assigned" as const;
  }
  return "paid_pending_assignment" as const;
}

export async function reviewRefundAction(
  user: User | null,
  input: ReviewRefundInput
) {
  const currentUser = requireUser(user);
  const order = await referralRepo.getReferralOrderById(input.orderId);
  if (!order) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  }
  const refundRequest = await referralRepo.getLatestRefundRequestByOrderId(order.id);
  if (!refundRequest || refundRequest.id !== input.refundRequestId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Refund request not found",
    });
  }
  if (refundRequest.status === "refunded") {
    return getAdminOrderDetailAction(currentUser, order.id);
  }

  if (!input.approve) {
    await referralRepo.updateRefundRequestById({
      refundRequestId: refundRequest.id,
      update: {
        status: "rejected",
        reviewedBy: currentUser.id,
      },
    });
    await changeOrderStatus({
      orderId: order.id,
      toStatus: deriveRefundResumeStatus(order),
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: input.note?.trim() || "refund_rejected",
      update: {
        refundReason: null,
      },
    });
    await referralRepo.insertOperation({
      orderId: order.id,
      operatorType: resolveActorTypeFromUser(currentUser),
      operatorId: currentUser.id,
      actionType: "refund_rejected",
      actionPayload: {
        note: input.note ?? null,
      },
    });
    return getAdminOrderDetailAction(currentUser, order.id);
  }

  await referralRepo.updateRefundRequestById({
    refundRequestId: refundRequest.id,
    update: {
      status: "approved",
      reviewedBy: currentUser.id,
      approvedAt: new Date(),
    },
  });
  if (order.status !== "refund_processing") {
    await changeOrderStatus({
      orderId: order.id,
      toStatus: "refund_processing",
      toPaymentStatus: "paid",
      actorType: resolveActorTypeFromUser(currentUser),
      actorId: currentUser.id,
      reason: input.note?.trim() || "refund_approved",
    });
  }
  await referralRepo.updateRefundRequestById({
    refundRequestId: refundRequest.id,
    update: {
      status: "processing",
    },
  });
  await changeOrderStatus({
    orderId: order.id,
    toStatus: "refunded",
    toPaymentStatus: "refunded",
    actorType: resolveActorTypeFromUser(currentUser),
    actorId: currentUser.id,
    reason: input.note?.trim() || "refund_completed",
    update: {
      refundedAt: new Date(),
    },
  });
  await referralRepo.updateRefundRequestById({
    refundRequestId: refundRequest.id,
    update: {
      status: "refunded",
      refundedAt: new Date(),
    },
  });
  await referralRepo.insertOperation({
    orderId: order.id,
    operatorType: resolveActorTypeFromUser(currentUser),
    operatorId: currentUser.id,
    actionType: "refund_completed",
    actionPayload: {
      note: input.note ?? null,
    },
  });
  await recordPatientNotification({
    orderId: order.id,
    detail: "Refund completed.",
  });
  await notifyPatientReferralUpdate({
    orderId: order.id,
    event: "refund_completed",
    detail: input.note?.trim() || "refund_completed",
  });

  return getAdminOrderDetailAction(currentUser, order.id);
}

export async function listReferralContactsForAdminAction(input?: {
  hospitalId?: number;
}) {
  const rows = await referralRepo.listReferralContactsForAdmin(input);
  return rows.map(toPublicReferralContact);
}

export async function listReferralHospitalsForAdminAction() {
  const rows = await referralRepo.listHospitalsForReferralCatalog();
  return rows.map(toPublicReferralHospital);
}

export async function listReferralDepartmentsForAdminAction(hospitalId: number) {
  const rows = await referralRepo.listDepartmentsByHospitalId(hospitalId);
  return rows.map(toPublicReferralDepartment);
}

export async function listAssignableAgentsAction() {
  const rows = await adminRepo.listAdminUsers({ limit: 100 });

  return rows
    .filter(row => row.role === "admin" || row.role === "ops")
    .map(row => ({
      id: row.id,
      email: row.email?.trim().toLowerCase() ?? null,
      name: row.name ?? null,
      role: row.role,
    }));
}

export async function upsertHospitalAction(input: UpsertHospitalInput) {
  const hospital = await referralRepo.upsertHospital(input);
  if (!hospital) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to save hospital",
    });
  }
  return toPublicReferralHospital(hospital);
}

export async function upsertContactAction(input: UpsertContactInput) {
  const contact = await referralRepo.upsertReferralContact({
    values: {
      id: input.id,
      hospitalId: input.hospitalId,
      departmentId: input.departmentId,
      name: input.name,
      roleType: input.roleType,
      languages: input.languages,
      specialtyTags: input.specialtyTags,
      avgResponseTimeMinutes: input.avgResponseTimeMinutes ?? null,
      successRate: input.successRate ?? null,
      isActive: input.isActive ? 1 : 0,
      internalNotes: input.internalNotes ?? null,
    },
  });
  if (!contact) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to save referral contact",
    });
  }
  return toPublicReferralContact(contact);
}

export async function updateHospitalActiveAction(input: {
  hospitalId: number;
  isActive: boolean;
}) {
  const affected = await referralRepo.updateHospitalActive(input);
  if (affected !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Hospital not found",
    });
  }
  const hospital = await referralRepo.getHospitalById(input.hospitalId);
  if (!hospital) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Hospital not found",
    });
  }
  return toPublicReferralHospital(hospital);
}

export async function updateContactActiveAction(input: {
  contactId: number;
  isActive: boolean;
}) {
  const affected = await referralRepo.updateReferralContactActive(input);
  if (affected !== 1) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral contact not found",
    });
  }
  const contact = await referralRepo.getContactById(input.contactId);
  if (!contact) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Referral contact not found",
    });
  }
  return toPublicReferralContact(contact);
}
