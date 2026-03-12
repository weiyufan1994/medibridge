import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AdminAppointmentListItem,
  AdminAppointmentRiskSummary,
} from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type RiskMetricsCardProps = {
  tr: TranslateFn;
  isLoading: boolean;
  errorMessage?: string;
  generatedAt?: string;
  riskSummary: AdminAppointmentRiskSummary | null;
  riskItems: AdminAppointmentListItem[];
  onOpenAppointmentById: (id: number) => void;
};

export function RiskMetricsCard({
  tr,
  isLoading,
  errorMessage,
  generatedAt,
  riskSummary,
  riskItems,
  onOpenAppointmentById,
}: RiskMetricsCardProps) {
  const total = riskSummary?.total ?? riskItems.length;
  const pendingRiskCount = riskSummary
    ? riskSummary.pendingPaymentTimeout +
      riskSummary.webhookFailure +
      riskSummary.tokenExpiringSoon +
      riskSummary.tokenUsageExhausted
    : riskItems.filter(item => item.hasRisk).length;
  const failureRate = total === 0 ? 0 : (pendingRiskCount / total) * 100;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const riskDurationsMs = riskItems.flatMap(item =>
    item.hasRisk && item.createdAt
      ? [now.getTime() - new Date(item.createdAt).getTime()]
      : []
  ).filter(duration => Number.isFinite(duration) && duration > 0);
  const avgHandlingMinutes =
    riskDurationsMs.length === 0
      ? 0
      : riskDurationsMs.reduce((acc, value) => acc + value, 0) / riskDurationsMs.length / 60_000;
  const todayStart = today;
  const todayAppointments = riskItems.filter(item => {
    const date = new Date(item.createdAt);
    return !Number.isNaN(date.getTime()) && date >= todayStart && date <= new Date();
  }).length;

  const grouped = new Map<
    string,
    {
      ids: number[];
      count: number;
    }
  >();
  for (const item of riskItems) {
    for (const code of item.riskCodes) {
      const existing = grouped.get(code);
      if (!existing) {
        grouped.set(code, { ids: [item.id], count: 1 });
      } else {
        existing.ids.push(item.id);
        existing.count += 1;
      }
    }
  }
  const riskAlertEntries = Array.from(grouped.entries());

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("风险指标", "Risk Metrics")}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载指标...", "Loading metrics...")}
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {tr("生成时间", "Generated at")}: {generatedAt ?? "-"}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">{tr("今日新增", "New today")}</p>
                <p className="text-2xl font-semibold">{todayAppointments}</p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">{tr("风险占比", "Risk rate")}</p>
                <p className="text-2xl font-semibold">
                  {failureRate.toFixed(2)}%
                </p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">{tr("平均处理时长(分钟)", "Avg handling time (min)")}</p>
                <p className="text-2xl font-semibold">
                  {avgHandlingMinutes === 0
                    ? "-"
                    : avgHandlingMinutes.toFixed(1)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">{tr("待处理告警列表（按风险码聚合）", "Risk alerts by code")}</p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-1 text-left">{tr("风险码", "Risk code")}</th>
                      <th className="px-2 py-1 text-left">{tr("数量", "Count")}</th>
                      <th className="px-2 py-1 text-left">{tr("示例预约", "Sample appointments")}</th>
                    </tr>
                  </thead>
                <tbody>
                  {riskAlertEntries.length === 0 ? (
                      <tr>
                        <td className="px-2 py-2 text-muted-foreground" colSpan={3}>
                          {tr("暂无风险告警。", "No risk alerts.")}
                        </td>
                      </tr>
                    ) : (
                    riskAlertEntries.map(([code, value]) => {
                        const sampleItems = value.ids.slice(0, 5);
                        return (
                          <tr key={code} className="border-b">
                            <td className="px-2 py-1">{code}</td>
                            <td className="px-2 py-1">{value.count}</td>
                            <td className="px-2 py-1">
                              {sampleItems.map((itemId, index) => (
                                <button
                                  type="button"
                                  className="mr-2 text-blue-600 hover:underline"
                                  onClick={() => onOpenAppointmentById(itemId)}
                                  key={`${code}-${itemId}-${index}`}
                                >
                                  {itemId}
                                </button>
                              ))}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
