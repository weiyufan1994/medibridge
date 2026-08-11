import type { RequestMetadata } from "@shared/requestMetadata";
import { aiTriageSessionApi as triageSessions } from "../ai/publicApi";
import * as appointmentsRepo from "./repo";
import { buildAppointmentAccessLink } from "./linkService";
import { validateAppointmentToken } from "./accessValidation";
import {
  localizeMedicalSummaryContent,
  localizeTriageContent,
  parseIntakeFromNotes,
} from "./accessQueryActions";
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
  requestMetadata?: RequestMetadata;
  parseIntake: (input: unknown) => IntakeSafeParseResult<TIntake>;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "read_history",
    input.requestMetadata
  );

  const triageSession = await triageSessions.getById(
    appointment.triageSessionId
  );
  const medicalSummary =
    await appointmentsRepo.getMedicalSummaryByAppointmentId(appointment.id);
  const canReadMedicalSummary =
    role === "doctor" || Boolean(medicalSummary?.signedBy);
  const parsedIntake = parseIntakeFromNotes(
    appointment.notes,
    input.parseIntake
  );
  const localizedTriage = await localizeTriageContent({
    summary: triageSession?.summary ?? null,
    intake: parsedIntake,
    targetLang: input.lang,
    englishFallbackMode:
      role === "patient" && input.lang === "en" ? "empty" : "source",
  });
  const medicalSummarySections =
    canReadMedicalSummary && medicalSummary
      ? {
          chiefComplaint: medicalSummary.chiefComplaint,
          historyOfPresentIllness: medicalSummary.historyOfPresentIllness,
          pastMedicalHistory: medicalSummary.pastMedicalHistory,
          assessmentDiagnosis: medicalSummary.assessmentDiagnosis,
          planRecommendations: medicalSummary.planRecommendations,
        }
      : null;
  const localizedMedicalSummarySections =
    medicalSummarySections && role === "patient" && input.lang === "en"
      ? await localizeMedicalSummaryContent({
          summary: medicalSummarySections,
          targetLang: "en",
        })
      : medicalSummarySections;
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
    medicalSummary:
      canReadMedicalSummary && medicalSummary && localizedMedicalSummarySections
        ? {
            ...localizedMedicalSummarySections,
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
  requestMetadata?: RequestMetadata;
}) {
  return getAppointmentAccessByToken({
    appointmentId: input.appointmentId,
    token: input.token,
    lang: input.lang,
    requestMetadata: input.requestMetadata,
    parseIntake: value => appointmentIntakeSchema.safeParse(value),
  });
}

export async function getJoinInfoByToken(input: {
  appointmentId: number;
  token: string;
  requestMetadata?: RequestMetadata;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "join_room",
    input.requestMetadata
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
