import type { RequestMetadata } from "@shared/requestMetadata";
import { validateAppointmentToken } from "./accessValidation";
import { rescheduleAppointmentByToken } from "./rescheduleActions";
import { toPublicAppointment } from "./serializers";
import { completeAppointmentByDoctor } from "./statusActions";

export async function rescheduleByTokenFlow(input: {
  appointmentId: number;
  token: string;
  newScheduledAt: Date;
  requestMetadata?: RequestMetadata;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "join_room",
    input.requestMetadata
  );
  const updated = await rescheduleAppointmentByToken({
    appointmentId: appointment.id,
    role,
    newScheduledAt: input.newScheduledAt,
    currentStatus: appointment.status,
  });

  return toPublicAppointment(updated);
}

export async function completeAppointmentByTokenFlow(input: {
  appointmentId: number;
  token: string;
  operatorId: number | null;
  requestMetadata?: RequestMetadata;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "send_message",
    input.requestMetadata
  );

  return completeAppointmentByDoctor({
    appointmentId: appointment.id,
    role,
    operatorId: input.operatorId,
  });
}
