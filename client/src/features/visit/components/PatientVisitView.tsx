import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  showRoomClosedPrompt = false,
  roomClosedPromptTitle = "",
  roomClosedPromptDesc = "",
  roomClosedPromptActionText = backToAppointmentsText,
  onRoomClosedPromptAction,
  resolved,
}: PatientVisitViewProps) {
  const [, setLocation] = useLocation();
  const goBackToAppointments = () => setLocation("/dashboard");
  const handleClosedPromptAction = onRoomClosedPromptAction ?? goBackToAppointments;

  return (
    <div className="relative flex h-full min-h-0 flex-col rounded-2xl bg-white">
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
              resolved={resolved}
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

      {showRoomClosedPrompt ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 px-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-900">{roomClosedPromptTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{roomClosedPromptDesc}</p>
            <Button
              type="button"
              className="mt-4 h-10 w-full rounded-lg bg-teal-600 text-white hover:bg-teal-700"
              onClick={handleClosedPromptAction}
            >
              {roomClosedPromptActionText}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
