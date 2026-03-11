import type { Request } from "express";
import * as aiRepo from "../ai/repo";
import * as appointmentsRepo from "./repo";
import { buildAppointmentAccessLink } from "./linkService";
import { validateAppointmentToken } from "./accessValidation";
import { localizeTriageContent, parseIntakeFromNotes } from "./accessQueryActions";
import { resolveConsultationTimerState } from "./consultationTimer";
import { toPublicAppointment } from "./serializers";
import { appointmentIntakeSchema } from "./schemas";

type IntakeSafeParseResult<T> = { success: true; data: T } | { success: false };

export async function getAppointmentAccessByToken<
  TIntake extends Record<string, string | undefined>,
>(input: {
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
  const medicalSummary = await appointmentsRepo.getMedicalSummaryByAppointmentId(appointment.id);
  const canReadMedicalSummary = role === "doctor" || Boolean(medicalSummary?.signedBy);
  const parsedIntake = parseIntakeFromNotes(appointment.notes, input.parseIntake);
  const localizedTriage = await localizeTriageContent({
    summary: triageSession?.summary ?? null,
    intake: parsedIntake,
    targetLang: input.lang,
  });
  const timer = resolveConsultationTimerState(appointment.notes);

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
    triageSummary: localizedTriage.summary,
    intake: localizedTriage.intake,
    medicalSummary: canReadMedicalSummary && medicalSummary
      ? {
          chiefComplaint: medicalSummary.chiefComplaint,
          historyOfPresentIllness: medicalSummary.historyOfPresentIllness,
          pastMedicalHistory: medicalSummary.pastMedicalHistory,
          assessmentDiagnosis: medicalSummary.assessmentDiagnosis,
          planRecommendations: medicalSummary.planRecommendations,
          source: medicalSummary.source,
          signedBy: medicalSummary.signedBy ?? null,
          createdAt: medicalSummary.createdAt,
          updatedAt: medicalSummary.updatedAt,
        }
      : null,
    consultationDurationMinutes: timer.baseDurationMinutes,
    consultationExtensionMinutes: timer.extensionMinutes,
    consultationTotalMinutes: timer.totalDurationMinutes,
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
