import * as appointmentsRepo from "./repo";

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
      console.warn("[Visit] failed to mark in_session:", error);
    }
  }
}
