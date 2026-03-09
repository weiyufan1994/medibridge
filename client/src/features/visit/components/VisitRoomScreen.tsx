import { useRef } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import { DoctorVisitView } from "@/features/visit/components/DoctorVisitView";
import { PatientVisitView } from "@/features/visit/components/PatientVisitView";
import {
  VisitRoomErrorState,
  VisitRoomInvalidState,
  VisitRoomLoadingState,
} from "@/features/visit/components/VisitRoomStates";
import { useVisits } from "@/features/visit/hooks/useVisits";
import { useVisitRoomAccess } from "@/features/visit/hooks/useVisitRoomAccess";
import { useVisitRoomData } from "@/features/visit/hooks/useVisitRoomData";
import { useNow } from "@/features/visit/hooks/useNow";
import { useVisitRoomPresentation } from "@/features/visit/hooks/useVisitRoomPresentation";
import { getVisitCopy } from "@/features/visit/copy";
import type { VisitSharedViewProps } from "@/features/visit/types";

export function VisitRoomScreen() {
  const { resolved } = useLanguage();
  const t = getVisitCopy(resolved);
  const pageTitle = resolved === "zh" ? "线上会诊室" : "Visit Room";
  const { validInput, accessInput } = useVisitRoomAccess(resolved);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { appointmentQuery, doctorQuery, completeAppointmentMutation } =
    useVisitRoomData({
      accessInput,
      validInput,
      consultationEndedSuccessText: t.consultationEndedSuccess,
      consultationEndFailedText: t.consultationEndFailed,
    });

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
  const now = useNow();

  if (!validInput) {
    return <VisitRoomInvalidState title={pageTitle} message={t.invalidToken} />;
  }

  if (appointmentQuery.isLoading) {
    return <VisitRoomLoadingState title={pageTitle} />;
  }

  if (appointmentQuery.error || !appointmentQuery.data) {
    return (
      <VisitRoomErrorState
        title={pageTitle}
        message={appointmentQuery.error?.message || t.appointmentNotFound}
      />
    );
  }

  const appointment = appointmentQuery.data;
  const doctorData = doctorQuery.data;
  const presentation = useVisitRoomPresentation({
    resolved,
    t,
    now,
    appointment,
    doctorData: doctorData ?? null,
    role,
    currentStatus,
    canSendMessage,
    isSending,
    pollingFatalError,
  });
  const sharedViewProps: VisitSharedViewProps = {
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
    pollingFatalError,
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
  };
  const isDoctorView = presentation.isDoctorView;
  const isEnding = completeAppointmentMutation.isPending;
  const onEndConsultation = () =>
    void completeAppointmentMutation.mutateAsync({
      appointmentId: appointment.id,
      token: accessInput.token,
    });

  return (
    <AppLayout title={pageTitle}>
      <div className="flex h-full w-full bg-slate-50 px-4 py-5 md:py-7">
        <div className="mx-auto flex h-[calc(100vh-120px)] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {isDoctorView ? (
            <DoctorVisitView
              {...sharedViewProps}
              canEndConsultation={!presentation.roomClosedByStatus}
              endConsultationText={t.endConsultation}
              endConsultationTitle={t.endConsultationTitle}
              endConsultationDesc={t.endConsultationDesc}
              cancelText={t.cancel}
              confirmEndText={t.confirmEnd}
              endingText={t.ending}
              isEnding={isEnding}
              onEndConsultation={onEndConsultation}
              doctorWorkbenchTitle={presentation.doctorWorkbenchTitle}
              triageSidebarTitle={presentation.triageSidebarTitle}
              triageRecommendationTitle={presentation.triageRecommendationTitle}
              hasTriageData={presentation.hasTriageData}
              intakeItems={presentation.intakeItems}
              triageSummary={presentation.triageSummary}
              aiTriageSummaryEmpty={t.aiTriageSummaryEmpty}
            />
          ) : (
            <PatientVisitView {...sharedViewProps} />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
