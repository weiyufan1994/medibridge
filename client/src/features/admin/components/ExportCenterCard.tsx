import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminExportScope } from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type ExportInput = {
  scope: AdminExportScope;
  format: "csv" | "json";
  webhookAppointmentId?: number;
  auditOperatorId?: number;
  auditActionType?: string;
  auditFrom?: string;
  auditTo?: string;
};

type ExportCenterCardProps = {
  tr: TranslateFn;
  locale: string;
  isExporting: boolean;
  onExport: (input: ExportInput) => void;
};

const exportScopeOptions: Array<{ value: AdminExportScope; labelZh: string; labelEn: string }> = [
  { value: "appointments", labelZh: "预约列表", labelEn: "Appointments" },
  { value: "risk_summary", labelZh: "风险汇总", labelEn: "Risk summary" },
  { value: "retention_audits", labelZh: "清理审计", labelEn: "Retention audit" },
  { value: "webhook_timeline", labelZh: "Webhook 时间线", labelEn: "Webhook timeline" },
  { value: "operation_audit", labelZh: "操作审计", labelEn: "Operation audit" },
];

export function ExportCenterCard({
  tr,
  locale,
  isExporting,
  onExport,
}: ExportCenterCardProps) {
  const [scope, setScope] = useState<AdminExportScope>("appointments");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [webhookAppointmentIdInput, setWebhookAppointmentIdInput] = useState("");
  const [auditOperatorIdInput, setAuditOperatorIdInput] = useState("");
  const [auditActionType, setAuditActionType] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");

  const webhookAppointmentId = useMemo(() => {
    const parsed = Number(webhookAppointmentIdInput.trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }, [webhookAppointmentIdInput]);
  const auditOperatorId = useMemo(() => {
    const parsed = Number(auditOperatorIdInput.trim());
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }, [auditOperatorIdInput]);

  const handleExport = () => {
    onExport({
      scope,
      format,
      webhookAppointmentId: scope === "webhook_timeline" ? webhookAppointmentId : undefined,
      auditOperatorId: scope === "operation_audit" ? auditOperatorId : undefined,
      auditActionType: scope === "operation_audit" ? auditActionType.trim() || undefined : undefined,
      auditFrom: scope === "operation_audit" ? (auditFrom || undefined) : undefined,
      auditTo: scope === "operation_audit" ? (auditTo || undefined) : undefined,
    });
  };

  const scopeSummary = scope === "appointments"
    ? "导出范围：预约列表 / 风险汇总 / 清理审计 / Webhook 时间线 / 操作审计"
    : scope === "risk_summary"
      ? "导出内容：风险统计摘要（含风险项计数）"
      : scope === "retention_audits"
        ? "导出内容：清理审计记录（含候选数/删除数）"
        : scope === "webhook_timeline"
          ? "导出内容：指定预约的 Webhook 事件时间线"
          : "导出内容：操作审计日志";
  const scopeSummaryEn =
    scope === "appointments"
      ? "Export scope: Appointments / Risk summary / Retention audit / Webhook timeline / Operation audit"
      : scope === "risk_summary"
        ? "Exported data: risk summary counters"
        : scope === "retention_audits"
          ? "Exported data: retention cleanup audit records"
          : scope === "webhook_timeline"
            ? "Exported data: webhook timeline for selected appointment"
            : "Exported data: operation audit logs";

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {tr("导出中心", "Export Center")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {tr("基于当前筛选条件导出 CSV/JSON。", "Export CSV/JSON with current filter conditions.")}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={scope}
            onChange={event => setScope(event.target.value as AdminExportScope)}
          >
            {exportScopeOptions.map(item => (
              <option key={item.value} value={item.value}>
                {tr(item.labelZh, item.labelEn)}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={format}
            onChange={event => setFormat(event.target.value as "csv" | "json")}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          {scope === "webhook_timeline" ? (
            <Input
              className="w-full max-w-xs"
              value={webhookAppointmentIdInput}
              onChange={event => setWebhookAppointmentIdInput(event.target.value)}
              placeholder={tr("Webhook 预约ID（可选）", "Webhook appointment ID (optional)")}
              inputMode="numeric"
            />
          ) : null}
          {scope === "operation_audit" ? (
            <>
              <Input
                className="w-full max-w-xs"
                value={auditOperatorIdInput}
                onChange={event => setAuditOperatorIdInput(event.target.value)}
                placeholder={tr("操作员 ID（可选）", "Operator ID (optional)")}
                inputMode="numeric"
              />
              <Input
                className="w-full max-w-xs"
                value={auditActionType}
                onChange={event => setAuditActionType(event.target.value)}
                placeholder={tr("动作关键字（可选）", "Action keyword (optional)")}
              />
              <Input
                className="w-full max-w-xs"
                type="datetime-local"
                value={auditFrom}
                onChange={event => setAuditFrom(event.target.value)}
              />
              <Input
                className="w-full max-w-xs"
                type="datetime-local"
                value={auditTo}
                onChange={event => setAuditTo(event.target.value)}
              />
            </>
          ) : null}
          <Button type="button" variant="outline" disabled={isExporting} onClick={handleExport}>
            {tr("导出", "Export")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {locale.startsWith("zh") ? scopeSummary : scopeSummaryEn}
        </p>
      </CardContent>
    </Card>
  );
}
