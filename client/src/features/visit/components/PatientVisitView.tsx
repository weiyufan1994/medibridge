import { ChatComposer } from "@/features/visit/components/ChatComposer";
import { VisitRoomHeader } from "@/features/visit/components/VisitRoomHeader";
import { VisitMessagesList } from "@/features/visit/components/VisitMessagesList";
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
  isReconnecting,
  reconnectingText,
  effectiveCanSendMessage,
  readOnlyText,
  pollingFatalError,
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
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl bg-white">
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
            <footer className="mt-auto shrink-0 px-3 pb-3 pt-2">
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
            </footer>
          </div>
        </div>
      </section>
    </div>
  );
}
