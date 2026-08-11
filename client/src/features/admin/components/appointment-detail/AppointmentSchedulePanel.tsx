import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UpdateScheduleMutation } from "@/features/admin/types";

type AppointmentSchedulePanelProps = {
  tr: (zh: string, en: string) => string;
  canMutateAdmin: boolean;
  manualScheduledAt: string;
  setManualScheduledAt: (value: string) => void;
  setScheduleToNow: () => void;
  applyManualScheduleUpdate: () => void;
  updateScheduleMutation: UpdateScheduleMutation;
};

export function AppointmentSchedulePanel({
  tr,
  canMutateAdmin,
  manualScheduledAt,
  setManualScheduledAt,
  setScheduleToNow,
  applyManualScheduleUpdate,
  updateScheduleMutation,
}: AppointmentSchedulePanelProps) {
  return (
    <div className="space-y-2 rounded border p-3">
      <p className="text-sm font-medium">
        {tr("测试预约时间", "Test Appointment Time")}
      </p>
      {!canMutateAdmin ? (
        <p className="text-xs text-muted-foreground">
          {tr(
            "仅管理员可执行预约状态/财务更新。",
            "Only admin can update appointment status/payment."
          )}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Input
          type="datetime-local"
          value={manualScheduledAt}
          onChange={event => setManualScheduledAt(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          onClick={setScheduleToNow}
          disabled={!canMutateAdmin || updateScheduleMutation.isPending}
        >
          {tr("设为当前时间", "Set to now")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={applyManualScheduleUpdate}
          disabled={!canMutateAdmin || updateScheduleMutation.isPending}
        >
          {updateScheduleMutation.isPending
            ? tr("保存中...", "Saving...")
            : tr("保存预约时间", "Save schedule")}
        </Button>
      </div>
    </div>
  );
}
