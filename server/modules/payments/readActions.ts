import { TRPCError } from "@trpc/server";
import * as appointmentsRepo from "../appointments/repo";
import { type AppointmentStatus, type PaymentStatus } from "../appointments/stateMachine";

const RESEND_ALLOWED_STATUS: AppointmentStatus[] = ["paid", "active"];

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

export async function getCheckoutResultByStripeSession(input: {
  stripeSessionId: string;
}) {
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
}

export async function getPaymentStatusByAppointmentForUser(input: {
  appointmentId: number;
  userId: number;
  userEmail?: string | null;
}) {
  const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
  if (!appointment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Appointment not found",
    });
  }

  const normalizedEmail = input.userEmail?.toLowerCase().trim();
  const isOwner =
    appointment.userId === input.userId ||
    (Boolean(normalizedEmail) && appointment.email.toLowerCase() === normalizedEmail);

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
}
