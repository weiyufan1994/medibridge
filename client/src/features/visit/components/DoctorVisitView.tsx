import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChatComposer } from "@/features/visit/components/ChatComposer";
import { DisclaimerWarningBanner } from "@/components/disclaimer/DisclaimerDialog";
import { EndConsultationDialog } from "@/features/visit/components/EndConsultationDialog";
import { TimeExceededDialog } from "@/features/visit/components/TimeExceededDialog";
import { VisitRoomHeader } from "@/features/visit/components/VisitRoomHeader";
import { VisitMessagesList } from "@/features/visit/components/VisitMessagesList";
import type { VisitSharedViewProps } from "@/features/visit/types";

type DoctorVisitViewProps = VisitSharedViewProps & {
  canOpenSummary: boolean;
  canEndConsultation: boolean;
  bypassEndConfirmation: boolean;
  endConsultationText: string;
  endConsultationTitle: string;
  endConsultationDesc: string;
  cancelText: string;
  confirmEndText: string;
  endingText: string;
  isEnding: boolean;
  onGenerateSummary: () => void;
  didJustExpire: boolean;
  canExtendTimer: boolean;
  isExtendingTimer: boolean;
  onExtendTimer: () => void;
  timeExceededTitle: string;
  timeExceededDesc: string;
  extendFiveMinsText: string;
  extendingText: string;
  endVisitDraftSummaryText: string;
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
  timerLabel,
  timerStatus,
  timerAriaLabel,
  showWarningBanner,
  warningBannerText,
  canEndConsultation,
  canOpenSummary,
  bypassEndConfirmation,
  endConsultationText,
  endConsultationTitle,
  endConsultationDesc,
  cancelText,
  confirmEndText,
  endingText,
  isEnding,
  onGenerateSummary,
  didJustExpire,
  canExtendTimer,
  isExtendingTimer,
  onExtendTimer,
  timeExceededTitle,
  timeExceededDesc,
  extendFiveMinsText,
  extendingText,
  endVisitDraftSummaryText,
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
  resolved,
}: DoctorVisitViewProps) {
  const [timeExceededOpen, setTimeExceededOpen] = useState(false);

  useEffect(() => {
    if (didJustExpire) {
      setTimeExceededOpen(true);
    }
  }, [didJustExpire]);
  const showContinueSummaryButton = bypassEndConfirmation;

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
        timerLabel={timerLabel}
        timerStatus={timerStatus}
        timerAriaLabel={timerAriaLabel}
        className="shrink-0 border-b border-slate-100 px-5 py-4"
        rightExtra={
          showContinueSummaryButton ? (
            canOpenSummary ? (
              <Button
                type="button"
                className="h-auto rounded-full bg-teal-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
                onClick={onGenerateSummary}
                disabled={isEnding}
              >
                {endConsultationText}
              </Button>
            ) : null
          ) : (
            <EndConsultationDialog
              canEndConsultation={canEndConsultation}
              endConsultationText={endConsultationText}
              endConsultationTitle={endConsultationTitle}
              endConsultationDesc={endConsultationDesc}
              cancelText={cancelText}
              confirmEndText={confirmEndText}
              endingText={endingText}
              isEnding={isEnding}
              onGenerateSummary={onGenerateSummary}
            />
          )
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
              resolved={resolved}
            />
            {showWarningBanner ? (
              <DisclaimerWarningBanner
                text={warningBannerText}
                className="mb-0 mt-0"
              />
            ) : null}
            <footer className="mt-auto shrink-0 border-t border-slate-200 bg-slate-50/80 px-3 pb-3 pt-3">
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
                  tone="embedded"
                />
              </div>
            </footer>
          </div>
        </div>
      </section>

      <TimeExceededDialog
        open={timeExceededOpen}
        onOpenChange={setTimeExceededOpen}
        title={timeExceededTitle}
        description={timeExceededDesc}
        canExtend={canExtendTimer}
        isExtending={isExtendingTimer}
        extendText={extendFiveMinsText}
        extendingText={extendingText}
        endVisitText={endVisitDraftSummaryText}
        onExtend={onExtendTimer}
        onEndVisit={onGenerateSummary}
      />
    </>
  );
}
