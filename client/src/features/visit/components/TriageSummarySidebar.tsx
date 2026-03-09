import { cn } from "@/lib/utils";

type IntakeItem = {
  label: string;
  value: string | undefined;
};

type TriageSummarySidebarProps = {
  doctorWorkbenchTitle: string;
  triageSidebarTitle: string;
  triageRecommendationTitle: string;
  hasTriageData: boolean;
  intakeItems: IntakeItem[];
  triageSummary: string;
  aiTriageSummaryEmpty: string;
  className?: string;
};

export function TriageSummarySidebar({
  doctorWorkbenchTitle,
  triageSidebarTitle,
  triageRecommendationTitle,
  hasTriageData,
  intakeItems,
  triageSummary,
  aiTriageSummaryEmpty,
  className,
}: TriageSummarySidebarProps) {
  return (
    <aside
      className={cn(
        "hidden h-full w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white text-xs text-slate-700 shadow-md ring-1 ring-slate-100 lg:flex",
        className
      )}
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {doctorWorkbenchTitle}
        </p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">{triageSidebarTitle}</h3>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {hasTriageData ? (
            <>
              {intakeItems.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  {intakeItems.map(item => (
                    <div key={item.label}>
                      <p className="font-medium text-slate-500">{item.label}</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-800">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {triageSummary ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-500">{triageRecommendationTitle}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-slate-800">
                    {triageSummary}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-500">
              {aiTriageSummaryEmpty}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
