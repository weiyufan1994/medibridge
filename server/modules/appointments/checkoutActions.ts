import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import * as appointmentsRepo from "./repo";
import { createPaymentCheckoutSession } from "../payments/providerManager";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./stateMachine";
import { getPublicBaseUrl } from "../../_core/getPublicBaseUrl";
import { getDb } from "../../db";
import * as schedulingRepo from "../scheduling/repo";

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

function readInsertedId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  const directInsertId = Number(
    (value as { insertId?: number })?.insertId ??
      (Array.isArray(value)
        ? (value[0] as { insertId?: number } | undefined)?.insertId
        : Number.NaN)
  );

  return Number.isInteger(directInsertId) && directInsertId > 0 ? directInsertId : null;
}

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
  slotId?: number;
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
  const slotId = input.slotId ?? null;
  const holdKey =
    input.sessionId?.trim() ||
    `booking:${input.userId ?? "anon"}:${input.email}:${Date.now()}`;
  let appointmentId: number | null = null;

  if (slotId) {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    await db.transaction(async tx => {
      const heldSlot = await schedulingRepo.holdSlot({
        slotId,
        heldBySessionId: holdKey,
        dbExecutor: tx,
      });

      if (!heldSlot) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "SLOT_UNAVAILABLE",
        });
      }

      const draftResult = await appointmentsRepo.createAppointmentDraft({
        slotId: input.slotId,
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
        dbExecutor: tx,
      });

      appointmentId =
        readInsertedId(draftResult) ??
        (await appointmentsRepo.findLatestAppointmentIdByLookup({
          slotId,
          doctorId: input.doctorId,
          email: input.email,
          scheduledAt: input.scheduledAt,
          triageSessionId: input.triageSessionId,
          status: "draft",
          paymentStatus: "unpaid",
          dbExecutor: tx,
        }));

      if (!appointmentId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to resolve appointment ID after creation",
        });
      }

      await schedulingRepo.attachHeldSlotToAppointment({
        slotId,
        appointmentId,
        heldBySessionId: holdKey,
        dbExecutor: tx,
      });
    });
  } else {
    const draftResult = await appointmentsRepo.createAppointmentDraft({
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

    appointmentId =
      readInsertedId(draftResult) ??
      (await appointmentsRepo.findLatestAppointmentIdByLookup({
        doctorId: input.doctorId,
        email: input.email,
        scheduledAt: input.scheduledAt,
        triageSessionId: input.triageSessionId,
        status: "draft",
        paymentStatus: "unpaid",
      }));
  }

  if (!appointmentId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to resolve appointment ID after creation",
    });
  }

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

  try {
    const publicUrlBase = getPublicBaseUrl(input.req);
    const checkout = await createPaymentCheckoutSession({
      appointmentId,
      amount: input.selectedPackage.amount,
      currency: input.selectedPackage.currency,
      successUrl: `${publicUrlBase}/payment/success`,
      cancelUrl: `${publicUrlBase}/payment/cancel`,
    });

    const transitioned = await appointmentsRepo.markAppointmentPendingPayment({
      appointmentId,
      stripeSessionId: checkout.id,
      paymentProvider: checkout.provider,
    });
    if (transitioned && "ok" in transitioned && !transitioned.ok) {
      if (slotId) {
        await schedulingRepo.releaseHeldSlotByAppointmentId({ appointmentId });
      }
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: APPOINTMENT_INVALID_TRANSITION_ERROR,
      });
    }

    return {
      appointmentId,
      slotId,
      checkoutUrl: checkout.url,
      checkoutSessionUrl: checkout.url,
      status: "pending_payment" as const,
      paymentStatus: "pending" as const,
      stripeSessionId:
        process.env.NODE_ENV === "development" ? checkout.id : undefined,
    };
  } catch (error) {
    if (slotId && appointmentId) {
      await schedulingRepo.releaseHeldSlotByAppointmentId({ appointmentId });
    }
    throw error;
  }
}
