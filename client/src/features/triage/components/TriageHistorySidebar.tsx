import { MessageSquare, PanelLeft, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export type TriageHistoryItem = {
  id: number;
  title: string;
  status: "active" | "completed";
  group: "today" | "previous7" | "older";
};

function HistoryItemList(props: {
  items: TriageHistoryItem[];
  activeSessionId: number | null;
  onSelect: (sessionId: number) => void;
}) {
  return (
    <div className="space-y-1">
      {props.items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => props.onSelect(item.id)}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
            props.activeSessionId === item.id
              ? "bg-teal-100/80 text-teal-800"
              : "text-slate-700 hover:bg-slate-100/70"
          }`}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.title}</span>
        </button>
      ))}
    </div>
  );
}

function HistoryGroup(props: {
  label: string;
  items: TriageHistoryItem[];
  activeSessionId: number | null;
  onSelect: (sessionId: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
        {props.label}
      </p>
      <HistoryItemList
        items={props.items}
        activeSessionId={props.activeSessionId}
        onSelect={props.onSelect}
      />
    </div>
  );
}

export function TriageHistorySidebar(props: {
  open: boolean;
  activeSessionId: number | null;
  todayItems: TriageHistoryItem[];
  previousItems: TriageHistoryItem[];
  olderItems: TriageHistoryItem[];
  historyCount: number;
  isLoading: boolean;
  hasError: boolean;
  onNewSession: () => void;
  onClose: () => void;
  onSelect: (sessionId: number) => void;
  labels: {
    newSession: string;
    today: string;
    previous7Days: string;
    older: string;
    empty: string;
    loadFailed: string;
  };
}) {
  return (
    <aside
      className={`h-full flex-shrink-0 overflow-hidden bg-slate-50 transition-[width] duration-300 ease-in-out ${
        props.open
          ? "w-[260px] border-r border-slate-200/60"
          : "w-0 border-none"
      }`}
    >
      <div className="flex h-full w-[260px] flex-col whitespace-nowrap p-4">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={props.onNewSession}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Plus className="h-4 w-4" />
            {props.labels.newSession}
          </button>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 hover:text-slate-700"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto">
          <div>
            <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              {props.labels.today}
            </p>
            {props.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="mb-2 h-10 w-full rounded-lg" />
                <Skeleton className="mb-2 h-10 w-full rounded-lg" />
                <Skeleton className="mb-2 h-10 w-full rounded-lg" />
                <Skeleton className="mb-2 h-10 w-full rounded-lg" />
              </div>
            ) : props.hasError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-800">
                {props.labels.loadFailed}
              </div>
            ) : (
              <HistoryItemList
                items={props.todayItems}
                activeSessionId={props.activeSessionId}
                onSelect={props.onSelect}
              />
            )}
          </div>

          {!props.isLoading && (
            <HistoryGroup
              label={props.labels.previous7Days}
              items={props.previousItems}
              activeSessionId={props.activeSessionId}
              onSelect={props.onSelect}
            />
          )}

          {!props.isLoading && (
            <HistoryGroup
              label={props.labels.older}
              items={props.olderItems}
              activeSessionId={props.activeSessionId}
              onSelect={props.onSelect}
            />
          )}

          {!props.isLoading && props.historyCount === 0 && (
            <div className="flex h-full items-center justify-center px-2 py-8">
              <p className="text-center text-sm text-slate-500">
                {props.labels.empty}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
