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
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";
import {
  getAdminConfirmationCopy,
  getWeekdayLabel,
} from "@/features/admin/copy";
import type { UseSchedulingManagementResult } from "@/features/admin/hooks/useSchedulingManagement";

type Props = {
  scheduling: UseSchedulingManagementResult;
  tr: (zh: string, en: string) => string;
  lang: "zh" | "en";
  isReadOnly: boolean;
};

export function SchedulingRulesPanel({
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
          <Label>{tr("时区", "Timezone")}</Label>
          <Input
            value={scheduling.timezone}
            onChange={event => scheduling.setTimezone(event.target.value)}
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("星期", "Weekday")}</Label>
          <Select
            value={scheduling.weekday}
            onValueChange={scheduling.setWeekday}
            disabled={isReadOnly || scheduling.isBusy}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scheduling.weekdayOptions.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{tr("问诊方式", "Appointment Type")}</Label>
          <Select
            value={scheduling.ruleAppointmentType}
            onValueChange={value =>
              scheduling.setRuleAppointmentType(
                value as typeof scheduling.ruleAppointmentType
              )
            }
            disabled={isReadOnly || scheduling.isBusy}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scheduling.appointmentTypeOptions.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{tr("开始时间", "Start Time")}</Label>
          <Input
            type="time"
            value={scheduling.startLocalTime}
            onChange={event => scheduling.setStartLocalTime(event.target.value)}
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("结束时间", "End Time")}</Label>
          <Input
            type="time"
            value={scheduling.endLocalTime}
            onChange={event => scheduling.setEndLocalTime(event.target.value)}
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("slot 时长（分钟）", "Slot Duration (minutes)")}</Label>
          <Input
            value={scheduling.slotDurationMinutes}
            onChange={event =>
              scheduling.setSlotDurationMinutes(event.target.value)
            }
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("生效开始", "Valid From")}</Label>
          <Input
            type="date"
            value={scheduling.validFrom}
            onChange={event => scheduling.setValidFrom(event.target.value)}
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("生效结束", "Valid To")}</Label>
          <Input
            type="date"
            value={scheduling.validTo}
            onChange={event => scheduling.setValidTo(event.target.value)}
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
              void scheduling.createRuleMutation.mutateAsync({
                doctorId: scheduling.doctorId,
                timezone: scheduling.timezone,
                weekday: Number(scheduling.weekday),
                startLocalTime: scheduling.startLocalTime,
                endLocalTime: scheduling.endLocalTime,
                slotDurationMinutes: Number(scheduling.slotDurationMinutes),
                appointmentTypeScope: scheduling.ruleAppointmentType,
                validFrom: scheduling.validFrom || undefined,
                validTo: scheduling.validTo || undefined,
                isActive: true,
              })
            }
          >
            {tr("新增规则", "Create Rule")}
          </Button>
        </div>
      </div>

      {!scheduling.hasDoctorId ? (
        <p className="text-sm text-muted-foreground">
          {tr("输入医生 ID 后查看规则。", "Enter a doctor ID to view rules.")}
        </p>
      ) : scheduling.rulesQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("正在加载规则...", "Loading rules...")}
        </div>
      ) : scheduling.rulesQuery.error ? (
        <p className="text-sm text-destructive">
          {scheduling.rulesQuery.error.message}
        </p>
      ) : (
        <div className="space-y-2">
          {(scheduling.rulesQuery.data ?? []).map(rule => (
            <div
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border bg-admin-surface-muted p-3"
            >
              <div className="text-sm">
                <div className="font-medium text-foreground">
                  {getWeekdayLabel(String(rule.weekday), lang)} ·{" "}
                  {rule.startLocalTime} - {rule.endLocalTime}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {rule.appointmentTypeScope} · {rule.slotDurationMinutes} min ·{" "}
                  {rule.timezone}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const confirmation = getAdminConfirmationCopy(
                    lang,
                    "deleteScheduleRule"
                  );
                  requestConfirmation({
                    title: confirmation.title,
                    description: confirmation.description,
                    confirmLabel: confirmation.confirmLabel,
                    cancelLabel: confirmation.cancelLabel,
                    tone: "danger",
                    onConfirm: () =>
                      scheduling.deleteRuleMutation.mutateAsync({
                        id: rule.id,
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
          {(scheduling.rulesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr("还没有排班规则。", "No schedule rules yet.")}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
