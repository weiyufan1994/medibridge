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
};

export function TriageSummarySidebar({
  doctorWorkbenchTitle,
  triageSidebarTitle,
  triageRecommendationTitle,
  hasTriageData,
  intakeItems,
  triageSummary,
  aiTriageSummaryEmpty,
}: TriageSummarySidebarProps) {
  return (
    <aside className="hidden h-full w-80 shrink-0 overflow-y-auto border-l border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 lg:block">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {doctorWorkbenchTitle}
      </p>
      <h3 className="mt-1 text-sm font-semibold text-slate-900">{triageSidebarTitle}</h3>

      <div className="mt-4 space-y-3">
        {hasTriageData ? (
          <>
            {intakeItems.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
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
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="font-medium text-slate-500">{triageRecommendationTitle}</p>
                <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-slate-800">
                  {triageSummary}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-3 text-slate-500">
            {aiTriageSummaryEmpty}
          </p>
        )}
      </div>
    </aside>
  );
}
