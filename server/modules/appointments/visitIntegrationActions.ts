import { createLogger } from "../../_core/logger";
import * as appointmentsRepo from "./repo";

const logger = createLogger("appointment-visit-integration");

export async function touchAppointmentVisitAccess(input: {
  appointmentId: number;
  role: "patient" | "doctor";
  touchedAt: Date;
}) {
  await appointmentsRepo.updateAppointmentById(
    input.appointmentId,
    input.role === "doctor"
      ? { doctorLastAccessAt: input.touchedAt }
      : { lastAccessAt: input.touchedAt }
  );
}

export async function markAppointmentInSessionAfterFirstMessage(
  appointmentId: number
) {
  try {
    const fromStatus =
      await appointmentsRepo.markAppointmentInSessionIfNeeded(appointmentId);
    if (!fromStatus) {
      return;
    }

    await appointmentsRepo.insertStatusEvent({
      appointmentId,
      fromStatus,
      toStatus: "active",
      operatorType: "system",
      reason: "first_visit_message",
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.warn("status_sync_failed", {
        appointmentId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
