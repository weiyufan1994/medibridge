import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as appointmentsRepo from "./modules/appointments/repo";
import { generateToken, hashToken } from "./_core/appointmentToken";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sendMagicLinkEmail } from "./_core/mailer";

const paymentStatusSchema = z.enum([
  "unpaid",
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
]);

const statusSchema = z.enum([
  "draft",
  "pending_payment",
  "paid",
  "confirmed",
  "in_session",
  "completed",
  "expired",
  "refunded",
]);

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

function computeDefaultTokenExpiry(scheduledAt: Date): Date {
  const expiresAt = new Date(scheduledAt.getTime() + 60 * 60 * 1000);
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}

function getBaseUrl() {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  return (configuredBaseUrl || "http://localhost:3000").replace(/\/$/, "");
}

function buildAppointmentMagicLink(
  baseUrl: string,
  appointmentId: number,
  token: string
): string {
  return `${baseUrl}/appointment/${appointmentId}?t=${encodeURIComponent(token)}`;
}

function buildDoctorMagicLink(
  baseUrl: string,
  appointmentId: number,
  token: string
): string {
  return `${baseUrl}/visit/${appointmentId}?t=${encodeURIComponent(token)}`;
}

export async function settleStripePaymentBySessionId(input: {
  stripeSessionId: string;
  source: "webhook" | "mock";
  eventId?: string;
}) {
  const appointment = await appointmentsRepo.getAppointmentByStripeSessionId(
    input.stripeSessionId
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

  if (appointment.status !== "pending_payment" || appointment.paymentStatus !== "pending") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Appointment is not in pending payment state",
    });
  }

  const patientToken = generateToken();
  const patientTokenHash = hashToken(patientToken);
  const doctorToken = generateToken();
  const doctorTokenHash = hashToken(doctorToken);
  const accessTokenExpiresAt = computeDefaultTokenExpiry(
    appointment.scheduledAt ?? new Date()
  );

  await appointmentsRepo.markAppointmentPaid({
    appointmentId: appointment.id,
    accessTokenHash: patientTokenHash,
    doctorTokenHash,
    accessTokenExpiresAt,
  });

  await appointmentsRepo.insertStatusEvent({
    appointmentId: appointment.id,
    fromStatus: appointment.status,
    toStatus: "paid",
    operatorType: input.source === "webhook" ? "webhook" : "system",
    reason: input.source === "webhook" ? "stripe_webhook_paid" : "mock_payment_paid",
    payloadJson: {
      stripeSessionId: input.stripeSessionId,
      eventId: input.eventId ?? null,
    },
  });

  const baseUrl = getBaseUrl();
  const patientLink = buildAppointmentMagicLink(baseUrl, appointment.id, patientToken);
  const doctorLink = buildDoctorMagicLink(baseUrl, appointment.id, doctorToken);
  await sendMagicLinkEmail(appointment.email, patientLink);
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Payments][DEV] Patient link: ${patientLink}`);
    console.log(`[Payments][DEV] Doctor link: ${doctorLink}`);
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

export const paymentsRouter = router({
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
    .mutation(async ({ input }) => {
      if (process.env.NODE_ENV === "production") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Mock checkout is disabled in production",
        });
      }

      const result = await settleStripePaymentBySessionId({
        stripeSessionId: input.stripeSessionId,
        source: "mock",
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
});
