import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import { trpc } from "@/lib/trpc";
import { DoctorVisitView } from "@/features/visit/components/DoctorVisitView";
import { MedicalSummaryModal } from "@/features/visit/components/MedicalSummaryModal";
import { PatientVisitView } from "@/features/visit/components/PatientVisitView";
import { TriageSummarySidebar } from "@/features/visit/components/TriageSummarySidebar";
import { shouldShowVisitRoomLoadingState } from "@/features/visit/components/visitRoomLoading";
import {
  VisitRoomErrorState,
  VisitRoomInvalidState,
  VisitRoomLoadingState,
} from "@/features/visit/components/VisitRoomStates";
import { useVisits } from "@/features/visit/hooks/useVisits";
import { useVisitRoomAccess } from "@/features/visit/hooks/useVisitRoomAccess";
import { useVisitRoomData } from "@/features/visit/hooks/useVisitRoomData";
import { useNow } from "@/features/visit/hooks/useNow";
import { useConsultationTimer } from "@/features/visit/hooks/useConsultationTimer";
import { useVisitRoomPresentation } from "@/features/visit/hooks/useVisitRoomPresentation";
import { getVisitCopy } from "@/features/visit/copy";
import type { VisitSharedViewProps } from "@/features/visit/types";
import { useLocation } from "wouter";

function resolveVisitRoomErrorMessage(input: {
  rawMessage: string | undefined;
  copy: ReturnType<typeof getVisitCopy>;
}) {
  const message = (input.rawMessage ?? "").trim();
  if (!message) {
    return input.copy.appointmentNotFound;
  }
  if (message === "TOKEN_INVALID" || message === "TOKEN_MISSING") {
    return input.copy.invalidToken;
  }
  if (message === "APPOINTMENT_NOT_FOUND") {
    return input.copy.appointmentNotFound;
  }
  if (message === "APPOINTMENT_NOT_STARTED") {
    return input.copy.appointmentNotStarted;
  }
  if (message === "APPOINTMENT_NOT_ALLOWED") {
    return input.copy.appointmentNotAllowed;
  }
  return message;
}

function isClosedStatus(status: string | null | undefined) {
  return status === "ended" || status === "completed";
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function VisitRoomScreen() {
  const { resolved } = useLanguage();
  const t = getVisitCopy(resolved);
  const pageTitle = resolved === "zh" ? "线上会诊室" : "Visit Room";
  const { validInput, accessInput } = useVisitRoomAccess(resolved);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const completeAppointmentMutation = trpc.appointments.completeAppointment.useMutation();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { appointmentQuery, doctorQuery } = useVisitRoomData({
    accessInput,
    validInput,
  });
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryFlowStarted, setSummaryFlowStarted] = useState(false);

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
    roomTimer,
    isExtendingTimer,
    setContent,
    loadOlderMessages,
    handleSend,
    requestTimerExtension,
    markRoomAsClosed,
    showInitialSkeleton,
  } = useVisits({
    accessInput: { token: accessInput.token },
    enabled: validInput,
    scrollContainerRef,
    resolved,
  });
  const now = useNow();
  const appointmentForPresentation = appointmentQuery.data ?? {
    role: "patient" as const,
    status: "",
    scheduledAt: null,
    triageSummary: null,
    intake: null,
    consultationDurationMinutes: 30,
    consultationExtensionMinutes: 0,
    consultationTotalMinutes: 30,
  };
  const baseDurationMinutes =
    roomTimer?.baseDurationMinutes ?? appointmentForPresentation.consultationDurationMinutes ?? 30;
  const extensionMinutes =
    roomTimer?.extensionMinutes ?? appointmentForPresentation.consultationExtensionMinutes ?? 0;
  const consultationTimer = useConsultationTimer({
    now,
    scheduledAt: appointmentForPresentation.scheduledAt,
    baseDurationMinutes,
    extensionMinutes,
  });
  const isWarningActive =
    consultationTimer.status === "warning" && consultationTimer.remainingSeconds > 0;

  const presentation = useVisitRoomPresentation({
    resolved,
    t,
    now,
    appointment: appointmentForPresentation,
    doctorData: doctorQuery.data ?? null,
    role,
    currentStatus,
    timerStatus: consultationTimer.status,
    canSendMessage,
    isSending,
    pollingFatalError,
  });

  useEffect(() => {
    if (
      isClosedStatus(appointmentQuery.data?.status) ||
      isClosedStatus(currentStatus)
    ) {
      setSummaryFlowStarted(true);
    }
  }, [appointmentQuery.data?.status, currentStatus]);

  if (!validInput) {
    return (
      <VisitRoomInvalidState
        title={pageTitle}
        message={t.invalidToken}
        backToAppointmentsText={t.backToAppointments}
      />
    );
  }

  if (
    shouldShowVisitRoomLoadingState({
      isLoading: appointmentQuery.isLoading,
      hasAppointmentData: Boolean(appointmentQuery.data),
    })
  ) {
    return <VisitRoomLoadingState title={pageTitle} />;
  }

  if (appointmentQuery.error || !appointmentQuery.data) {
    return (
      <VisitRoomErrorState
        title={pageTitle}
        message={resolveVisitRoomErrorMessage({
          rawMessage: appointmentQuery.error?.message,
          copy: t,
        })}
        backToAppointmentsText={t.backToAppointments}
      />
    );
  }

  const appointment = appointmentQuery.data;
  const isSummaryStage = summaryFlowStarted || presentation.roomClosedByStatus;

  const sharedViewProps: VisitSharedViewProps = {
    resolved,
    doctorName: presentation.doctorName,
    departmentName: presentation.departmentName,
    doctorTitleDisplay: presentation.doctorTitleDisplay,
    consultationLiveText: presentation.consultationLiveText,
    localTimeLabel: presentation.localTimeLabel,
    localNowText: presentation.localNowText,
    beijingTimeLabel: presentation.beijingTimeLabel,
    chinaNowText: presentation.chinaNowText,
    isReconnecting,
    reconnectingText: t.reconnecting,
    effectiveCanSendMessage: presentation.effectiveCanSendMessage,
    readOnlyText: t.readOnly,
    backToAppointmentsText: t.backToAppointments,
    pollingFatalError,
    timerLabel: consultationTimer.remainingLabel,
    timerStatus: consultationTimer.status,
    timerAriaLabel: t.timerAriaLabel.replace(
      "{{time}}",
      consultationTimer.remainingLabel
    ),
    showWarningBanner: isWarningActive,
    warningBannerText: t.fiveMinWarningBanner,
    showInitialSkeleton,
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
    composerDisabled: presentation.composerDisabled,
    isSending,
    composerPlaceholder: t.composerPlaceholder,
    composerHint: presentation.composerHint,
    onSelectAttachment: (file: File) => {
      toast.info(
        resolved === "zh"
          ? `已选择附件：${file.name}（上传功能即将开放）`
          : `Attachment selected: ${file.name} (upload will be enabled soon)`
      );
    },
    showRoomClosedPrompt: !presentation.isDoctorView && presentation.roomClosedByStatus,
    roomClosedPromptTitle: t.roomClosedReturnTitle,
    roomClosedPromptDesc: t.roomClosedReturnDesc,
    roomClosedPromptActionText: t.roomClosedReturnAction,
    onRoomClosedPromptAction: () => setLocation("/dashboard"),
  };
  const isDoctorView = presentation.isDoctorView;
  const onGenerateSummary = async () => {
    if (isSummaryStage) {
      setSummaryModalOpen(true);
      return;
    }

    try {
      await completeAppointmentMutation.mutateAsync({
        appointmentId: appointment.id,
        token: accessInput.token,
      });
      setSummaryFlowStarted(true);
      markRoomAsClosed("ended");
      await appointmentQuery.refetch();
      await Promise.all([
        utils.appointments.listMyAppointments.invalidate(),
        utils.appointments.listMine.invalidate(),
      ]);
      setSummaryModalOpen(true);
    } catch (error) {
      const errorMessage = toErrorMessage(error, t.consultationEndFailed);
      if (errorMessage === "APPOINTMENT_INVALID_STATUS_TRANSITION") {
        setSummaryFlowStarted(true);
        markRoomAsClosed("ended");
        setSummaryModalOpen(true);
        return;
      }
      toast.error(errorMessage);
    }
  };
  const onExtendTimer = () => {
    requestTimerExtension(5);
  };
  const canExtendTimer = extensionMinutes < 5;
  const endConsultationText =
    isSummaryStage
      ? t.continueSummary
      : consultationTimer.status === "expired"
        ? t.generateSummaryNow
        : t.endConsultation;

  return (
    <AppLayout title={pageTitle} isVisitRoom>
      <div className="flex h-full w-full bg-slate-50 px-4 py-4 md:px-6 md:py-6">
        {isDoctorView ? (
          <div className="mx-auto flex h-[calc(100vh-126px)] min-h-0 w-full max-w-[1240px] gap-4 md:h-[calc(100vh-148px)]">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100">
              <DoctorVisitView
                {...sharedViewProps}
                canOpenSummary
                canEndConsultation={!presentation.roomClosedByStatus}
                bypassEndConfirmation={isSummaryStage}
                endConsultationText={endConsultationText}
                endConsultationTitle={t.endConsultationTitle}
                endConsultationDesc={t.endConsultationDesc}
                cancelText={t.cancel}
                confirmEndText={t.confirmEnd}
                endingText={t.ending}
                isEnding={completeAppointmentMutation.isPending}
                onGenerateSummary={() => void onGenerateSummary()}
                didJustExpire={consultationTimer.didJustExpire}
                canExtendTimer={canExtendTimer}
                isExtendingTimer={isExtendingTimer}
                onExtendTimer={onExtendTimer}
                timeExceededTitle={t.timeExceededTitle}
                timeExceededDesc={
                  canExtendTimer ? t.timeExceededDesc : t.timeExceededDescNoExtension
                }
                extendFiveMinsText={t.extendFiveMins}
                extendingText={t.extendingTimer}
                endVisitDraftSummaryText={t.endVisitDraftSummary}
              />
            </div>

            <TriageSummarySidebar
              doctorWorkbenchTitle={presentation.doctorWorkbenchTitle}
              triageSidebarTitle={presentation.triageSidebarTitle}
              triageRecommendationTitle={presentation.triageRecommendationTitle}
              hasTriageData={presentation.hasTriageData}
              intakeItems={presentation.intakeItems}
              triageSummary={presentation.triageSummary}
              aiTriageSummaryEmpty={t.aiTriageSummaryEmpty}
            />
          </div>
        ) : (
          <div className="mx-auto flex h-[calc(100vh-126px)] min-h-0 w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100 md:h-[calc(100vh-148px)]">
            <PatientVisitView {...sharedViewProps} />
          </div>
        )}
      </div>
      {isDoctorView ? (
        <MedicalSummaryModal
          open={summaryModalOpen}
          onOpenChange={setSummaryModalOpen}
          visitId={appointment.id}
          token={accessInput.token}
          lang={resolved}
          copy={{
            title: t.reviewMedicalSummaryTitle,
            aiDisclaimer: t.medicalSummaryAIDisclaimer,
            chiefComplaintLabel: t.medicalSummaryChiefComplaint,
            hpiLabel: t.medicalSummaryHpi,
            pmhLabel: t.medicalSummaryPmh,
            assessmentLabel: t.medicalSummaryAssessment,
            planLabel: t.medicalSummaryPlan,
            cancelText: t.medicalSummaryCancel,
            regenerateText: t.medicalSummaryRegenerate,
            signText: t.medicalSummarySign,
            generatingText: t.medicalSummaryGenerating,
            signingText: t.medicalSummarySigning,
            signSuccessText: t.consultationEndedSuccess,
            draftFailedText: t.medicalSummaryDraftFailed,
            draftTimeoutText: t.medicalSummaryDraftTimeout,
            draftTimeoutHintText: t.medicalSummaryDraftTimeoutHint,
            requiredFieldsText: t.medicalSummaryRequiredFields,
            signFailedText: t.medicalSummarySignFailed,
          }}
        />
      ) : null}
    </AppLayout>
  );
}
