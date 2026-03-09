import { ChatComposer } from "@/features/visit/components/ChatComposer";
import { EndConsultationDialog } from "@/features/visit/components/EndConsultationDialog";
import { TriageSummarySidebar } from "@/features/visit/components/TriageSummarySidebar";
import { VisitRoomHeader } from "@/features/visit/components/VisitRoomHeader";
import { VisitMessagesList } from "@/features/visit/components/VisitMessagesList";
import type { VisitSharedViewProps } from "@/features/visit/types";

type IntakeItem = {
  label: string;
  value: string | undefined;
};

type DoctorVisitViewProps = VisitSharedViewProps & {
  canEndConsultation: boolean;
  endConsultationText: string;
  endConsultationTitle: string;
  endConsultationDesc: string;
  cancelText: string;
  confirmEndText: string;
  endingText: string;
  isEnding: boolean;
  onEndConsultation: () => void;
  doctorWorkbenchTitle: string;
  triageSidebarTitle: string;
  triageRecommendationTitle: string;
  hasTriageData: boolean;
  intakeItems: IntakeItem[];
  triageSummary: string;
  aiTriageSummaryEmpty: string;
};

export function DoctorVisitView({
  doctorName,
  departmentName,
  doctorTitleDisplay,
  consultationLiveText,
  localTimeLabel,
  localNowText,
  beijingTimeLabel,
  chinaNowText,
  isReconnecting,
  reconnectingText,
  effectiveCanSendMessage,
  readOnlyText,
  pollingFatalError,
  canEndConsultation,
  endConsultationText,
  endConsultationTitle,
  endConsultationDesc,
  cancelText,
  confirmEndText,
  endingText,
  isEnding,
  onEndConsultation,
  showInitialSkeleton,
  messages,
  hasMoreHistory,
  isLoadingOlder,
  onLoadOlder,
  scrollContainerRef,
  loadEarlierText,
  loadingEarlierText,
  content,
  onChangeContent,
  onSend,
  composerDisabled,
  isSending,
  composerPlaceholder,
  composerHint,
  onSelectAttachment,
  doctorWorkbenchTitle,
  triageSidebarTitle,
  triageRecommendationTitle,
  hasTriageData,
  intakeItems,
  triageSummary,
  aiTriageSummaryEmpty,
}: DoctorVisitViewProps) {
  return (
    <>
      <VisitRoomHeader
        doctorName={doctorName}
        departmentName={departmentName}
        doctorTitleDisplay={doctorTitleDisplay}
        consultationLiveText={consultationLiveText}
        localTimeLabel={localTimeLabel}
        localNowText={localNowText}
        beijingTimeLabel={beijingTimeLabel}
        chinaNowText={chinaNowText}
        isReconnecting={isReconnecting}
        reconnectingText={reconnectingText}
        effectiveCanSendMessage={effectiveCanSendMessage}
        readOnlyText={readOnlyText}
        pollingFatalError={pollingFatalError}
        className="shrink-0 border-b border-slate-100 px-5 py-4"
        rightExtra={
          <EndConsultationDialog
            canEndConsultation={canEndConsultation}
            endConsultationText={endConsultationText}
            endConsultationTitle={endConsultationTitle}
            endConsultationDesc={endConsultationDesc}
            cancelText={cancelText}
            confirmEndText={confirmEndText}
            endingText={endingText}
            isEnding={isEnding}
            onEndConsultation={onEndConsultation}
          />
        }
      />

      <section className="min-h-0 flex-1">
        <div className="flex h-full min-h-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <VisitMessagesList
              showInitialSkeleton={showInitialSkeleton}
              rightAlignRole="doctor"
              messages={messages}
              hasMoreHistory={hasMoreHistory}
              isLoadingOlder={isLoadingOlder}
              onLoadOlder={onLoadOlder}
              scrollContainerRef={scrollContainerRef}
              loadEarlierText={loadEarlierText}
              loadingEarlierText={loadingEarlierText}
            />
            <footer className="mt-auto shrink-0 bg-slate-50/50 pt-3">
              <div className="mx-auto w-full max-w-3xl">
                <ChatComposer
                  value={content}
                  onChange={onChangeContent}
                  onSend={onSend}
                  disabled={composerDisabled}
                  isSending={isSending}
                  placeholder={composerPlaceholder}
                  hint={composerHint}
                  onSelectAttachment={onSelectAttachment}
                />
              </div>
            </footer>
          </div>

          <TriageSummarySidebar
            doctorWorkbenchTitle={doctorWorkbenchTitle}
            triageSidebarTitle={triageSidebarTitle}
            triageRecommendationTitle={triageRecommendationTitle}
            hasTriageData={hasTriageData}
            intakeItems={intakeItems}
            triageSummary={triageSummary}
            aiTriageSummaryEmpty={aiTriageSummaryEmpty}
          />
        </div>
      </section>
    </>
  );
}
