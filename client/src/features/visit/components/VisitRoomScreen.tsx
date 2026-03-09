import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import { DoctorVisitView } from "@/features/visit/components/DoctorVisitView";
import { MedicalSummaryModal } from "@/features/visit/components/MedicalSummaryModal";
import { PatientVisitView } from "@/features/visit/components/PatientVisitView";
import { TriageSummarySidebar } from "@/features/visit/components/TriageSummarySidebar";
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
  const { appointmentQuery, doctorQuery } = useVisitRoomData({
    accessInput,
    validInput,
  });
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);

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
  const appointmentForPresentation = appointmentQuery.data ?? {
    role: "patient" as const,
    status: "",
    triageSummary: null,
    intake: null,
  };

  const presentation = useVisitRoomPresentation({
    resolved,
    t,
    now,
    appointment: appointmentForPresentation,
    doctorData: doctorQuery.data ?? null,
    role,
    currentStatus,
    canSendMessage,
    isSending,
    pollingFatalError,
  });

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
  const onGenerateSummary = () => setSummaryModalOpen(true);

  return (
    <AppLayout title={pageTitle}>
      <div className="flex h-full w-full bg-slate-50 px-4 py-4 md:px-6 md:py-6">
        {isDoctorView ? (
          <div className="mx-auto flex h-[calc(100vh-126px)] min-h-0 w-full max-w-[1240px] gap-4 md:h-[calc(100vh-148px)]">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-1 ring-slate-100">
              <DoctorVisitView
                {...sharedViewProps}
                canEndConsultation={!presentation.roomClosedByStatus}
                endConsultationText={t.endConsultation}
                endConsultationTitle={t.endConsultationTitle}
                endConsultationDesc={t.endConsultationDesc}
                cancelText={t.cancel}
                confirmEndText={t.confirmEnd}
                endingText={t.ending}
                isEnding={false}
                onGenerateSummary={onGenerateSummary}
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
            signFailedText: t.medicalSummarySignFailed,
          }}
        />
      ) : null}
    </AppLayout>
  );
}
