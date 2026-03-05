import * as appointmentsRepo from "../appointments/repo";

export async function markInSessionIfTransitioned(appointmentId: number) {
  try {
    const fromStatus = await appointmentsRepo.markAppointmentInSessionIfNeeded(
      appointmentId
    );
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

