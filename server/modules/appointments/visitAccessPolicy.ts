import type { TokenErrorCode } from "./tokenErrors";
import { canJoinRoom, canSendMessage } from "./chatPolicy";

export type VisitAccessAction = "join_room" | "read_history" | "send_message";

type VisitPolicyAppointment = {
  scheduledAt: Date | null;
  status: string;
  paymentStatus: string;
};

function isVisitRoomTestModeEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const raw = (process.env.VISIT_ROOM_TEST_MODE ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function hasConsultationStarted(scheduledAt: Date | null, now: Date) {
  if (isVisitRoomTestModeEnabled()) {
    return true;
  }
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    return true;
  }
  return now.getTime() >= scheduledAt.getTime();
}

export function getVisitAccessPolicyFailure(input: {
  appointment: VisitPolicyAppointment;
  action: VisitAccessAction;
  now: Date;
}): TokenErrorCode | null {
  if (!hasConsultationStarted(input.appointment.scheduledAt, input.now)) {
    return "APPOINTMENT_NOT_STARTED";
  }

  if (
    !canJoinRoom({
      status: input.appointment.status,
      paymentStatus: input.appointment.paymentStatus,
    }) ||
    (input.action === "send_message" &&
      !canSendMessage({
        status: input.appointment.status,
        paymentStatus: input.appointment.paymentStatus,
      }))
  ) {
    return "APPOINTMENT_NOT_ALLOWED";
  }

  return null;
}
