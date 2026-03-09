import { useMemo } from "react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { getLocalizedField } from "@/lib/i18n";
import { getVisitCopy } from "@/features/visit/copy";

type VisitCopy = ReturnType<typeof getVisitCopy>;

type AppointmentForView = {
  role: "patient" | "doctor";
  status: string;
  triageSummary?: string | null;
  intake?:
    | {
        chiefComplaint?: string;
        duration?: string;
        medicalHistory?: string;
        medications?: string;
        allergies?: string;
        ageGroup?: string;
        otherSymptoms?: string;
      }
    | null;
};

type DoctorDataForView = {
  doctor: {
    name?: string | null;
    nameEn?: string | null;
    title?: string | null;
    titleEn?: string | null;
  };
  department: {
    name?: string | null;
    nameEn?: string | null;
  };
} | null;

export type VisitRoomPresentationInput = {
  resolved: "en" | "zh";
  t: VisitCopy;
  now: Date;
  appointment: AppointmentForView;
  doctorData: DoctorDataForView;
  role: "patient" | "doctor" | null;
  currentStatus: string | null;
  canSendMessage: boolean;
  isSending: boolean;
  pollingFatalError: string | null;
};

function interpolateStatus(template: string, status: string) {
  return template.replace("{{status}}", status);
}

function getDoctorUiLabel(
  key:
    | "doctor.workbench"
    | "doctor.triage_summary"
    | "doctor.ai_recommendation",
  lang: "en" | "zh"
) {
  const map = {
    "doctor.workbench": lang === "zh" ? "医生工作台" : "Doctor's Workbench",
    "doctor.triage_summary": lang === "zh" ? "AI 分诊摘要" : "AI Triage Summary",
    "doctor.ai_recommendation": lang === "zh" ? "AI 建议" : "AI Recommendation",
  } as const;
  return map[key];
}

export function buildVisitRoomPresentation(input: VisitRoomPresentationInput) {
  const viewerRole = input.role ?? input.appointment.role;
  const isDoctorView = viewerRole === "doctor";

  const doctorName = input.doctorData
    ? getLocalizedField({
        lang: input.resolved,
        zh: input.doctorData.doctor.name,
        en: input.doctorData.doctor.nameEn,
        placeholder: input.t.assignedDoctorFallback,
      })
    : input.t.assignedDoctorFallback;

  const departmentName = input.doctorData
    ? getLocalizedField({
        lang: input.resolved,
        zh: input.doctorData.department.name,
        en: input.doctorData.department.nameEn,
        placeholder: input.t.departmentFallback,
      })
    : input.t.departmentFallback;

  const doctorRoleFallback = input.resolved === "zh" ? "医生" : "Doctor";
  const doctorTitle = input.doctorData
    ? getLocalizedField({
        lang: input.resolved,
        zh: input.doctorData.doctor.title,
        en: input.doctorData.doctor.titleEn,
        placeholder: doctorRoleFallback,
      })
    : doctorRoleFallback;

  const liveStatus = input.currentStatus ?? "connecting";
  const roomClosedByStatus =
    input.appointment.status === "ended" || input.appointment.status === "completed";
  const effectiveCanSendMessage = input.canSendMessage && !roomClosedByStatus;
  const composerHint = effectiveCanSendMessage
    ? input.t.composerHint
    : interpolateStatus(input.t.composerReadOnlyHint, liveStatus);
  const composerDisabled =
    input.isSending || !effectiveCanSendMessage || Boolean(input.pollingFatalError);

  const datePattern = input.resolved === "zh" ? "yyyy年M月d日 HH:mm" : "MMM d, yyyy HH:mm";
  const dateLocale = input.resolved === "zh" ? zhCN : enUS;
  const localNowText = format(input.now, datePattern, { locale: dateLocale });
  const chinaNowText = formatInTimeZone(input.now, "Asia/Shanghai", datePattern, {
    locale: dateLocale,
  });

  const consultationLiveText = input.resolved === "zh" ? "会诊进行中" : "Consultation Live";
  const doctorTitleDisplay = doctorTitle || doctorRoleFallback;
  const localTimeLabel = input.resolved === "zh" ? "当地时间" : "Local";
  const beijingTimeLabel = input.resolved === "zh" ? "北京时间" : "Beijing";
  const doctorWorkbenchTitle = getDoctorUiLabel("doctor.workbench", input.resolved);
  const triageSidebarTitle = getDoctorUiLabel("doctor.triage_summary", input.resolved);
  const triageRecommendationTitle = getDoctorUiLabel(
    "doctor.ai_recommendation",
    input.resolved
  );

  const intakeItemsRaw: Array<{ label: string; value: string | undefined }> = [
    { label: input.t.intakeChiefComplaint, value: input.appointment.intake?.chiefComplaint },
    { label: input.t.intakeDuration, value: input.appointment.intake?.duration },
    { label: input.t.intakeMedicalHistory, value: input.appointment.intake?.medicalHistory },
    { label: input.t.intakeMedications, value: input.appointment.intake?.medications },
    { label: input.t.intakeAllergies, value: input.appointment.intake?.allergies },
    { label: input.t.intakeAgeGroup, value: input.appointment.intake?.ageGroup },
    { label: input.t.intakeOtherSymptoms, value: input.appointment.intake?.otherSymptoms },
  ];
  const intakeItems = intakeItemsRaw.filter(
    (item): item is { label: string; value: string } => Boolean(item.value?.trim())
  );

  const triageSummary = input.appointment.triageSummary?.trim() || "";
  const hasTriageData = Boolean(triageSummary || intakeItems.length);

  return {
    isDoctorView,
    roomClosedByStatus,
    effectiveCanSendMessage,
    composerHint,
    composerDisabled,
    doctorName,
    departmentName,
    doctorTitleDisplay,
    consultationLiveText,
    localTimeLabel,
    localNowText,
    beijingTimeLabel,
    chinaNowText,
    doctorWorkbenchTitle,
    triageSidebarTitle,
    triageRecommendationTitle,
    intakeItems,
    triageSummary,
    hasTriageData,
  };
}

export function useVisitRoomPresentation(input: VisitRoomPresentationInput) {
  return useMemo(() => buildVisitRoomPresentation(input), [input]);
}
