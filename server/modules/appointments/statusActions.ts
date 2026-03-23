import { TRPCError } from "@trpc/server";
import { appointments } from "../../../drizzle/schema";
import * as appointmentsRepo from "./repo";
import * as schedulingRepo from "../scheduling/repo";
import { resolveBoundDoctorIdForUser } from "../doctorAccounts/actions";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./stateMachine";
import { getAppointmentByIdOrThrow } from "./accessValidation";

type AppointmentRecord = typeof appointments.$inferSelect;

export async function cancelAppointmentByPatient(input: {
  appointment: AppointmentRecord;
  operatorId: number | null;
  reason?: string;
}) {
  const { appointment, operatorId, reason } = input;

  const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
    appointmentId: appointment.id,
    allowedFrom: ["draft", "pending_payment", "paid"],
    toStatus: "canceled",
    toPaymentStatus: appointment.paymentStatus === "paid" ? "failed" : "canceled",
    operatorType: "patient",
    operatorId,
    reason: reason ?? "appointment_canceled",
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  await appointmentsRepo.revokeAppointmentTokens({
    appointmentId: appointment.id,
    reason: "appointment_canceled",
  });
  await schedulingRepo.releaseHeldSlotByAppointmentId({
    appointmentId: appointment.id,
  });

  const updated = await appointmentsRepo.getAppointmentById(appointment.id);
  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after cancellation",
    });
  }

  return {
    appointmentId: updated.id,
    status: updated.status,
    paymentStatus: updated.paymentStatus,
    stripeSessionId: updated.stripeSessionId ?? null,
    paidAt: updated.paidAt ?? null,
  };
}

export async function cancelAppointmentByPatientById(input: {
  appointmentId: number;
  operatorId: number | null;
  reason?: string;
}) {
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  return cancelAppointmentByPatient({
    appointment,
    operatorId: input.operatorId,
    reason: input.reason,
  });
}

export async function completeAppointmentByDoctor(input: {
  appointmentId: number;
  role: "patient" | "doctor";
  operatorId: number | null;
}) {
  const { appointmentId, role, operatorId } = input;

  if (role !== "doctor") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Only doctor can complete appointment",
    });
  }

  const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
    appointmentId,
    allowedFrom: ["paid", "active"],
    toStatus: "ended",
    toPaymentStatus: "paid",
    operatorType: "doctor",
    operatorId,
    reason: "doctor_completed_consultation",
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  const updated = await appointmentsRepo.getAppointmentById(appointmentId);
  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after completion",
    });
  }

  return {
    appointmentId: updated.id,
    status: updated.status,
    paymentStatus: updated.paymentStatus,
  };
}

export async function startAppointmentByDoctorUser(input: {
  appointmentId: number;
  currentUserId: number;
  currentUserRole?: string | null;
  doctorId?: number;
}) {
  const doctorId = await resolveBoundDoctorIdForUser({
    userId: input.currentUserId,
    allowAdminDoctorId: input.doctorId,
    userRole: input.currentUserRole,
  });
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);

  if (appointment.doctorId !== doctorId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Appointment does not belong to the current doctor workbench",
    });
  }

  const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
    appointmentId: appointment.id,
    allowedFrom: ["paid", "active"],
    toStatus: "active",
    toPaymentStatus: "paid",
    operatorType: "doctor",
    operatorId: input.currentUserId,
    reason: "doctor_started_consultation",
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  const updated = await appointmentsRepo.getAppointmentById(appointment.id);
  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after activation",
    });
  }

  return {
    appointmentId: updated.id,
    status: updated.status,
    paymentStatus: updated.paymentStatus,
  };
}
