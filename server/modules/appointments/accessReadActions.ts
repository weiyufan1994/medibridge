import type { Request } from "express";
import * as aiRepo from "../ai/repo";
import { buildAppointmentAccessLink } from "./linkService";
import { validateAppointmentToken } from "./accessValidation";
import { parseIntakeFromNotes, translateTriageSummary } from "./accessQueryActions";
import { toPublicAppointment } from "./serializers";
import { appointmentIntakeSchema } from "./schemas";

type IntakeSafeParseResult<T> = { success: true; data: T } | { success: false };

export async function getAppointmentAccessByToken<TIntake>(input: {
  appointmentId: number;
  token: string;
  lang: "en" | "zh";
  req?: Request;
  parseIntake: (input: unknown) => IntakeSafeParseResult<TIntake>;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "read_history",
    input.req
  );

  const triageSession = await aiRepo.getAiChatSessionById(appointment.triageSessionId);
  const localizedSummary = triageSession?.summary
    ? await translateTriageSummary(triageSession.summary, input.lang)
    : null;

  return {
    ...toPublicAppointment(appointment),
    role,
    patient: {
      email: appointment.email,
      sessionId: appointment.sessionId,
    },
    doctor: {
      id: appointment.doctorId,
    },
    triageSummary: localizedSummary,
    intake: parseIntakeFromNotes(appointment.notes, input.parseIntake),
  };
}

export async function getAppointmentAccessByTokenWithDefaultIntake(input: {
  appointmentId: number;
  token: string;
  lang: "en" | "zh";
  req?: Request;
}) {
  return getAppointmentAccessByToken({
    appointmentId: input.appointmentId,
    token: input.token,
    lang: input.lang,
    req: input.req,
    parseIntake: value => appointmentIntakeSchema.safeParse(value),
  });
}

export async function getJoinInfoByToken(input: {
  appointmentId: number;
  token: string;
  req?: Request;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "join_room",
    input.req
  );

  return {
    appointmentId: appointment.id,
    joinUrl: buildAppointmentAccessLink({
      appointmentId: appointment.id,
      token: input.token,
    }),
    role,
    patient: {
      email: appointment.email,
      sessionId: appointment.sessionId,
    },
    doctor: {
      id: appointment.doctorId,
    },
  };
}
