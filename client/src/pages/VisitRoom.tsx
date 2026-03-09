import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import AppLayout from "@/components/layout/AppLayout";
import { useVisits } from "@/features/visit/hooks/useVisits";
import { getVisitCopy } from "@/features/visit/copy";
import { DoctorView } from "@/pages/DoctorView";
import { PatientView } from "@/pages/PatientView";

function parseTokenFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("t")?.trim() || "";
}

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

export default function VisitRoomPage() {
  const { resolved } = useLanguage();
  const t = getVisitCopy(resolved);
  const pageTitle = resolved === "zh" ? "线上会诊室" : "Visit Room";
  const [, params] = useRoute<{ id: string }>("/visit/:id");
  const appointmentId = Number(params?.id ?? NaN);
  const token = parseTokenFromLocation();
  const validInput =
    Number.isInteger(appointmentId) && appointmentId > 0 && token.length >= 16;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const accessInput = useMemo(
    () => ({
      appointmentId: validInput ? appointmentId : 1,
      token: validInput ? token : "invalid-token-000",
      lang: resolved,
    }),
    [appointmentId, token, validInput, resolved]
  );

  const appointmentQuery = trpc.appointments.getByToken.useQuery(accessInput, {
    enabled: validInput,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const utils = trpc.useUtils();
  const completeAppointmentMutation = trpc.appointments.completeAppointment.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.appointments.getByToken.invalidate(accessInput),
        utils.appointments.listMyAppointments.invalidate(),
        utils.appointments.listMine.invalidate(),
        utils.visit.roomGetMessages.invalidate({ token: accessInput.token, limit: 50 }),
      ]);
      toast.success(t.consultationEndedSuccess);
    },
    onError: error => {
      toast.error(error.message || t.consultationEndFailed);
    },
  });

  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: appointmentQuery.data?.doctorId ?? 0 },
    {
      enabled: Boolean(appointmentQuery.data?.doctorId),
      retry: 1,
    }
  );

  const {
    content,
    isReconnecting,
    messages,
    hasMoreHistory,
    isLoadingOlder,
    pollingFatalError,
    isSending,
    role,
    currentStatus,
    canSendMessage,
    setContent,
    loadOlderMessages,
    handleSend,
    showInitialSkeleton,
  } = useVisits({
    accessInput: { token: accessInput.token },
    enabled: validInput,
    scrollContainerRef,
    resolved,
  });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!validInput) {
    return (
      <AppLayout title={pageTitle}>
        <div className="mx-auto max-w-3xl py-4">
          <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
            {t.invalidToken}
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (appointmentQuery.isLoading) {
    return (
      <AppLayout title={pageTitle}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (appointmentQuery.error || !appointmentQuery.data) {
    return (
      <AppLayout title={pageTitle}>
        <div className="mx-auto max-w-3xl py-4">
          <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
            {appointmentQuery.error?.message || t.appointmentNotFound}
          </Card>
        </div>
      </AppLayout>
    );
  }

  const appointment = appointmentQuery.data;
  const doctorData = doctorQuery.data;
  const viewerRole = role ?? appointment.role;
  const isDoctorView = viewerRole === "doctor";

  const doctorName = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.doctor.name,
        en: doctorData.doctor.nameEn,
        placeholder: t.assignedDoctorFallback,
      })
    : t.assignedDoctorFallback;
  const departmentName = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.department.name,
        en: doctorData.department.nameEn,
        placeholder: t.departmentFallback,
      })
    : t.departmentFallback;
  const doctorRoleFallback = resolved === "zh" ? "医生" : "Doctor";
  const doctorTitle = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.doctor.title,
        en: doctorData.doctor.titleEn,
        placeholder: doctorRoleFallback,
      })
    : doctorRoleFallback;

  const liveStatus = currentStatus ?? "connecting";
  const roomClosedByStatus = appointment.status === "ended";
  const effectiveCanSendMessage = canSendMessage && !roomClosedByStatus;
  const composerHint = effectiveCanSendMessage
    ? t.composerHint
    : interpolateStatus(t.composerReadOnlyHint, liveStatus);
  const composerDisabled =
    isSending || !effectiveCanSendMessage || Boolean(pollingFatalError);

  const datePattern = resolved === "zh" ? "yyyy年M月d日 HH:mm" : "MMM d, yyyy HH:mm";
  const dateLocale = resolved === "zh" ? zhCN : enUS;
  const localNowText = format(now, datePattern, { locale: dateLocale });
  const chinaNowText = formatInTimeZone(now, "Asia/Shanghai", datePattern, {
    locale: dateLocale,
  });

  const consultationLiveText = resolved === "zh" ? "会诊进行中" : "Consultation Live";
  const doctorTitleDisplay = doctorTitle || doctorRoleFallback;
  const localTimeLabel = resolved === "zh" ? "当地时间" : "Local";
  const beijingTimeLabel = resolved === "zh" ? "北京时间" : "Beijing";
  const doctorWorkbenchTitle = getDoctorUiLabel("doctor.workbench", resolved);
  const triageSidebarTitle = getDoctorUiLabel("doctor.triage_summary", resolved);
  const triageRecommendationTitle = getDoctorUiLabel(
    "doctor.ai_recommendation",
    resolved
  );

  const intakeItemsRaw: Array<{ label: string; value: string | undefined }> = [
    { label: t.intakeChiefComplaint, value: appointment.intake?.chiefComplaint },
    { label: t.intakeDuration, value: appointment.intake?.duration },
    { label: t.intakeMedicalHistory, value: appointment.intake?.medicalHistory },
    { label: t.intakeMedications, value: appointment.intake?.medications },
    { label: t.intakeAllergies, value: appointment.intake?.allergies },
    { label: t.intakeAgeGroup, value: appointment.intake?.ageGroup },
    { label: t.intakeOtherSymptoms, value: appointment.intake?.otherSymptoms },
  ];
  const intakeItems = intakeItemsRaw.filter(
    (item): item is { label: string; value: string } => Boolean(item.value?.trim())
  );

  const triageSummary = appointment.triageSummary?.trim() || "";
  const hasTriageData = Boolean(triageSummary || intakeItems.length);

  const sharedViewProps = {
    doctorName,
    departmentName,
    doctorTitleDisplay,
    consultationLiveText,
    localTimeLabel,
    localNowText,
    beijingTimeLabel,
    chinaNowText,
    isReconnecting,
    reconnectingText: t.reconnecting,
    effectiveCanSendMessage,
    readOnlyText: t.readOnly,
    pollingFatalError,
    showInitialSkeleton,
    viewerRole,
    messages,
    hasMoreHistory,
    isLoadingOlder,
    onLoadOlder: () => void loadOlderMessages(),
    scrollContainerRef,
    loadEarlierText: t.loadEarlierMessages,
    loadingEarlierText: t.loadingEarlierMessages,
    content,
    onChangeContent: setContent,
    onSend: () => void handleSend(),
    composerDisabled,
    isSending,
    composerPlaceholder: t.composerPlaceholder,
    composerHint,
    onSelectAttachment: (file: File) => {
      toast.info(
        resolved === "zh"
          ? `已选择附件：${file.name}（上传功能即将开放）`
          : `Attachment selected: ${file.name} (upload will be enabled soon)`
      );
    },
  };

  return (
    <AppLayout title={pageTitle}>
      <div className="flex h-full w-full bg-slate-50 px-4 py-5 md:py-7">
        <div className="mx-auto flex h-[calc(100vh-120px)] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {isDoctorView ? (
            <DoctorView
              {...sharedViewProps}
              canEndConsultation={!roomClosedByStatus}
              endConsultationText={t.endConsultation}
              endConsultationTitle={t.endConsultationTitle}
              endConsultationDesc={t.endConsultationDesc}
              cancelText={t.cancel}
              confirmEndText={t.confirmEnd}
              endingText={t.ending}
              isEnding={completeAppointmentMutation.isPending}
              onEndConsultation={() =>
                void completeAppointmentMutation.mutateAsync({
                  appointmentId: appointment.id,
                  token: accessInput.token,
                })
              }
              doctorWorkbenchTitle={doctorWorkbenchTitle}
              triageSidebarTitle={triageSidebarTitle}
              triageRecommendationTitle={triageRecommendationTitle}
              hasTriageData={hasTriageData}
              intakeItems={intakeItems}
              triageSummary={triageSummary}
              aiTriageSummaryEmpty={t.aiTriageSummaryEmpty}
            />
          ) : (
            <PatientView {...sharedViewProps} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
