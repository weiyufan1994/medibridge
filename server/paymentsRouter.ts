import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as appointmentsRepo from "./modules/appointments/repo";
import { generateToken, hashToken } from "./_core/appointmentToken";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sendMagicLinkEmail } from "./_core/mailer";
import { setCachedPatientAccessToken } from "./modules/appointments/tokenCache";

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
const RESEND_ALLOWED_STATUS: appointmentsRepo.AppointmentStatus[] = [
  "paid",
  "confirmed",
  "in_session",
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
  paymentStatus: appointmentsRepo.PaymentStatus;
  status: appointmentsRepo.AppointmentStatus;
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

  if (input.status === "expired" || input.paymentStatus === "expired") {
    return "This appointment has expired. Please book a new appointment.";
  }

  return "Payment has not completed yet. Please finish checkout first.";
}

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
  const claimRows = await appointmentsRepo.tryMarkPaidByStripeSessionId({
    stripeSessionId: input.stripeSessionId,
  });

  if (claimRows === 0) {
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

    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Appointment is not in settleable payment state",
    });
  }

  const appointment = await appointmentsRepo.getAppointmentByStripeSessionId(
    input.stripeSessionId
  );

  if (!appointment) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after payment settlement",
    });
  }

  const patientToken = generateToken();
  const patientTokenHash = hashToken(patientToken);
  const doctorToken = generateToken();
  const doctorLinkHash = hashToken(doctorToken);
  const accessTokenExpiresAt = computeDefaultTokenExpiry(
    appointment.scheduledAt ?? new Date()
  );

  await appointmentsRepo.createAppointmentTokenIfMissing({
    appointmentId: appointment.id,
    role: "patient",
    tokenHash: patientTokenHash,
    expiresAt: accessTokenExpiresAt,
  });
  await appointmentsRepo.createAppointmentTokenIfMissing({
    appointmentId: appointment.id,
    role: "doctor",
    tokenHash: doctorLinkHash,
    expiresAt: accessTokenExpiresAt,
  });

  await appointmentsRepo.insertStatusEvent({
    appointmentId: appointment.id,
    fromStatus: "pending_payment",
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
  setCachedPatientAccessToken(appointment.id, patientToken, accessTokenExpiresAt);
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
