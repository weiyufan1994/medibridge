import { ArrowLeft } from "lucide-react";
import { ChatComposer } from "@/features/visit/components/ChatComposer";
import { VisitRoomHeader } from "@/features/visit/components/VisitRoomHeader";
import { VisitMessagesList } from "@/features/visit/components/VisitMessagesList";
import { useLocation } from "wouter";
import type { VisitSharedViewProps } from "@/features/visit/types";

type PatientVisitViewProps = VisitSharedViewProps;

export function PatientVisitView({
  doctorName,
  departmentName,
  doctorTitleDisplay,
  consultationLiveText,
  localTimeLabel,
  localNowText,
  beijingTimeLabel,
  chinaNowText,
  backToAppointmentsText,
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
}: PatientVisitViewProps) {
  const [, setLocation] = useLocation();
  const goBackToAppointments = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/dashboard");
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl bg-white">
      <div className="px-5 pt-4">
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600 transition-colors mb-4 w-fit cursor-pointer"
          onClick={goBackToAppointments}
          aria-label={backToAppointmentsText}
        >
          <ArrowLeft className="h-4 w-4" />
          {backToAppointmentsText}
        </button>
      </div>
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
        showReadOnlyTag={false}
        className="shrink-0 px-5 pb-2 pt-0"
      />

      <section className="min-h-0 flex-1">
        <div className="flex h-full min-h-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <VisitMessagesList
              showInitialSkeleton={showInitialSkeleton}
              rightAlignRole="patient"
              messages={messages}
              hasMoreHistory={hasMoreHistory}
              isLoadingOlder={isLoadingOlder}
              onLoadOlder={onLoadOlder}
              scrollContainerRef={scrollContainerRef}
              loadEarlierText={loadEarlierText}
              loadingEarlierText={loadingEarlierText}
            />
            {showWarningBanner ? (
              <div
                role="status"
                aria-live="polite"
                className="border-t border-amber-100 bg-amber-50/90 px-4 py-2 text-center text-xs text-amber-700 backdrop-blur-sm"
              >
                {warningBannerText}
              </div>
            ) : null}
            <footer className="mt-auto shrink-0 border-t border-slate-200 bg-slate-50/80 px-3 pb-3 pt-3">
              <ChatComposer
                value={content}
                onChange={onChangeContent}
                onSend={onSend}
                disabled={composerDisabled}
                isSending={isSending}
                placeholder={composerPlaceholder}
                hint={composerHint}
                onSelectAttachment={onSelectAttachment}
                readOnlyMode={!effectiveCanSendMessage}
                tone="embedded"
              />
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}
