import type { ReactNode } from "react";

type VisitRoomHeaderProps = {
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
  rightExtra?: ReactNode;
  className?: string;
};

export function VisitRoomHeader({
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
  rightExtra = null,
  className = "shrink-0 px-5 pb-2 pt-4",
}: VisitRoomHeaderProps) {
  return (
    <header className={className}>
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
          {rightExtra}
        </div>
      </div>
      {pollingFatalError ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">{pollingFatalError}</p>
        </div>
      ) : null}
    </header>
  );
}
