import { TRPCError } from "@trpc/server";
import * as appointmentsRepo from "./repo";

const CONSULTATION_DURATION_MINUTES = 60;

export function computeDefaultTokenExpiry(scheduledAt: Date): Date {
  const expiresAt = new Date(
    scheduledAt.getTime() + CONSULTATION_DURATION_MINUTES * 60 * 1000
  );
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}

export async function rescheduleAppointmentByToken(input: {
  appointmentId: number;
  role: "patient" | "doctor";
  newScheduledAt: Date;
  currentStatus: string;
}) {
  if (input.role !== "patient") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires a patient magic link",
    });
  }

  const nextAccessTokenExpiresAt = computeDefaultTokenExpiry(
    input.newScheduledAt
  );

  await appointmentsRepo.updateAppointmentById(input.appointmentId, {
    scheduledAt: input.newScheduledAt,
    status:
      input.currentStatus === "ended" || input.currentStatus === "refunded"
        ? input.currentStatus
        : "paid",
    updatedAt: new Date(),
  });
  await appointmentsRepo.updateActiveAppointmentTokenExpiry({
    appointmentId: input.appointmentId,
    expiresAt: nextAccessTokenExpiresAt,
  });

  const updated = await appointmentsRepo.getAppointmentById(input.appointmentId);
  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after reschedule",
    });
  }

  return updated;
}
