import { TRPCError } from "@trpc/server";
import * as aiRepo from "../ai/repo";
import * as appointmentsRepo from "./repo";
import { resolveBoundDoctorIdForUser } from "../doctorAccounts/actions";
import {
  getAppointmentByIdOrThrow,
  getSessionEmailFromContext,
} from "./accessValidation";
import { localizeTriageContent, parseIntakeFromNotes } from "./accessQueryActions";
import { resolveConsultationTimerState } from "./consultationTimer";
import {
  classifyMyAppointments,
  toMyAppointmentItem,
  toPublicAppointment,
} from "./serializers";
import { appointmentIntakeSchema } from "./schemas";
import type { TrpcContext } from "../../_core/context";

export async function listMineAppointments(input: {
  userId: number;
  email: string | null;
  limit: number;
}) {
  const appointmentRows = await appointmentsRepo.listAppointmentsByUserScope({
    userId: input.userId,
    email: input.email,
    limit: input.limit,
  });
  return appointmentRows.map(toPublicAppointment);
}

export async function listMyAppointmentsByContext(ctx: TrpcContext) {
  const userEmail = ctx.user?.email?.trim().toLowerCase();

  let rows: Awaited<ReturnType<typeof appointmentsRepo.listAppointmentsByEmail>> = [];
  if (ctx.user) {
    rows = await appointmentsRepo.listAppointmentsByUserOrEmail({
      userId: ctx.user.id,
      email: userEmail,
    });
  } else {
    const sessionEmail = getSessionEmailFromContext(ctx);
    if (!sessionEmail) {
      return { upcoming: [], completed: [], past: [] };
    }
    rows = await appointmentsRepo.listAppointmentsByEmail(sessionEmail);
  }

  return classifyMyAppointments(rows.map(toMyAppointmentItem));
}

export async function getAppointmentStatus(input: { appointmentId: number }) {
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  return {
    appointmentId: appointment.id,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    stripeSessionId: appointment.stripeSessionId ?? null,
    paidAt: appointment.paidAt ?? null,
  };
}

function extractPackageId(notes: string | null | undefined) {
  const normalized = notes?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as { packageId?: unknown };
    return typeof parsed.packageId === "string" ? parsed.packageId : null;
  } catch {
    return null;
  }
}

function assertDoctorOwnsAppointment(input: {
  doctorId: number;
  appointmentDoctorId: number;
}) {
  if (input.doctorId !== input.appointmentDoctorId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Appointment does not belong to the current doctor workbench",
    });
  }
}

function canDoctorStartAppointment(status: string, paymentStatus: string) {
  return status === "paid" && paymentStatus === "paid";
}

function canDoctorOpenRoom(status: string, paymentStatus: string) {
  return paymentStatus === "paid" && ["paid", "active", "ended", "completed"].includes(status);
}

function canDoctorCompleteAppointment(status: string, paymentStatus: string) {
  return paymentStatus === "paid" && ["paid", "active"].includes(status);
}

export async function listDoctorWorkbenchAppointments(input: {
  doctorId?: number;
  limit: number;
  currentUserId: number;
  currentUserRole?: string | null;
}) {
  const doctorId = await resolveBoundDoctorIdForUser({
    userId: input.currentUserId,
    allowAdminDoctorId: input.doctorId,
    userRole: input.currentUserRole,
  });
  const rows = await appointmentsRepo.listAppointmentsByDoctor({
    doctorId,
    limit: input.limit,
  });
  const now = Date.now();

  const items = rows.map(row => {
    const intake = parseIntakeFromNotes(row.notes, value =>
      appointmentIntakeSchema.safeParse(value)
    );

    return {
      id: row.id,
      slotId: row.slotId ?? null,
      doctorId,
      appointmentType: row.appointmentType,
      scheduledAt: row.scheduledAt,
      status: row.status,
      paymentStatus: row.paymentStatus,
      patientEmail: row.email,
      chiefComplaint: intake?.chiefComplaint?.trim() || null,
      packageId: extractPackageId(row.notes),
      createdAt: row.createdAt,
    };
  });

  return {
    upcoming: items.filter(item => {
      const scheduledAt = item.scheduledAt?.getTime() ?? 0;
      return scheduledAt >= now && ["pending_payment", "paid", "active"].includes(item.status);
    }),
    recent: items
      .filter(item => {
        const scheduledAt = item.scheduledAt?.getTime() ?? 0;
        return scheduledAt < now || ["ended", "completed", "canceled", "expired"].includes(item.status);
      })
      .slice(0, 10),
  };
}

export async function getDoctorWorkbenchAppointmentDetail(input: {
  appointmentId: number;
  doctorId?: number;
  lang: "en" | "zh";
  currentUserId: number;
  currentUserRole?: string | null;
}) {
  const doctorId = await resolveBoundDoctorIdForUser({
    userId: input.currentUserId,
    allowAdminDoctorId: input.doctorId,
    userRole: input.currentUserRole,
  });
  const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
  assertDoctorOwnsAppointment({
    doctorId,
    appointmentDoctorId: appointment.doctorId,
  });

  const triageSession = await aiRepo.getAiChatSessionById(appointment.triageSessionId);
  const intake = parseIntakeFromNotes(appointment.notes, value =>
    appointmentIntakeSchema.safeParse(value)
  );
  const localizedTriage = await localizeTriageContent({
    summary: triageSession?.summary ?? null,
    intake,
    targetLang: input.lang,
  });
  const medicalSummary = await appointmentsRepo.getMedicalSummaryByAppointmentId(appointment.id);
  const timer = resolveConsultationTimerState(appointment.notes);

  return {
    ...toPublicAppointment(appointment),
    patient: {
      email: appointment.email,
      sessionId: appointment.sessionId,
    },
    triageSummary: localizedTriage.summary,
    intake: localizedTriage.intake,
    medicalSummary: medicalSummary
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
    packageId: extractPackageId(appointment.notes),
    consultationDurationMinutes: timer.baseDurationMinutes,
    consultationExtensionMinutes: timer.extensionMinutes,
    consultationTotalMinutes: timer.totalDurationMinutes,
    canStartConsultation: canDoctorStartAppointment(appointment.status, appointment.paymentStatus),
    canOpenRoom: canDoctorOpenRoom(appointment.status, appointment.paymentStatus),
    canCompleteConsultation: canDoctorCompleteAppointment(
      appointment.status,
      appointment.paymentStatus
    ),
    hasSignedMedicalSummary: Boolean(medicalSummary?.signedBy),
  };
}
