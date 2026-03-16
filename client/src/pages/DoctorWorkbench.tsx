import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { Calendar, Clock3, ExternalLink, Loader2, Stethoscope } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function formatDateTime(value: Date | string | null, locale: string) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return email;
  }
  if (name.length <= 2) {
    return `${name[0] ?? "*"}*@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

function statusLabel(status: string, lang: "zh" | "en") {
  const labels: Record<string, { zh: string; en: string }> = {
    pending_payment: { zh: "待支付", en: "Pending Payment" },
    paid: { zh: "待接诊", en: "Ready" },
    active: { zh: "进行中", en: "In Progress" },
    ended: { zh: "已结束", en: "Ended" },
    completed: { zh: "已完成", en: "Completed" },
    canceled: { zh: "已取消", en: "Canceled" },
    expired: { zh: "已过期", en: "Expired" },
  };
  return labels[status]?.[lang] ?? status;
}

export default function DoctorWorkbenchPage() {
  const [isCompatRoute, compatParams] = useRoute("/doctor/:id/workbench");
  const [isPrimaryRoute] = useRoute("/doctor/workbench");
  const compatDoctorId = compatParams?.id ? Number(compatParams.id) : null;
  const { resolved } = useLanguage();
  const lang = resolved as "zh" | "en";
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const { loading, isAuthenticated, openLoginModal, user } = useAuth();
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);

  const myBindingQuery = trpc.doctorAccounts.getMyBinding.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const boundDoctorId = myBindingQuery.data?.activeBinding?.doctorId ?? null;
  const effectiveDoctorId = isCompatRoute && compatDoctorId ? compatDoctorId : boundDoctorId;
  const bindingMismatch =
    Boolean(isCompatRoute && compatDoctorId && boundDoctorId && compatDoctorId !== boundDoctorId);

  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: effectiveDoctorId ?? 0 },
    { enabled: typeof effectiveDoctorId === "number" && effectiveDoctorId > 0 }
  );
  const workbenchQuery = trpc.appointments.listDoctorWorkbench.useQuery(
    { doctorId: isCompatRoute && compatDoctorId ? compatDoctorId : undefined, limit: 30 },
    {
      enabled:
        isAuthenticated &&
        !bindingMismatch &&
        typeof effectiveDoctorId === "number" &&
        effectiveDoctorId > 0,
    }
  );
  const slotsQuery = trpc.scheduling.listDoctorUpcomingSlots.useQuery(
    { doctorId: isCompatRoute && compatDoctorId ? compatDoctorId : undefined },
    {
      enabled:
        isAuthenticated &&
        !bindingMismatch &&
        typeof effectiveDoctorId === "number" &&
        effectiveDoctorId > 0,
    }
  );
  const issueLinksMutation = trpc.appointments.issueAccessLinks.useMutation({
    onError: error => {
      toast.error(error.message || tr("无法生成医生访问链接。", "Unable to issue doctor access link."));
    },
  });

  const doctorName = useMemo(() => {
    const doctor = doctorQuery.data?.doctor;
    if (!doctor) {
      return tr("医生工作台", "Doctor Workbench");
    }
    return lang === "zh" ? doctor.name : doctor.nameEn || doctor.name;
  }, [doctorQuery.data?.doctor, lang]);

  const openDoctorRoom = async (appointmentId: number) => {
    const issued = await issueLinksMutation.mutateAsync({ appointmentId });
    window.location.href = issued.doctorLink;
  };

  if (loading) {
    return (
      <AppLayout title={tr("医生工作台", "Doctor Workbench")}>
        <div className="flex min-h-[50vh] w-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppLayout title={tr("医生工作台", "Doctor Workbench")}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>{tr("需要先登录", "Login Required")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>{tr("医生工作台当前要求已登录后访问。", "The doctor workbench currently requires authentication.")}</p>
              <Button onClick={openLoginModal}>{tr("登录后继续", "Sign In to Continue")}</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (bindingMismatch) {
    return (
      <AppLayout title={tr("医生工作台", "Doctor Workbench")}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>{tr("工作台访问被拒绝", "Workbench Access Denied")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>
                {tr(
                  "当前登录账号已绑定到其他医生档案，不能访问这个 doctorId 的工作台。",
                  "The current account is bound to a different doctor and cannot access this workbench URL."
                )}
              </p>
              <Link href="/doctor/workbench">
                <Button>{tr("进入我的工作台", "Open My Workbench")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!boundDoctorId) {
    return (
      <AppLayout title={tr("医生工作台", "Doctor Workbench")}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>{tr("尚未开通工作台", "Workbench Not Enabled")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>
                {tr(
                  "当前邮箱还没有绑定医生工作台。请让管理员发送邀请，并使用受邀邮箱登录后完成认领。",
                  "This account is not bound to a doctor workbench yet. Ask an admin to send an invite, then claim it with the invited email."
                )}
              </p>
              <p className="text-xs text-slate-500">
                {user?.email
                  ? tr(`当前登录邮箱：${user.email}`, `Signed in as: ${user.email}`)
                  : tr("当前账号没有绑定邮箱。", "The current account does not have a bound email.")}
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={tr("医生工作台", "Doctor Workbench")}
      rightElements={
        effectiveDoctorId ? (
          <Link href={`/doctor/${effectiveDoctorId}`}>
            <Button variant="outline">{tr("返回医生主页", "Back to Doctor Page")}</Button>
          </Link>
        ) : undefined
      }
    >
      <main className="min-h-screen w-full bg-slate-50">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
          {isPrimaryRoute ? null : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {tr(
                "这是兼容旧 doctorId 路由的入口。正式入口已经切换到 /doctor/workbench。",
                "This page is serving a legacy doctorId route. The canonical workbench entry is now /doctor/workbench."
              )}
            </div>
          )}

          <section className="grid gap-4 lg:grid-cols-[1.35fr,0.65fr]">
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Stethoscope className="h-5 w-5 text-teal-600" />
                  {doctorName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>
                  {tr(
                    "这是医生工作台的只读 MVP：查看未来预约、未来 slots，并通过现有访问链接进入问诊房间。",
                    "This is the read-only doctor workbench MVP: view upcoming bookings, future slots, and enter visit rooms through issued access links."
                  )}
                </p>
                {doctorQuery.data?.doctor ? (
                  <p className="text-xs text-slate-500">
                    {tr("科室", "Department")} #{doctorQuery.data.doctor.departmentId} · ID #{doctorQuery.data.doctor.id}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="border-slate-200/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{tr("未来预约", "Upcoming Visits")}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {workbenchQuery.data?.upcoming.length ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-slate-200/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{tr("未来 Slots", "Future Slots")}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {slotsQuery.data?.length ?? 0}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle>{tr("待接诊与近期预约", "Upcoming and Recent Appointments")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {workbenchQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr("正在加载预约...", "Loading appointments...")}
                  </div>
                ) : workbenchQuery.error ? (
                  <p className="text-sm text-destructive">{workbenchQuery.error.message}</p>
                ) : (
                  <>
                    {[...(workbenchQuery.data?.upcoming ?? []), ...(workbenchQuery.data?.recent ?? [])].map(item => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-900">
                              {formatDateTime(item.scheduledAt, locale)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {maskEmail(item.patientEmail)} · {statusLabel(item.status, lang)} · {item.appointmentType}
                            </p>
                            <p className="text-sm text-slate-700">
                              {item.chiefComplaint || tr("主诉待补充", "Chief complaint pending")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!["paid", "active", "ended", "completed"].includes(item.status) || issueLinksMutation.isPending}
                              onClick={() => void openDoctorRoom(item.id)}
                            >
                              <ExternalLink className="mr-1.5 h-4 w-4" />
                              {tr("进入房间", "Open Room")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(workbenchQuery.data?.upcoming.length ?? 0) + (workbenchQuery.data?.recent.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-500">{tr("当前没有可显示的预约。", "No appointments to show.")}</p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle>{tr("未来可售 Slots", "Future Sellable Slots")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {slotsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tr("正在加载 slots...", "Loading slots...")}
                  </div>
                ) : slotsQuery.error ? (
                  <p className="text-sm text-destructive">{slotsQuery.error.message}</p>
                ) : (
                  <>
                    {(slotsQuery.data ?? []).map(slot => (
                      <div key={slot.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                              <Calendar className="h-4 w-4 text-teal-600" />
                              {formatDateTime(slot.startAt, locale)}
                            </p>
                            <p className="flex items-center gap-2 text-xs text-slate-500">
                              <Clock3 className="h-3.5 w-3.5" />
                              {slot.slotDurationMinutes} min · {slot.appointmentType} · {slot.status}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(slotsQuery.data?.length ?? 0) === 0 ? (
                      <p className="text-sm text-slate-500">{tr("当前没有未来 slots。", "No future slots yet.")}</p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </AppLayout>
  );
}
