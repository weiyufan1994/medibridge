import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import * as appointmentsRepo from "./repo";
import { createStripeCheckoutSession } from "../payments/stripe";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./stateMachine";
import { getPublicBaseUrl } from "../../_core/getPublicBaseUrl";

type CheckoutPackage = {
  id: string;
  durationMinutes: number;
  amount: number;
  currency: "usd";
};

type IntakeInput = {
  chiefComplaint?: string;
  duration?: string;
  medicalHistory?: string;
  medications?: string;
  allergies?: string;
  ageGroup?: string;
  otherSymptoms?: string;
};

function formatIntakeToNotes(
  input?: IntakeInput,
  selectedPackage?: CheckoutPackage
) {
  const normalized = {
    chiefComplaint: input?.chiefComplaint?.trim() || "",
    duration: input?.duration?.trim() || "",
    medicalHistory: input?.medicalHistory?.trim() || "",
    medications: input?.medications?.trim() || "",
    allergies: input?.allergies?.trim() || "",
    ageGroup: input?.ageGroup?.trim() || "",
    otherSymptoms: input?.otherSymptoms?.trim() || "",
  };

  const hasAnyField = Object.values(normalized).some(Boolean);
  if (!hasAnyField && !selectedPackage) {
    return null;
  }

  return JSON.stringify({
    intakeVersion: selectedPackage ? 2 : 1,
    packageId: selectedPackage?.id,
    packageDurationMinutes: selectedPackage?.durationMinutes,
    ...normalized,
  });
}

async function resolveInsertedAppointmentId(
  insertResult: unknown,
  fallbackLookup: {
    doctorId: number;
    email: string;
    scheduledAt: Date;
    triageSessionId: number;
    status?: "draft";
    paymentStatus?: "unpaid";
  }
): Promise<number> {
  const directInsertId = Number(
    (insertResult as { insertId?: number })?.insertId ??
      (Array.isArray(insertResult)
        ? (insertResult[0] as { insertId?: number } | undefined)?.insertId
        : Number.NaN)
  );

  if (Number.isInteger(directInsertId) && directInsertId > 0) {
    return directInsertId;
  }

  const resolvedId =
    await appointmentsRepo.findLatestAppointmentIdByLookup(fallbackLookup);

  if (!resolvedId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to resolve appointment ID after creation",
    });
  }

  return resolvedId;
}

export async function resolveCreateInputToStoredEmail(input: {
  email?: string;
  phone?: string;
}): Promise<string> {
  if (input.email) {
    return input.email;
  }
  const compactPhone = (input.phone ?? "").replace(/[^0-9+]/g, "");
  if (!compactPhone) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "email or phone is required",
    });
  }
  return `phone+${compactPhone.replace(/\+/g, "")}@medibridge.local`;
}

export async function createAppointmentCheckoutFlow(input: {
  doctorId: number;
  triageSessionId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date;
  email: string;
  sessionId?: string;
  userId?: number | null;
  selectedPackage: CheckoutPackage;
  intake?: IntakeInput;
  req: Request;
}) {
  const insertResult = await appointmentsRepo.createAppointmentDraft({
    doctorId: input.doctorId,
    triageSessionId: input.triageSessionId,
    appointmentType: input.appointmentType,
    scheduledAt: input.scheduledAt,
    sessionId: input.sessionId,
    email: input.email,
    amount: input.selectedPackage.amount,
    currency: input.selectedPackage.currency,
    userId: input.userId,
    notes: formatIntakeToNotes(input.intake, input.selectedPackage),
  });

  const appointmentId = await resolveInsertedAppointmentId(insertResult, {
    doctorId: input.doctorId,
    email: input.email,
    scheduledAt: input.scheduledAt,
    triageSessionId: input.triageSessionId,
    status: "draft",
    paymentStatus: "unpaid",
  });

  await appointmentsRepo.insertStatusEvent({
    appointmentId,
    fromStatus: null,
    toStatus: "draft",
    operatorType: "patient",
    operatorId: input.userId ?? null,
    reason: "appointment_draft_created",
    payloadJson: {
      packageId: input.selectedPackage.id,
      packageDurationMinutes: input.selectedPackage.durationMinutes,
    },
  });

  const publicUrlBase = getPublicBaseUrl(input.req);
  const checkout = createStripeCheckoutSession({
    appointmentId,
    amount: input.selectedPackage.amount,
    currency: input.selectedPackage.currency,
    successUrl: `${publicUrlBase}/payment/success`,
    cancelUrl: `${publicUrlBase}/payment/cancel`,
  });

  const transitioned = await appointmentsRepo.markAppointmentPendingPayment({
    appointmentId,
    stripeSessionId: checkout.id,
  });
  if (transitioned && "ok" in transitioned && !transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  return {
    appointmentId,
    checkoutUrl: checkout.url,
    checkoutSessionUrl: checkout.url,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    stripeSessionId:
      process.env.NODE_ENV === "development" ? checkout.id : undefined,
  };
}
