import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";
import { getAdminConfirmationCopy } from "@/features/admin/copy";
import type { UseSchedulingManagementResult } from "@/features/admin/hooks/useSchedulingManagement";

type Props = {
  scheduling: UseSchedulingManagementResult;
  tr: (zh: string, en: string) => string;
  lang: "zh" | "en";
  isReadOnly: boolean;
};

export function SchedulingExceptionsPanel({
  scheduling,
  tr,
  lang,
  isReadOnly,
}: Props) {
  const { requestConfirmation } = useAdminActionConfirmation();

  return (
    <>
      <div className="grid gap-3 rounded border p-3 md:grid-cols-3">
        <div>
          <Label>{tr("日期", "Date")}</Label>
          <Input
            type="date"
            value={scheduling.exceptionDate}
            onChange={event => scheduling.setExceptionDate(event.target.value)}
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("动作", "Action")}</Label>
          <Select
            value={scheduling.exceptionAction}
            onValueChange={value =>
              scheduling.setExceptionAction(
                value as typeof scheduling.exceptionAction
              )
            }
            disabled={isReadOnly || scheduling.isBusy}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scheduling.exceptionActionOptions.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{tr("备注", "Reason")}</Label>
          <Textarea
            value={scheduling.exceptionReason}
            onChange={event =>
              scheduling.setExceptionReason(event.target.value)
            }
            disabled={isReadOnly || scheduling.isBusy}
            className="min-h-[40px]"
          />
        </div>
        <div>
          <Label>{tr("开始时间", "Start Time")}</Label>
          <Input
            type="time"
            value={scheduling.exceptionStartLocalTime}
            onChange={event =>
              scheduling.setExceptionStartLocalTime(event.target.value)
            }
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("结束时间", "End Time")}</Label>
          <Input
            type="time"
            value={scheduling.exceptionEndLocalTime}
            onChange={event =>
              scheduling.setExceptionEndLocalTime(event.target.value)
            }
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            disabled={
              isReadOnly || scheduling.isBusy || !scheduling.hasDoctorId
            }
            onClick={() =>
              void scheduling.createExceptionMutation.mutateAsync({
                doctorId: scheduling.doctorId,
                dateLocal: scheduling.exceptionDate,
                action: scheduling.exceptionAction,
                startLocalTime: scheduling.exceptionStartLocalTime,
                endLocalTime: scheduling.exceptionEndLocalTime,
                reason: scheduling.exceptionReason || undefined,
              })
            }
          >
            {tr("新增例外", "Create Exception")}
          </Button>
        </div>
      </div>

      {!scheduling.hasDoctorId ? (
        <p className="text-sm text-muted-foreground">
          {tr(
            "输入医生 ID 后查看例外。",
            "Enter a doctor ID to view exceptions."
          )}
        </p>
      ) : scheduling.exceptionsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("正在加载例外...", "Loading exceptions...")}
        </div>
      ) : scheduling.exceptionsQuery.error ? (
        <p className="text-sm text-destructive">
          {scheduling.exceptionsQuery.error.message}
        </p>
      ) : (
        <div className="space-y-2">
          {(scheduling.exceptionsQuery.data ?? []).map(item => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border bg-admin-surface-muted p-3"
            >
              <div className="text-sm">
                <div className="font-medium text-foreground">
                  {item.dateLocal} · {item.action}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.startLocalTime ?? "--:--"} -{" "}
                  {item.endLocalTime ?? "--:--"}
                  {item.reason ? ` · ${item.reason}` : ""}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const confirmation = getAdminConfirmationCopy(
                    lang,
                    "deleteScheduleException"
                  );
                  requestConfirmation({
                    title: confirmation.title,
                    description: confirmation.description,
                    confirmLabel: confirmation.confirmLabel,
                    cancelLabel: confirmation.cancelLabel,
                    tone: "danger",
                    onConfirm: () =>
                      scheduling.deleteExceptionMutation.mutateAsync({
                        id: item.id,
                        doctorId: scheduling.doctorId,
                      }),
                  });
                }}
                disabled={isReadOnly || scheduling.isBusy}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {tr("删除", "Delete")}
              </Button>
            </div>
          ))}
          {(scheduling.exceptionsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr("还没有排班例外。", "No schedule exceptions yet.")}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
