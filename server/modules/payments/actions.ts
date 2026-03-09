import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import * as appointmentsRepo from "../appointments/repo";
import { reinitiateCheckoutForAppointment } from "./reinitiateCheckout";
import { settleStripePaymentBySessionId } from "./settlement";

function assertMockCheckoutEnabled() {
  if (process.env.NODE_ENV === "production") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mock checkout is disabled in production",
    });
  }
}

export async function createCheckoutSessionForAppointmentAction(input: {
  appointmentId: number;
  operatorId: number | null;
  baseUrl?: string;
}) {
  const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
  if (!appointment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Appointment not found",
    });
  }

  const baseUrl = (input.baseUrl ?? process.env.APP_BASE_URL)?.trim();
  if (!baseUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "APP_BASE_URL_MISSING",
    });
  }

  return reinitiateCheckoutForAppointment({
    appointment,
    baseUrl,
    operatorType: "system",
    operatorId: input.operatorId,
  });
}

export async function confirmMockCheckoutAction(input: {
  stripeSessionId: string;
  req?: Request;
}) {
  assertMockCheckoutEnabled();
  const result = await settleStripePaymentBySessionId({
    stripeSessionId: input.stripeSessionId,
    source: "mock",
    req: input.req,
  });

  return {
    ok: true as const,
    alreadySettled: result.alreadySettled,
    appointmentId: result.appointment.id,
    devPatientLink:
      process.env.NODE_ENV === "development" ? result.patientLink : null,
    devDoctorLink:
      process.env.NODE_ENV === "development" ? result.doctorLink : null,
  };
}

export async function confirmMockCheckoutByAppointmentAction(input: {
  appointmentId: number;
  req?: Request;
}) {
  assertMockCheckoutEnabled();

  const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
  if (!appointment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Appointment not found",
    });
  }
  if (!appointment.stripeSessionId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe session is missing for appointment",
    });
  }

  const result = await settleStripePaymentBySessionId({
    stripeSessionId: appointment.stripeSessionId,
    source: "mock",
    req: input.req,
  });

  return {
    ok: true as const,
    alreadySettled: result.alreadySettled,
    appointmentId: result.appointment.id,
    stripeSessionId: appointment.stripeSessionId,
    devPatientLink:
      process.env.NODE_ENV === "development" ? result.patientLink : null,
    devDoctorLink:
      process.env.NODE_ENV === "development" ? result.doctorLink : null,
  };
}

export { getCheckoutResultByStripeSession, getPaymentStatusByAppointmentForUser } from "./readActions";
export { reinitiateCheckoutForAppointment, settleStripePaymentBySessionId };
