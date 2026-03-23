import { useMemo } from "react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { getLocalizedTextWithZhFallback } from "@/lib/i18n";
import { getVisitCopy } from "@/features/visit/copy";
import type { ConsultationTimerStatus } from "@/features/visit/types";
import type { LocalizedText } from "@shared/types";

type VisitCopy = ReturnType<typeof getVisitCopy>;
const DATE_PATTERN_BY_LANGUAGE = {
  en: "MMM d, yyyy HH:mm",
  zh: "yyyy年M月d日 HH:mm",
} as const;

const DATE_LOCALE_BY_LANGUAGE = {
  en: enUS,
  zh: zhCN,
} as const;

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
    name?: LocalizedText | null;
    title?: LocalizedText | null;
  };
  department: {
    name?: LocalizedText | null;
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
  timerStatus: ConsultationTimerStatus;
  canSendMessage: boolean;
  isSending: boolean;
  pollingFatalError: string | null;
};

function isClosedStatus(status: string | null | undefined) {
  return status === "ended" || status === "completed";
}

function getConsultationStatusText(input: {
  t: VisitCopy;
  roomClosedByStatus: boolean;
  timerStatus: ConsultationTimerStatus;
}) {
  if (input.roomClosedByStatus) {
    return input.t.consultationEnded;
  }
  if (input.timerStatus === "expired") {
    return input.t.consultationTimeExceeded;
  }
  return input.t.consultationLive;
}

export function buildVisitRoomPresentation(input: VisitRoomPresentationInput) {
  const viewerRole = input.role ?? input.appointment.role;
  const isDoctorView = viewerRole === "doctor";

  const doctorName = input.doctorData
    ? getLocalizedTextWithZhFallback({
        lang: input.resolved,
        value: input.doctorData.doctor.name,
        placeholder: input.t.assignedDoctorFallback,
      })
    : input.t.assignedDoctorFallback;

  const departmentName = input.doctorData
    ? getLocalizedTextWithZhFallback({
        lang: input.resolved,
        value: input.doctorData.department.name,
        placeholder: input.t.departmentFallback,
      })
    : input.t.departmentFallback;

  const doctorRoleFallback = input.t.doctorRoleFallback;
  const doctorTitle = input.doctorData
    ? getLocalizedTextWithZhFallback({
        lang: input.resolved,
        value: input.doctorData.doctor.title,
        placeholder: doctorRoleFallback,
      })
    : doctorRoleFallback;

  const roomClosedByStatus =
    isClosedStatus(input.appointment.status) || isClosedStatus(input.currentStatus);
  const effectiveCanSendMessage = input.canSendMessage && !roomClosedByStatus;
  const composerHint = effectiveCanSendMessage
    ? input.t.composerHint
    : input.t.composerReadOnlyHint;
  const composerDisabled =
    input.isSending || !effectiveCanSendMessage || Boolean(input.pollingFatalError);

  const datePattern = DATE_PATTERN_BY_LANGUAGE[input.resolved];
  const dateLocale = DATE_LOCALE_BY_LANGUAGE[input.resolved];
  const localNowText = format(input.now, datePattern, { locale: dateLocale });
  const chinaNowText = formatInTimeZone(input.now, "Asia/Shanghai", datePattern, {
    locale: dateLocale,
  });

  const consultationLiveText = getConsultationStatusText({
    t: input.t,
    roomClosedByStatus,
    timerStatus: input.timerStatus,
  });
  const doctorTitleDisplay = doctorTitle || doctorRoleFallback;
  const localTimeLabel = input.t.localTimeLabelShort;
  const beijingTimeLabel = input.t.beijingTimeLabelShort;
  const doctorWorkbenchTitle = input.t.doctorWorkbenchTitle;
  const triageSidebarTitle = input.t.triageSidebarTitle;
  const triageRecommendationTitle = input.t.triageRecommendationTitle;

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
