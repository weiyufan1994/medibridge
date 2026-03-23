import { useMemo, useState } from "react";
import { Loader2, RefreshCcw, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getAppointmentTypeOptions,
  getExceptionActionOptions,
  getWeekdayLabel,
  getWeekdayOptions,
} from "@/features/admin/copy";
import { getDisplayLocale, getLocalizedTextWithZhFallback } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

type TranslateFn = (zh: string, en: string) => string;

type Props = {
  tr: TranslateFn;
  lang: "zh" | "en";
  isReadOnly?: boolean;
};

function formatDateTime(value: Date | string, lang: "zh" | "en") {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getDisplayLocale(lang), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(status: string, tr: TranslateFn) {
  switch (status) {
    case "open":
      return tr("可售", "Open");
    case "held":
      return tr("预占中", "Held");
    case "booked":
      return tr("已售", "Booked");
    case "blocked":
      return tr("已封盘", "Blocked");
    case "expired":
      return tr("已过期", "Expired");
    default:
      return status;
  }
}

export function SchedulingManagementCard({ tr, lang, isReadOnly = false }: Props) {
  const [doctorIdInput, setDoctorIdInput] = useState("");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [weekday, setWeekday] = useState("1");
  const [ruleAppointmentType, setRuleAppointmentType] = useState<"online_chat" | "video_call" | "in_person">("online_chat");
  const [startLocalTime, setStartLocalTime] = useState("10:00");
  const [endLocalTime, setEndLocalTime] = useState("18:00");
  const [slotDurationMinutes, setSlotDurationMinutes] = useState("30");
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionAction, setExceptionAction] = useState<"block" | "extend" | "replace">("block");
  const [exceptionStartLocalTime, setExceptionStartLocalTime] = useState("10:00");
  const [exceptionEndLocalTime, setExceptionEndLocalTime] = useState("12:00");
  const [exceptionReason, setExceptionReason] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("10:00");
  const [manualAppointmentType, setManualAppointmentType] = useState<"online_chat" | "video_call" | "in_person">("online_chat");
  const [manualSlotDurationMinutes, setManualSlotDurationMinutes] = useState("60");

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
    onError: error => {
      toast.error(error.message || tr("保存排班规则失败。", "Failed to save schedule rule."));
    },
  });
  const deleteRuleMutation = trpc.scheduling.deleteScheduleRule.useMutation({
    onSuccess: async () => {
      toast.success(tr("排班规则已删除。", "Schedule rule deleted."));
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("删除排班规则失败。", "Failed to delete schedule rule."));
    },
  });
  const createExceptionMutation = trpc.scheduling.createScheduleException.useMutation({
    onSuccess: async () => {
      toast.success(tr("排班例外已保存。", "Schedule exception saved."));
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("保存排班例外失败。", "Failed to save schedule exception."));
    },
  });
  const deleteExceptionMutation = trpc.scheduling.deleteScheduleException.useMutation({
    onSuccess: async () => {
      toast.success(tr("排班例外已删除。", "Schedule exception deleted."));
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("删除排班例外失败。", "Failed to delete schedule exception."));
    },
  });
  const createManualSlotMutation = trpc.scheduling.createManualSlot.useMutation({
    onSuccess: async () => {
      toast.success(tr("manual slot 已创建。", "Manual slot created."));
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("创建 manual slot 失败。", "Failed to create manual slot."));
    },
  });
  const regenerateSlotsMutation = trpc.scheduling.regenerateDoctorSlots.useMutation({
    onSuccess: async () => {
      toast.success(tr("未来 slots 已重建。", "Future slots regenerated."));
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("重建 slots 失败。", "Failed to regenerate slots."));
    },
  });
  const blockSlotMutation = trpc.scheduling.blockSlot.useMutation({
    onSuccess: async () => {
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("封盘失败。", "Failed to block slot."));
    },
  });
  const unblockSlotMutation = trpc.scheduling.unblockSlot.useMutation({
    onSuccess: async () => {
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("解封失败。", "Failed to unblock slot."));
    },
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
  const weekdayOptions = getWeekdayOptions(lang);
  const appointmentTypeOptions = getAppointmentTypeOptions(lang);
  const exceptionActionOptions = getExceptionActionOptions(lang);

  const doctorLabel = useMemo(() => {
    if (!hasDoctorId) {
      return tr("请输入医生 ID。", "Enter a doctor ID.");
    }
    const doctor = doctorQuery.data?.doctor;
    if (!doctor) {
      return tr(`医生 #${doctorId}`, `Doctor #${doctorId}`);
    }
    return `${getLocalizedTextWithZhFallback({
      lang,
      value: doctor.name,
      placeholder: tr(`医生 #${doctorId}`, `Doctor #${doctorId}`),
    })} (#${doctor.id})`;
  }, [doctorId, doctorQuery.data?.doctor, hasDoctorId, lang, tr]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("排班与 Slot 管理", "Scheduling & Slot Management")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[180px,1fr,auto]">
          <div>
            <Label htmlFor="admin-scheduling-doctor-id">{tr("医生 ID", "Doctor ID")}</Label>
            <Input
              id="admin-scheduling-doctor-id"
              value={doctorIdInput}
              onChange={event => setDoctorIdInput(event.target.value)}
              placeholder={tr("例如 11", "e.g. 11")}
              disabled={isBusy}
            />
          </div>
          <div className="rounded border bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <div className="font-medium">{doctorLabel}</div>
            <div className="mt-1 text-xs text-slate-500">
              {tr("后台可先配置规则、例外和 manual slots，患者端只消费真实可售 slot。", "Admin can configure rules, exceptions, and manual slots first; patients only consume real sellable slots.")}
            </div>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => void refreshAll()} disabled={!hasDoctorId || isBusy}>
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              {tr("刷新", "Refresh")}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="rules">{tr("规则", "Rules")}</TabsTrigger>
            <TabsTrigger value="exceptions">{tr("例外", "Exceptions")}</TabsTrigger>
            <TabsTrigger value="slots">{tr("Slots", "Slots")}</TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="space-y-4">
            <div className="grid gap-3 rounded border p-3 md:grid-cols-3">
              <div>
                <Label>{tr("时区", "Timezone")}</Label>
                <Input value={timezone} onChange={event => setTimezone(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("星期", "Weekday")}</Label>
                <Select value={weekday} onValueChange={setWeekday} disabled={isReadOnly || isBusy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {weekdayOptions.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("问诊方式", "Appointment Type")}</Label>
                <Select value={ruleAppointmentType} onValueChange={value => setRuleAppointmentType(value as typeof ruleAppointmentType)} disabled={isReadOnly || isBusy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {appointmentTypeOptions.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("开始时间", "Start Time")}</Label>
                <Input type="time" value={startLocalTime} onChange={event => setStartLocalTime(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("结束时间", "End Time")}</Label>
                <Input type="time" value={endLocalTime} onChange={event => setEndLocalTime(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("slot 时长（分钟）", "Slot Duration (minutes)")}</Label>
                <Input value={slotDurationMinutes} onChange={event => setSlotDurationMinutes(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("生效开始", "Valid From")}</Label>
                <Input type="date" value={validFrom} onChange={event => setValidFrom(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("生效结束", "Valid To")}</Label>
                <Input type="date" value={validTo} onChange={event => setValidTo(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  disabled={isReadOnly || isBusy || !hasDoctorId}
                  onClick={() =>
                    void createRuleMutation.mutateAsync({
                      doctorId,
                      timezone,
                      weekday: Number(weekday),
                      startLocalTime,
                      endLocalTime,
                      slotDurationMinutes: Number(slotDurationMinutes),
                      appointmentTypeScope: ruleAppointmentType,
                      validFrom: validFrom || undefined,
                      validTo: validTo || undefined,
                      isActive: true,
                    })
                  }
                >
                  {tr("新增规则", "Create Rule")}
                </Button>
              </div>
            </div>

            {!hasDoctorId ? (
              <p className="text-sm text-muted-foreground">{tr("输入医生 ID 后查看规则。", "Enter a doctor ID to view rules.")}</p>
            ) : rulesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在加载规则...", "Loading rules...")}
              </div>
            ) : rulesQuery.error ? (
              <p className="text-sm text-destructive">{rulesQuery.error.message}</p>
            ) : (
              <div className="space-y-2">
                {(rulesQuery.data ?? []).map(rule => (
                  <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-slate-50 p-3">
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">
                        {getWeekdayLabel(String(rule.weekday), lang)}
                        {" · "}
                        {rule.startLocalTime} - {rule.endLocalTime}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {rule.appointmentTypeScope} · {rule.slotDurationMinutes} min · {rule.timezone}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void deleteRuleMutation.mutateAsync({ id: rule.id })}
                      disabled={isReadOnly || isBusy}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {tr("删除", "Delete")}
                    </Button>
                  </div>
                ))}
                {(rulesQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tr("还没有排班规则。", "No schedule rules yet.")}</p>
                ) : null}
              </div>
            )}
          </TabsContent>

          <TabsContent value="exceptions" className="space-y-4">
            <div className="grid gap-3 rounded border p-3 md:grid-cols-3">
              <div>
                <Label>{tr("日期", "Date")}</Label>
                <Input type="date" value={exceptionDate} onChange={event => setExceptionDate(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("动作", "Action")}</Label>
                <Select value={exceptionAction} onValueChange={value => setExceptionAction(value as typeof exceptionAction)} disabled={isReadOnly || isBusy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {exceptionActionOptions.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("备注", "Reason")}</Label>
                <Textarea value={exceptionReason} onChange={event => setExceptionReason(event.target.value)} disabled={isReadOnly || isBusy} className="min-h-[40px]" />
              </div>
              <div>
                <Label>{tr("开始时间", "Start Time")}</Label>
                <Input type="time" value={exceptionStartLocalTime} onChange={event => setExceptionStartLocalTime(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("结束时间", "End Time")}</Label>
                <Input type="time" value={exceptionEndLocalTime} onChange={event => setExceptionEndLocalTime(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  disabled={isReadOnly || isBusy || !hasDoctorId}
                  onClick={() =>
                    void createExceptionMutation.mutateAsync({
                      doctorId,
                      dateLocal: exceptionDate,
                      action: exceptionAction,
                      startLocalTime: exceptionStartLocalTime,
                      endLocalTime: exceptionEndLocalTime,
                      reason: exceptionReason || undefined,
                    })
                  }
                >
                  {tr("新增例外", "Create Exception")}
                </Button>
              </div>
            </div>

            {!hasDoctorId ? (
              <p className="text-sm text-muted-foreground">{tr("输入医生 ID 后查看例外。", "Enter a doctor ID to view exceptions.")}</p>
            ) : exceptionsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在加载例外...", "Loading exceptions...")}
              </div>
            ) : exceptionsQuery.error ? (
              <p className="text-sm text-destructive">{exceptionsQuery.error.message}</p>
            ) : (
              <div className="space-y-2">
                {(exceptionsQuery.data ?? []).map(item => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-slate-50 p-3">
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">{item.dateLocal} · {item.action}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {(item.startLocalTime ?? "--:--")} - {(item.endLocalTime ?? "--:--")}
                        {item.reason ? ` · ${item.reason}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void deleteExceptionMutation.mutateAsync({ id: item.id, doctorId })}
                      disabled={isReadOnly || isBusy}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {tr("删除", "Delete")}
                    </Button>
                  </div>
                ))}
                {(exceptionsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tr("还没有排班例外。", "No schedule exceptions yet.")}</p>
                ) : null}
              </div>
            )}
          </TabsContent>

          <TabsContent value="slots" className="space-y-4">
            <div className="grid gap-3 rounded border p-3 md:grid-cols-3">
              <div>
                <Label>{tr("日期", "Date")}</Label>
                <Input type="date" value={manualDate} onChange={event => setManualDate(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("时间", "Time")}</Label>
                <Input type="time" value={manualTime} onChange={event => setManualTime(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("问诊方式", "Appointment Type")}</Label>
                <Select value={manualAppointmentType} onValueChange={value => setManualAppointmentType(value as typeof manualAppointmentType)} disabled={isReadOnly || isBusy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {appointmentTypeOptions.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tr("slot 时长（分钟）", "Slot Duration (minutes)")}</Label>
                <Input value={manualSlotDurationMinutes} onChange={event => setManualSlotDurationMinutes(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div>
                <Label>{tr("时区", "Timezone")}</Label>
                <Input value={timezone} onChange={event => setTimezone(event.target.value)} disabled={isReadOnly || isBusy} />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  disabled={isReadOnly || isBusy || !hasDoctorId}
                  onClick={() =>
                    void createManualSlotMutation.mutateAsync({
                      doctorId,
                      appointmentType: manualAppointmentType,
                      slotDurationMinutes: Number(manualSlotDurationMinutes),
                      timezone,
                      startAt: new Date(`${manualDate}T${manualTime}:00`),
                    })
                  }
                >
                  {tr("新增 Manual Slot", "Create Manual Slot")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isReadOnly || isBusy || !hasDoctorId}
                  onClick={() => void regenerateSlotsMutation.mutateAsync({ doctorId })}
                >
                  <RefreshCcw className="mr-1.5 h-4 w-4" />
                  {tr("按规则重建", "Regenerate")}
                </Button>
              </div>
            </div>

            {!hasDoctorId ? (
              <p className="text-sm text-muted-foreground">{tr("输入医生 ID 后查看未来 slots。", "Enter a doctor ID to view future slots.")}</p>
            ) : slotsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在加载 slots...", "Loading slots...")}
              </div>
            ) : slotsQuery.error ? (
              <p className="text-sm text-destructive">{slotsQuery.error.message}</p>
            ) : (
              <div className="space-y-2">
                {(slotsQuery.data ?? []).map(slot => (
                  <div key={slot.id} className="flex flex-wrap items-center justify-between gap-3 rounded border bg-slate-50 p-3">
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">
                        {formatDateTime(slot.startAt, lang)} - {formatDateTime(slot.endAt, lang)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatStatus(slot.status, tr)} · {slot.appointmentType} · {slot.source}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {slot.status === "blocked" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void unblockSlotMutation.mutateAsync({ id: slot.id })}
                          disabled={isReadOnly || isBusy}
                        >
                          <ShieldCheck className="mr-1.5 h-4 w-4" />
                          {tr("解封", "Unblock")}
                        </Button>
                      ) : slot.status === "open" || slot.status === "held" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void blockSlotMutation.mutateAsync({ id: slot.id })}
                          disabled={isReadOnly || isBusy}
                        >
                          <ShieldBan className="mr-1.5 h-4 w-4" />
                          {tr("封盘", "Block")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(slotsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tr("还没有未来 slots。", "No future slots yet.")}</p>
                ) : null}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
