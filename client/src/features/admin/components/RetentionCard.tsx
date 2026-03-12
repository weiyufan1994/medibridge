import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/features/admin/utils/adminFormatting";
import { useMemo } from "react";

type TranslateFn = (zh: string, en: string) => string;

type RetentionAuditDetails = {
  freeCandidates?: number;
  paidCandidates?: number;
  totalCandidates?: number;
  freeSampleIds?: unknown;
  paidSampleIds?: unknown;
  nextCleanupAt?: string;
  failureReason?: string;
};

type RetentionPolicyItem = {
  tier: "free" | "paid";
  retentionDays: number;
  enabled: boolean;
  updatedAt: Date | string;
};

type RetentionAuditItem = {
  id: number;
  createdAt: Date | string;
  dryRun: boolean;
  detailsJson: unknown;
  deletedMessages: number;
  freeRetentionDays: number;
  paidRetentionDays: number;
};

type RetentionCardProps = {
  tr: TranslateFn;
  locale: string;
  isPoliciesLoading: boolean;
  policiesErrorMessage?: string;
  policies: RetentionPolicyItem[];
  freeRetentionDaysInput: string;
  paidRetentionDaysInput: string;
  onFreeRetentionDaysInputChange: (value: string) => void;
  onPaidRetentionDaysInputChange: (value: string) => void;
  onUpsertRetentionPolicy: (tier: "free" | "paid") => void;
  onToggleRetentionEnabled: (tier: "free" | "paid", enabled: boolean) => void;
  isUpdateRetentionPending: boolean;
  isCleanupPending: boolean;
  onRunCleanupDryRun: () => void;
  onRunCleanupReal: () => void;
  isReadOnly?: boolean;
  isAuditsLoading: boolean;
  auditsErrorMessage?: string;
  audits: RetentionAuditItem[];
};

export function RetentionCard({
  tr,
  locale,
  isPoliciesLoading,
  policiesErrorMessage,
  policies,
  freeRetentionDaysInput,
  paidRetentionDaysInput,
  onFreeRetentionDaysInputChange,
  onPaidRetentionDaysInputChange,
  onUpsertRetentionPolicy,
  onToggleRetentionEnabled,
  isUpdateRetentionPending,
  isCleanupPending,
  onRunCleanupDryRun,
  onRunCleanupReal,
  isReadOnly = false,
  isAuditsLoading,
  auditsErrorMessage,
  audits,
}: RetentionCardProps) {
  const latestAudit = audits[0];
  const latestAuditDetails = useMemo(() => {
    const raw = latestAudit?.detailsJson;
    return (typeof raw === "object" && raw !== null ? (raw as RetentionAuditDetails) : {}) as RetentionAuditDetails;
  }, [latestAudit?.detailsJson]);
  const latestFailureReason = latestAuditDetails.failureReason;
  const nextCleanupWindow = latestAudit
    ? latestAuditDetails.nextCleanupAt ??
      (latestAudit.createdAt ? new Date(new Date(latestAudit.createdAt).getTime() + 24 * 60 * 60 * 1000).toISOString() : undefined)
    : new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString();
  const toIds = (value: unknown) => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map(item => (typeof item === "number" ? item : Number(item)))
      .filter(item => Number.isFinite(item));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("数据保留策略与清理", "Retention Strategy & Cleanup")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border bg-slate-50 p-2 text-xs text-slate-700">
          <p>
            {tr("下次预计清理窗口", "Next expected cleanup window")}
            ：{nextCleanupWindow ? formatDate(nextCleanupWindow, locale) : tr("待加载", "Loading...")}
          </p>
          {latestFailureReason ? (
            <p className="mt-1 text-destructive">
              {tr("最近清理失败原因", "Latest cleanup failure reason")}：{latestFailureReason}
            </p>
          ) : null}
        </div>

        {isPoliciesLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载保留策略...", "Loading retention policies...")}
          </div>
        ) : policiesErrorMessage ? (
          <p className="text-sm text-destructive">{policiesErrorMessage}</p>
        ) : (
          <div className="space-y-3 rounded border p-3">
            {policies.map(policy => (
              <div
                key={policy.tier}
                className="grid grid-cols-1 gap-2 rounded border bg-slate-50 p-2 md:grid-cols-5 md:items-center"
              >
                <p className="text-sm font-medium">
                  {policy.tier === "free"
                    ? tr("免费用户（短期）", "Free (short-term)")
                    : tr("付费用户（长期）", "Paid (long-term)")}
                </p>
                <Input
                  value={policy.tier === "free" ? freeRetentionDaysInput : paidRetentionDaysInput}
                  onChange={event =>
                    policy.tier === "free"
                      ? onFreeRetentionDaysInputChange(event.target.value)
                      : onPaidRetentionDaysInputChange(event.target.value)
                  }
                  disabled={isReadOnly}
                  placeholder={tr("保留天数", "Retention days")}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onUpsertRetentionPolicy(policy.tier)}
                  disabled={isReadOnly || isUpdateRetentionPending}
                >
                  {tr("保存天数", "Save Days")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onToggleRetentionEnabled(policy.tier, !policy.enabled)}
                  disabled={isReadOnly || isUpdateRetentionPending}
                >
                  {policy.enabled ? tr("禁用", "Disable") : tr("启用", "Enable")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {tr("更新时间", "Updated")}: {formatDate(policy.updatedAt, locale)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onRunCleanupDryRun}
            disabled={isReadOnly || isCleanupPending}
          >
            {isCleanupPending ? tr("运行中...", "Running...") : tr("执行演练清理", "Run Dry-Run Cleanup")}
          </Button>
          <Button
            type="button"
            onClick={onRunCleanupReal}
            disabled={isReadOnly || isCleanupPending}
          >
            {isCleanupPending ? tr("运行中...", "Running...") : tr("执行真实清理", "Run Real Cleanup")}
          </Button>
        </div>

        <div className="space-y-2 rounded border p-3">
          <p className="text-sm font-medium">{tr("清理审计日志", "Cleanup Audit Log")}</p>
          {isAuditsLoading ? (
            <p className="text-sm text-muted-foreground">{tr("正在加载清理审计日志...", "Loading cleanup audits...")}</p>
          ) : auditsErrorMessage ? (
            <p className="text-sm text-destructive">{auditsErrorMessage}</p>
          ) : audits.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tr("暂无清理审计日志。", "No cleanup audits yet.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-xs">
                <thead>
                <tr className="border-b">
                    <th className="px-2 py-1 text-left">{tr("时间", "Time")}</th>
                    <th className="px-2 py-1 text-left">{tr("模式", "Mode")}</th>
                    <th className="px-2 py-1 text-left">{tr("候选数量", "Candidates")}</th>
                    <th className="px-2 py-1 text-left">{tr("删除", "Deleted")}</th>
                    <th className="px-2 py-1 text-left">{tr("策略", "Policy")}</th>
                    <th className="px-2 py-1 text-left">{tr("样例清理消息ID", "Sample message IDs")}</th>
                    <th className="px-2 py-1 text-left">{tr("详情", "Details")}</th>
                  </tr>
                </thead>
                <tbody>
                  {audits.map(item => (
                    (() => {
                      const details = (typeof item.detailsJson === "object" &&
                        item.detailsJson !== null
                        ? (item.detailsJson as RetentionAuditDetails)
                        : {}) as RetentionAuditDetails;
                      const freeSampleIds = toIds(details.freeSampleIds);
                      const paidSampleIds = toIds(details.paidSampleIds);
                      const sampleText =
                        (freeSampleIds.length || paidSampleIds.length)
                          ? `free=[${freeSampleIds.slice(0, 5).join(", ")}], paid=[${paidSampleIds
                              .slice(0, 5)
                              .join(", ")}]`
                          : "-";

                      return (
                        <tr key={item.id} className="border-b align-top">
                      <td className="px-2 py-1 whitespace-nowrap">{formatDate(item.createdAt, locale)}</td>
                      <td className="px-2 py-1">
                        {item.dryRun ? tr("演练", "Dry-Run") : tr("真实", "Real")}
                      </td>
                      <td className="px-2 py-1">
                        {String((item.detailsJson as { totalCandidates?: number })?.totalCandidates ?? "-")}
                      </td>
                      <td className="px-2 py-1">{item.deletedMessages}</td>
                      <td className="px-2 py-1">
                        free={item.freeRetentionDays}d, paid={item.paidRetentionDays}d
                      </td>
                      <td className="px-2 py-1">{sampleText}</td>
                      <td className="px-2 py-1">
                            <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-[11px]">
                              {JSON.stringify(item.detailsJson ?? {}, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      );
                    })()
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
