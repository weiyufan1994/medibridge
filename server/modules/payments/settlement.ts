import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import * as appointmentsRepo from "../appointments/repo";
import { sendMagicLinkEmail } from "../../_core/mailer";
import { setCachedPatientAccessToken } from "../appointments/tokenCache";
import { issueAppointmentAccessLinks } from "../appointments/tokenService";

export async function settleStripePaymentBySessionId(input: {
  stripeSessionId: string;
  source: "webhook" | "mock";
  eventId?: string;
  req?: Request;
  dbExecutor?: appointmentsRepo.AppointmentRepoExecutor;
}) {
  const claimRows = await appointmentsRepo.tryMarkPaidByStripeSessionId({
    stripeSessionId: input.stripeSessionId,
    operatorType: input.source === "webhook" ? "webhook" : "system",
    reason: input.source === "webhook" ? "stripe_webhook_paid" : "mock_payment_paid",
    payloadJson: {
      stripeSessionId: input.stripeSessionId,
      eventId: input.eventId ?? null,
    },
    dbExecutor: input.dbExecutor,
  });

  if (claimRows === 0) {
    const appointment = await appointmentsRepo.getAppointmentByStripeSessionId(
      input.stripeSessionId,
      input.dbExecutor
    );

    if (!appointment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Appointment not found for Stripe session",
      });
    }

    if (appointment.paymentStatus === "paid") {
      return {
        appointment,
        alreadySettled: true,
        patientLink: null,
        doctorLink: null,
      };
    }

    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Appointment is not in settleable payment state",
    });
  }

  const appointment = await appointmentsRepo.getAppointmentByStripeSessionId(
    input.stripeSessionId,
    input.dbExecutor
  );

  if (!appointment) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after payment settlement",
    });
  }

  const issuedLinks = await issueAppointmentAccessLinks({
    appointmentId: appointment.id,
    createdBy: input.source === "webhook" ? "stripe_webhook" : "system",
  });

  const patientLink = issuedLinks.patientLink;
  const doctorLink = issuedLinks.doctorLink;
  setCachedPatientAccessToken(
    appointment.id,
    issuedLinks.patient.token,
    issuedLinks.expiresAt
  );
  if (!appointment.email.endsWith("@medibridge.local")) {
    try {
      await sendMagicLinkEmail(appointment.email, patientLink);
    } catch (error) {
      const reason =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "unknown_mailer_error";
      await appointmentsRepo.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: "paid",
        toStatus: "paid",
        operatorType: input.source === "webhook" ? "webhook" : "system",
        operatorId: null,
        reason: "payment_link_email_failed",
        payloadJson: {
          stripeSessionId: input.stripeSessionId,
          error: reason,
        },
        dbExecutor: input.dbExecutor,
      });
      console.error("[payments] failed to send payment success link email:", reason);
    }
  }

  return {
    appointment: {
      ...appointment,
      paymentStatus: "paid" as const,
      status: "paid" as const,
    },
    alreadySettled: false,
    patientLink,
    doctorLink,
  };
}
