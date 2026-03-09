import type { Request } from "express";
import { validateAppointmentToken } from "./accessValidation";
import { completeAppointmentByDoctor } from "./statusActions";
import { rescheduleAppointmentByToken } from "./rescheduleActions";
import { toPublicAppointment } from "./serializers";

export async function rescheduleByTokenFlow(input: {
  appointmentId: number;
  token: string;
  newScheduledAt: Date;
  req?: Request;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "join_room",
    input.req
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
  req?: Request;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "send_message",
    input.req
  );

  return completeAppointmentByDoctor({
    appointmentId: appointment.id,
    role,
    operatorId: input.operatorId,
  });
}
