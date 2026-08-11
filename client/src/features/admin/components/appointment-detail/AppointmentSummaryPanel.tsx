import { Button } from "@/components/ui/button";
import type {
  ExportSummaryPdfMutation,
  GenerateSummaryMutation,
  VisitSummaryQuery,
} from "@/features/admin/types";

type AppointmentSummaryPanelProps = {
  tr: (zh: string, en: string) => string;
  appointmentId: number;
  generateSummaryMutation: GenerateSummaryMutation;
  exportSummaryPdfMutation: ExportSummaryPdfMutation;
  visitSummaryQuery: VisitSummaryQuery;
};

export function AppointmentSummaryPanel({
  tr,
  appointmentId,
  generateSummaryMutation,
  exportSummaryPdfMutation,
  visitSummaryQuery,
}: AppointmentSummaryPanelProps) {
  return (
    <div className="space-y-2 rounded border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {tr("会后总结（中/英）", "Post-Visit Summary (ZH/EN)")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              generateSummaryMutation.mutate({
                appointmentId,
                forceRegenerate: true,
              })
            }
            disabled={generateSummaryMutation.isPending}
          >
            {generateSummaryMutation.isPending
              ? tr("生成中...", "Generating...")
              : tr("生成总结", "Generate Summary")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              exportSummaryPdfMutation.mutate({ appointmentId, lang: "zh" })
            }
            disabled={exportSummaryPdfMutation.isPending}
          >
            {tr("导出中文 PDF", "Export ZH PDF")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              exportSummaryPdfMutation.mutate({ appointmentId, lang: "en" })
            }
            disabled={exportSummaryPdfMutation.isPending}
          >
            {tr("导出英文 PDF", "Export EN PDF")}
          </Button>
        </div>
      </div>
      {visitSummaryQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">
          {tr("正在加载总结...", "Loading summary...")}
        </p>
      ) : visitSummaryQuery.data ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="rounded bg-admin-surface-muted p-2">
            <p className="mb-1 text-xs font-medium text-foreground">
              {tr("中文", "Chinese")}
            </p>
            <pre className="overflow-auto whitespace-pre-wrap text-xs">
              {visitSummaryQuery.data.summary.zh}
            </pre>
          </div>
          <div className="rounded bg-admin-surface-muted p-2">
            <p className="mb-1 text-xs font-medium text-foreground">
              {tr("English", "English")}
            </p>
            <pre className="overflow-auto whitespace-pre-wrap text-xs">
              {visitSummaryQuery.data.summary.en}
            </pre>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {tr("尚未生成总结。", "No summary generated yet.")}
        </p>
      )}
    </div>
  );
}
