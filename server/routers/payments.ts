import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { z } from "zod";
import * as appointmentsRepo from "../modules/appointments/repo";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { sendMagicLinkEmail } from "../_core/mailer";
import { setCachedPatientAccessToken } from "../modules/appointments/tokenCache";
import { issueAppointmentAccessLinks } from "../modules/appointments/tokenService";
import { createStripeCheckoutSession } from "../modules/payments/stripe";
import {
  APPOINTMENT_INVALID_TRANSITION_ERROR,
  APPOINTMENT_STATUS_VALUES,
  CHECKOUT_REINIT_ALLOWED_FROM,
  CHECKOUT_REINIT_BLOCKED_STATUSES,
  PAYMENT_STATUS_VALUES,
  type AppointmentStatus,
  type PaymentStatus,
} from "../modules/appointments/stateMachine";
import type { appointments } from "../../drizzle/schema";

const paymentStatusSchema = z.enum(PAYMENT_STATUS_VALUES);
const statusSchema = z.enum(APPOINTMENT_STATUS_VALUES);
const RESEND_ALLOWED_STATUS: AppointmentStatus[] = [
  "paid",
  "active",
];

const getStatusInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

const getStatusOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  status: statusSchema,
  paymentStatus: paymentStatusSchema,
  paidAt: z.date().nullable(),
  stripeSessionId: z.string().nullable(),
});

const confirmMockInputSchema = z.object({
  stripeSessionId: z.string().min(8).max(255),
});
const confirmMockByAppointmentInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});
const createCheckoutSessionForAppointmentInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

const getCheckoutResultInputSchema = z.object({
  stripeSessionId: z.string().trim().min(1).max(255),
});

const getCheckoutResultOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  paymentStatus: paymentStatusSchema,
  status: statusSchema,
  email: z.string(),
  lastAccessAt: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  canResendLink: z.boolean(),
  messageForUser: z.string(),
});
const createCheckoutSessionForAppointmentOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  checkoutSessionUrl: z.string().url(),
  status: statusSchema,
  paymentStatus: paymentStatusSchema,
  stripeSessionId: z.string().optional(),
});

function maskEmail(email: string): string {
  const [rawLocalPart, rawDomain] = email.split("@");
  if (!rawLocalPart || !rawDomain) {
    return "***";
  }

  if (rawLocalPart.length === 1) {
    return `***@${rawDomain}`;
  }

  if (rawLocalPart.length === 2) {
    return `${rawLocalPart[0]}***@${rawDomain}`;
  }

  return `${rawLocalPart[0]}***${rawLocalPart[rawLocalPart.length - 1]}@${rawDomain}`;
}

function createCheckoutResultMessage(input: {
  paymentStatus: PaymentStatus;
  status: AppointmentStatus;
  canResendLink: boolean;
}) {
  if (input.canResendLink) {
    return "Payment successful. You can resend your access link if needed.";
  }

  if (input.paymentStatus === "pending") {
    return "Payment is still processing. Please refresh in a moment.";
  }

  if (input.paymentStatus === "failed") {
    return "Payment failed. Please try checkout again.";
  }

  if (input.paymentStatus === "refunded" || input.status === "refunded") {
    return "This payment was refunded. Please contact support for next steps.";
  }
  if (input.status === "canceled" || input.paymentStatus === "canceled") {
    return "This appointment was canceled.";
  }

  if (input.status === "expired" || input.paymentStatus === "expired") {
    return "This appointment has expired. Please book a new appointment.";
  }

  return "Payment has not completed yet. Please finish checkout first.";
}

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

type AppointmentRow = typeof appointments.$inferSelect;

export async function reinitiateCheckoutForAppointment(input: {
  appointment: AppointmentRow;
  baseUrl: string;
  operatorType: "system" | "patient" | "admin";
  operatorId: number | null;
}) {
  if (
    input.appointment.paymentStatus === "paid" ||
    CHECKOUT_REINIT_BLOCKED_STATUSES.includes(input.appointment.status)
  ) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  const normalizedBaseUrl = input.baseUrl.trim().replace(/\/$/, "");
  if (!normalizedBaseUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "APP_BASE_URL_MISSING",
    });
  }

  const checkout = createStripeCheckoutSession({
    appointmentId: input.appointment.id,
    amount: input.appointment.amount,
    currency: input.appointment.currency,
    successUrl: `${normalizedBaseUrl}/payment/success`,
    cancelUrl: `${normalizedBaseUrl}/payment/cancel`,
  });

  await appointmentsRepo.revokeAppointmentTokens({
    appointmentId: input.appointment.id,
    reason: "payment_reinitiated",
  });
  const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
    appointmentId: input.appointment.id,
    allowedFrom: CHECKOUT_REINIT_ALLOWED_FROM,
    toStatus: "pending_payment",
    toPaymentStatus: "pending",
    operatorType: input.operatorType,
    operatorId: input.operatorId,
    reason: "checkout_session_created",
    payloadJson: {
      oldStripeSessionId: input.appointment.stripeSessionId,
      newStripeSessionId: checkout.id,
    },
    update: {
      stripeSessionId: checkout.id,
    },
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  return {
    appointmentId: input.appointment.id,
    checkoutSessionUrl: checkout.url,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    stripeSessionId:
      process.env.NODE_ENV === "development" ? checkout.id : undefined,
  };
}

export const paymentsRouter = router({
  createCheckoutSessionForAppointment: publicProcedure
    .input(createCheckoutSessionForAppointmentInputSchema)
    .output(createCheckoutSessionForAppointmentOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const baseUrl = process.env.APP_BASE_URL?.trim();
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
        operatorId: ctx.user?.id ?? null,
      });
    }),

  getCheckoutResult: publicProcedure
    .input(getCheckoutResultInputSchema)
    .output(getCheckoutResultOutputSchema)
    .query(async ({ input }) => {
      const appointment = await appointmentsRepo.getCheckoutResultByStripeSessionId(
        input.stripeSessionId
      );

      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found for Stripe session",
        });
      }

      const canResendLink =
        appointment.paymentStatus === "paid" &&
        RESEND_ALLOWED_STATUS.includes(appointment.status);

      return {
        appointmentId: appointment.id,
        paymentStatus: appointment.paymentStatus,
        status: appointment.status,
        email: maskEmail(appointment.email),
        lastAccessAt: appointment.lastAccessAt
          ? appointment.lastAccessAt.toISOString()
          : null,
        paidAt: appointment.paidAt ? appointment.paidAt.toISOString() : null,
        canResendLink,
        messageForUser: createCheckoutResultMessage({
          paymentStatus: appointment.paymentStatus,
          status: appointment.status,
          canResendLink,
        }),
      };
    }),

  getStatus: protectedProcedure
    .input(getStatusInputSchema)
    .output(getStatusOutputSchema)
    .query(async ({ input, ctx }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const userEmail = ctx.user.email?.toLowerCase().trim();
      const isOwner =
        appointment.userId === ctx.user.id ||
        (Boolean(userEmail) && appointment.email.toLowerCase() === userEmail);

      if (!isOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to view this payment",
        });
      }

      return {
        appointmentId: appointment.id,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        paidAt: appointment.paidAt,
        stripeSessionId: appointment.stripeSessionId,
      };
    }),

  confirmMockCheckout: publicProcedure
    .input(confirmMockInputSchema)
    .output(
      z.object({
        ok: z.literal(true),
        alreadySettled: z.boolean(),
        appointmentId: z.number().int().positive(),
        devPatientLink: z.string().url().nullable(),
        devDoctorLink: z.string().url().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Mock checkout is disabled in production",
        });
      }

      const result = await settleStripePaymentBySessionId({
        stripeSessionId: input.stripeSessionId,
        source: "mock",
        req: ctx.req,
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
    }),

  confirmMockCheckoutByAppointment: publicProcedure
    .input(confirmMockByAppointmentInputSchema)
    .output(
      z.object({
        ok: z.literal(true),
        alreadySettled: z.boolean(),
        appointmentId: z.number().int().positive(),
        stripeSessionId: z.string().nullable(),
        devPatientLink: z.string().url().nullable(),
        devDoctorLink: z.string().url().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Mock checkout is disabled in production",
        });
      }

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
        req: ctx.req,
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
    }),
});
