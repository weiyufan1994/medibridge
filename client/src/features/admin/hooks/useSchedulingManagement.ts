import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getAppointmentTypeOptions,
  getExceptionActionOptions,
  getWeekdayOptions,
} from "@/features/admin/copy";
import { getSchedulingDoctorLabel } from "@/features/admin/schedulingPresentation";
import { trpc } from "@/lib/trpc";

type TranslateFn = (zh: string, en: string) => string;
type AppointmentType = "online_chat" | "video_call" | "in_person";
type ExceptionAction = "block" | "extend" | "replace";

type UseSchedulingManagementInput = {
  tr: TranslateFn;
  lang: "zh" | "en";
};

export function useSchedulingManagement({
  tr,
  lang,
}: UseSchedulingManagementInput) {
  const [doctorIdInput, setDoctorIdInput] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [weekday, setWeekday] = useState("1");
  const [ruleAppointmentType, setRuleAppointmentType] =
    useState<AppointmentType>("online_chat");
  const [startLocalTime, setStartLocalTime] = useState("10:00");
  const [endLocalTime, setEndLocalTime] = useState("18:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState("30");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionAction, setExceptionAction] =
    useState<ExceptionAction>("block");
  const [exceptionStartLocalTime, setExceptionStartLocalTime] =
    useState("10:00");
  const [exceptionEndLocalTime, setExceptionEndLocalTime] = useState("12:00");
  const [exceptionReason, setExceptionReason] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("10:00");
  const [manualAppointmentType, setManualAppointmentType] =
    useState<AppointmentType>("online_chat");
  const [manualSlotDurationMinutes, setManualSlotDurationMinutes] =
    useState("60");

  const doctorId = Number(doctorIdInput.trim());
  const hasDoctorId = Number.isInteger(doctorId) && doctorId > 0;
  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: hasDoctorId ? doctorId : 0 },
    { enabled: hasDoctorId }
  );
  const rulesQuery = trpc.scheduling.listScheduleRules.useQuery(
    { doctorId: hasDoctorId ? doctorId : undefined },
    { enabled: hasDoctorId }
  );
  const exceptionsQuery = trpc.scheduling.listScheduleExceptions.useQuery(
    { doctorId: hasDoctorId ? doctorId : undefined },
    { enabled: hasDoctorId }
  );
  const slotsQuery = trpc.scheduling.listDoctorUpcomingSlots.useQuery(
    { doctorId: hasDoctorId ? doctorId : 0 },
    { enabled: hasDoctorId }
  );

  const refreshAll = async () => {
    if (!hasDoctorId) return;
    await Promise.all([
      doctorQuery.refetch(),
      rulesQuery.refetch(),
      exceptionsQuery.refetch(),
      slotsQuery.refetch(),
    ]);
  };

  const createRuleMutation = trpc.scheduling.createScheduleRule.useMutation({
    onSuccess: async () => {
      toast.success(tr("排班规则已保存。", "Schedule rule saved."));
      await refreshAll();
    },
    onError: error =>
      toast.error(
        error.message ||
          tr("保存排班规则失败。", "Failed to save schedule rule.")
      ),
  });
  const deleteRuleMutation = trpc.scheduling.deleteScheduleRule.useMutation({
    onSuccess: async () => {
      toast.success(tr("排班规则已删除。", "Schedule rule deleted."));
      await refreshAll();
    },
    onError: error =>
      toast.error(
        error.message ||
          tr("删除排班规则失败。", "Failed to delete schedule rule.")
      ),
  });
  const createExceptionMutation =
    trpc.scheduling.createScheduleException.useMutation({
      onSuccess: async () => {
        toast.success(tr("排班例外已保存。", "Schedule exception saved."));
        await refreshAll();
      },
      onError: error =>
        toast.error(
          error.message ||
            tr("保存排班例外失败。", "Failed to save schedule exception.")
        ),
    });
  const deleteExceptionMutation =
    trpc.scheduling.deleteScheduleException.useMutation({
      onSuccess: async () => {
        toast.success(tr("排班例外已删除。", "Schedule exception deleted."));
        await refreshAll();
      },
      onError: error =>
        toast.error(
          error.message ||
            tr("删除排班例外失败。", "Failed to delete schedule exception.")
        ),
    });
  const createManualSlotMutation = trpc.scheduling.createManualSlot.useMutation(
    {
      onSuccess: async () => {
        toast.success(tr("manual slot 已创建。", "Manual slot created."));
        await refreshAll();
      },
      onError: error =>
        toast.error(
          error.message ||
            tr("创建 manual slot 失败。", "Failed to create manual slot.")
        ),
    }
  );
  const regenerateSlotsMutation =
    trpc.scheduling.regenerateDoctorSlots.useMutation({
      onSuccess: async () => {
        toast.success(tr("未来 slots 已重建。", "Future slots regenerated."));
        await refreshAll();
      },
      onError: error =>
        toast.error(
          error.message ||
            tr("重建 slots 失败。", "Failed to regenerate slots.")
        ),
    });
  const blockSlotMutation = trpc.scheduling.blockSlot.useMutation({
    onSuccess: async () => {
      await refreshAll();
    },
    onError: error =>
      toast.error(error.message || tr("封盘失败。", "Failed to block slot.")),
  });
  const unblockSlotMutation = trpc.scheduling.unblockSlot.useMutation({
    onSuccess: async () => {
      await refreshAll();
    },
    onError: error =>
      toast.error(error.message || tr("解封失败。", "Failed to unblock slot.")),
  });

  const isBusy =
    createRuleMutation.isPending ||
    deleteRuleMutation.isPending ||
    createExceptionMutation.isPending ||
    deleteExceptionMutation.isPending ||
    createManualSlotMutation.isPending ||
    regenerateSlotsMutation.isPending ||
    blockSlotMutation.isPending ||
    unblockSlotMutation.isPending;
  const doctorLabel = useMemo(() => {
    if (!hasDoctorId) return tr("请输入医生 ID。", "Enter a doctor ID.");
    return getSchedulingDoctorLabel({
      lang,
      doctorId,
      doctor: doctorQuery.data?.doctor,
      tr,
    });
  }, [doctorId, doctorQuery.data?.doctor, hasDoctorId, lang, tr]);

  return {
    doctorIdInput,
    setDoctorIdInput,
    doctorId,
    hasDoctorId,
    doctorLabel,
    timezone,
    setTimezone,
    weekday,
    setWeekday,
    ruleAppointmentType,
    setRuleAppointmentType,
    startLocalTime,
    setStartLocalTime,
    endLocalTime,
    setEndLocalTime,
    slotDurationMinutes,
    setSlotDurationMinutes,
    validFrom,
    setValidFrom,
    validTo,
    setValidTo,
    exceptionDate,
    setExceptionDate,
    exceptionAction,
    setExceptionAction,
    exceptionStartLocalTime,
    setExceptionStartLocalTime,
    exceptionEndLocalTime,
    setExceptionEndLocalTime,
    exceptionReason,
    setExceptionReason,
    manualDate,
    setManualDate,
    manualTime,
    setManualTime,
    manualAppointmentType,
    setManualAppointmentType,
    manualSlotDurationMinutes,
    setManualSlotDurationMinutes,
    doctorQuery,
    rulesQuery,
    exceptionsQuery,
    slotsQuery,
    createRuleMutation,
    deleteRuleMutation,
    createExceptionMutation,
    deleteExceptionMutation,
    createManualSlotMutation,
    regenerateSlotsMutation,
    blockSlotMutation,
    unblockSlotMutation,
    isBusy,
    weekdayOptions: getWeekdayOptions(lang),
    appointmentTypeOptions: getAppointmentTypeOptions(lang),
    exceptionActionOptions: getExceptionActionOptions(lang),
    refreshAll,
  };
}

export type UseSchedulingManagementResult = ReturnType<
  typeof useSchedulingManagement
>;
