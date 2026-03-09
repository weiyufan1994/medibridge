import { Button } from "@/components/ui/button";
import { formatDate, formatMoneyFromMinorUnit } from "@/features/admin/utils/adminFormatting";
import type { AdminSuggestion } from "@/features/admin/risk";
import type { AppointmentDetailData } from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type OverviewSectionProps = {
  tr: TranslateFn;
  locale: string;
  detailData: AppointmentDetailData;
  risks: Array<{ code: string; level: "critical" | "warning"; message: string }>;
  suggestions: AdminSuggestion[];
  runSuggestedAction: (suggestion: AdminSuggestion) => void;
};

export function OverviewSection({
  tr,
  locale,
  detailData,
  risks,
  suggestions,
  runSuggestedAction,
}: OverviewSectionProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <p>
          <span className="font-medium">{tr("邮箱：", "Email: ")}</span>
          {detailData?.appointment.email}
        </p>
        <p>
          <span className="font-medium">{tr("状态：", "Status: ")}</span>
          {detailData?.appointment.status}
        </p>
        <p>
          <span className="font-medium">{tr("支付：", "Payment: ")}</span>
          {detailData?.appointment.paymentStatus}
        </p>
        <p>
          <span className="font-medium">{tr("金额：", "Amount: ")}</span>
          {formatMoneyFromMinorUnit(
            detailData?.appointment.amount ?? 0,
            detailData?.appointment.currency ?? "USD",
            locale
          )}
        </p>
        <p>
          <span className="font-medium">{tr("预约时间：", "Scheduled: ")}</span>
          {formatDate(detailData?.appointment.scheduledAt ?? null, locale)}
        </p>
        <p>
          <span className="font-medium">{tr("支付时间：", "Paid at: ")}</span>
          {formatDate(detailData?.appointment.paidAt ?? null, locale)}
        </p>
      </div>

      {risks.length > 0 ? (
        <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">{tr("风险提示", "Risk Alerts")}</p>
          <div className="space-y-1">
            {risks.map(risk => (
              <p
                key={risk.code}
                className={
                  risk.level === "critical"
                    ? "text-xs text-rose-700"
                    : "text-xs text-amber-800"
                }
              >
                [{risk.level}] {risk.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2 rounded border border-sky-200 bg-sky-50 p-3">
        <p className="text-sm font-medium text-sky-900">{tr("建议动作", "Recommended Actions")}</p>
        <div className="space-y-2">
          {suggestions.map(suggestion => (
            <div
              key={suggestion.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-sky-100 bg-white p-2"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-slate-900">{suggestion.title}</p>
                <p className="text-xs text-slate-600">{suggestion.detail}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => runSuggestedAction(suggestion)}
              >
                {tr("执行", "Run")}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("医生 / 分诊信息", "Doctor / Triage")}</p>
        <p className="text-sm text-muted-foreground">
          {tr("医生：", "Doctor: ")}
          {detailData?.doctor
            ? `${detailData.doctor.name} (${detailData.doctor.departmentName})`
            : tr("未知", "Unknown")}
        </p>
        <p className="text-sm text-muted-foreground">
          {tr("分诊总结：", "Triage summary: ")} {detailData?.triageSession?.summary || "-"}
        </p>
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">{tr("诊前信息", "Intake")}</p>
        {detailData?.intake ? (
          <pre className="rounded bg-slate-50 p-2 text-xs">
            {JSON.stringify(detailData.intake, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">{tr("暂无诊前信息。", "No intake data.")}</p>
        )}
      </div>
    </>
  );
}
