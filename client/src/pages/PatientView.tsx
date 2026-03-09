import type { RefObject } from "react";
import { ChatComposer } from "@/features/visit/components/ChatComposer";
import { VisitMessagesList } from "@/features/visit/components/VisitMessagesList";
import type { VisitMessageItem, VisitParticipantRole } from "@/features/visit/types";

type PatientViewProps = {
  doctorName: string;
  departmentName: string;
  doctorTitleDisplay: string;
  consultationLiveText: string;
  localTimeLabel: string;
  localNowText: string;
  beijingTimeLabel: string;
  chinaNowText: string;
  isReconnecting: boolean;
  reconnectingText: string;
  effectiveCanSendMessage: boolean;
  readOnlyText: string;
  pollingFatalError: string | null;
  showInitialSkeleton: boolean;
  viewerRole: VisitParticipantRole;
  messages: VisitMessageItem[];
  hasMoreHistory: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  loadEarlierText: string;
  loadingEarlierText: string;
  content: string;
  onChangeContent: (value: string) => void;
  onSend: () => void;
  composerDisabled: boolean;
  isSending: boolean;
  composerPlaceholder: string;
  composerHint: string;
  onSelectAttachment: (file: File) => void;
};

export function PatientView({
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
  viewerRole,
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
}: PatientViewProps) {
  return (
    <>
      <header className="shrink-0 px-5 pb-2 pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">{doctorName}</p>
              <span className="inline-flex whitespace-nowrap items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <span className="animate-pulse">●</span>
                {consultationLiveText}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {departmentName}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {doctorTitleDisplay}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <p className="text-[11px] text-slate-400">
              {localTimeLabel}: {localNowText}
            </p>
            <p className="text-[11px] text-slate-400">
              {beijingTimeLabel}: {chinaNowText}
            </p>
            {isReconnecting ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                {reconnectingText}
              </span>
            ) : null}
            {!effectiveCanSendMessage ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] text-slate-600">
                {readOnlyText}
              </span>
            ) : null}
          </div>
        </div>
        {pollingFatalError ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-900">{pollingFatalError}</p>
          </div>
        ) : null}
      </header>

      <section className="min-h-0 flex-1">
        <div className="flex h-full min-h-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <VisitMessagesList
              showInitialSkeleton={showInitialSkeleton}
              viewerRole={viewerRole}
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
        </div>
      </section>
    </>
  );
}
