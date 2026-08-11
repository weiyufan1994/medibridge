import { Loader2, RefreshCcw, ShieldBan, ShieldCheck } from "lucide-react";
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
import type { UseSchedulingManagementResult } from "@/features/admin/hooks/useSchedulingManagement";
import {
  formatSchedulingDateTime,
  formatSchedulingStatus,
} from "@/features/admin/schedulingPresentation";

type Props = {
  scheduling: UseSchedulingManagementResult;
  tr: (zh: string, en: string) => string;
  lang: "zh" | "en";
  isReadOnly: boolean;
};

export function SchedulingSlotsPanel({
  scheduling,
  tr,
  lang,
  isReadOnly,
}: Props) {
  return (
    <>
      <div className="grid gap-3 rounded border p-3 md:grid-cols-3">
        <div>
          <Label>{tr("日期", "Date")}</Label>
          <Input
            type="date"
            value={scheduling.manualDate}
            onChange={event => scheduling.setManualDate(event.target.value)}
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("时间", "Time")}</Label>
          <Input
            type="time"
            value={scheduling.manualTime}
            onChange={event => scheduling.setManualTime(event.target.value)}
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("问诊方式", "Appointment Type")}</Label>
          <Select
            value={scheduling.manualAppointmentType}
            onValueChange={value =>
              scheduling.setManualAppointmentType(
                value as typeof scheduling.manualAppointmentType
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
          <Label>{tr("slot 时长（分钟）", "Slot Duration (minutes)")}</Label>
          <Input
            value={scheduling.manualSlotDurationMinutes}
            onChange={event =>
              scheduling.setManualSlotDurationMinutes(event.target.value)
            }
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div>
          <Label>{tr("时区", "Timezone")}</Label>
          <Input
            value={scheduling.timezone}
            onChange={event => scheduling.setTimezone(event.target.value)}
            disabled={isReadOnly || scheduling.isBusy}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            disabled={
              isReadOnly || scheduling.isBusy || !scheduling.hasDoctorId
            }
            onClick={() =>
              void scheduling.createManualSlotMutation.mutateAsync({
                doctorId: scheduling.doctorId,
                appointmentType: scheduling.manualAppointmentType,
                slotDurationMinutes: Number(
                  scheduling.manualSlotDurationMinutes
                ),
                timezone: scheduling.timezone,
                startAt: new Date(
                  `${scheduling.manualDate}T${scheduling.manualTime}:00`
                ),
              })
            }
          >
            {tr("新增 Manual Slot", "Create Manual Slot")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              isReadOnly || scheduling.isBusy || !scheduling.hasDoctorId
            }
            onClick={() =>
              void scheduling.regenerateSlotsMutation.mutateAsync({
                doctorId: scheduling.doctorId,
              })
            }
          >
            <RefreshCcw className="mr-1.5 h-4 w-4" />
            {tr("按规则重建", "Regenerate")}
          </Button>
        </div>
      </div>

      {!scheduling.hasDoctorId ? (
        <p className="text-sm text-muted-foreground">
          {tr(
            "输入医生 ID 后查看未来 slots。",
            "Enter a doctor ID to view future slots."
          )}
        </p>
      ) : scheduling.slotsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tr("正在加载 slots...", "Loading slots...")}
        </div>
      ) : scheduling.slotsQuery.error ? (
        <p className="text-sm text-destructive">
          {scheduling.slotsQuery.error.message}
        </p>
      ) : (
        <div className="space-y-2">
          {(scheduling.slotsQuery.data ?? []).map(slot => (
            <div
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border bg-admin-surface-muted p-3"
            >
              <div className="text-sm">
                <div className="font-medium text-foreground">
                  {formatSchedulingDateTime(slot.startAt, lang)} -{" "}
                  {formatSchedulingDateTime(slot.endAt, lang)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatSchedulingStatus(slot.status, tr)} ·{" "}
                  {slot.appointmentType} · {slot.source}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {slot.status === "blocked" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void scheduling.unblockSlotMutation.mutateAsync({
                        id: slot.id,
                      })
                    }
                    disabled={isReadOnly || scheduling.isBusy}
                  >
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    {tr("解封", "Unblock")}
                  </Button>
                ) : slot.status === "open" || slot.status === "held" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void scheduling.blockSlotMutation.mutateAsync({
                        id: slot.id,
                      })
                    }
                    disabled={isReadOnly || scheduling.isBusy}
                  >
                    <ShieldBan className="mr-1.5 h-4 w-4" />
                    {tr("封盘", "Block")}
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {(scheduling.slotsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr("还没有未来 slots。", "No future slots yet.")}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
