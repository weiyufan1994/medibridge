import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, toReasonLabel } from "@/features/admin/utils/adminFormatting";
import type { AdminOperationAuditItem } from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type OperationAuditCardProps = {
  tr: TranslateFn;
  locale: string;
  isLoading: boolean;
  errorMessage?: string;
  total: number;
  items: AdminOperationAuditItem[];
  page: number;
  totalPages: number;
  onPageChange: (value: number) => void;
  onRefresh: () => void;
  onOpenAppointmentById: (appointmentId: number) => void;
  operatorIdInput: string;
  onOperatorIdInputChange: (value: string) => void;
  actionTypeInput: string;
  onActionTypeInputChange: (value: string) => void;
  from: string;
  onFromChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
};

const totalPagesValue = (value: number) => Math.max(1, value);

export function OperationAuditCard({
  tr,
  locale,
  isLoading,
  errorMessage,
  items,
  total,
  page,
  totalPages,
  onPageChange,
  onRefresh,
  onOpenAppointmentById,
  operatorIdInput,
  onOperatorIdInputChange,
  actionTypeInput,
  onActionTypeInputChange,
  from,
  onFromChange,
  to,
  onToChange,
}: OperationAuditCardProps) {
  const normalizedTotalPages = totalPagesValue(totalPages);
  const hasItems = items.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("管理员操作审计", "Admin Operation Audit")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">
              {tr("管理员ID", "Operator ID")}
            </p>
            <Input
              value={operatorIdInput}
              onChange={event => onOperatorIdInputChange(event.target.value)}
              placeholder={tr("例如：1", "e.g. 1")}
              inputMode="numeric"
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">
              {tr("动作关键词", "Action keyword")}
            </p>
            <Input
              value={actionTypeInput}
              onChange={event => onActionTypeInputChange(event.target.value)}
              placeholder={tr("例如：admin_batch", "e.g. admin_batch")}
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("起始时间", "From")}</p>
            <Input
              value={from}
              type="datetime-local"
              onChange={event => onFromChange(event.target.value)}
            />
          </div>
          <div className="w-full max-w-xs space-y-1">
            <p className="text-xs text-muted-foreground">{tr("结束时间", "To")}</p>
            <Input
              value={to}
              type="datetime-local"
              onChange={event => onToChange(event.target.value)}
            />
          </div>
          <Button type="button" variant="outline" onClick={onRefresh}>
            {tr("刷新", "Refresh")}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
                    {tr(`共 ${total} 条`, `Total ${total}`)}
          </span>
          <span>
            {tr("分页", "Page")} {page} / {normalizedTotalPages}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载审计日志...", "Loading audit logs...")}
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : hasItems ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="px-2 py-2 text-left">{tr("时间", "Time")}</th>
                    <th className="px-2 py-2 text-left">{tr("动作", "Action")}</th>
                    <th className="px-2 py-2 text-left">{tr("预约ID", "Appointment")}</th>
                    <th className="px-2 py-2 text-left">{tr("来源", "Operator")}</th>
                    <th className="px-2 py-2 text-left">{tr("来源ID", "Operator ID")}</th>
                    <th className="px-2 py-2 text-left">{tr("明细", "Reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b">
                      <td className="px-2 py-2 whitespace-nowrap">
                        {formatDate(item.createdAt, locale)}
                      </td>
                      <td className="px-2 py-2">{item.fromStatus} → {item.toStatus}</td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => onOpenAppointmentById(item.appointmentId)}
                          className="text-left hover:underline"
                        >
                          {item.appointmentId}
                        </button>
                      </td>
                      <td className="px-2 py-2">{item.operatorType}</td>
                      <td className="px-2 py-2">{item.operatorId ?? "-"}</td>
                      <td className="px-2 py-2">{toReasonLabel(item.reason ?? "", locale.startsWith("zh") ? "zh" : "en")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                {tr("上一页", "Prev")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onPageChange(Math.min(normalizedTotalPages, page + 1))}
                disabled={page >= normalizedTotalPages}
              >
                {tr("下一页", "Next")}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {tr("暂无审计记录。", "No audit records.")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
