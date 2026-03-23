import { useCallback, useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  Calendar,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileSearch,
  Loader2,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { DoctorWorkbenchAppointmentSheet } from "@/features/doctorWorkbench/components/DoctorWorkbenchAppointmentSheet";
import { MedicalSummaryModal } from "@/features/visit/components/MedicalSummaryModal";
import { getVisitCopy } from "@/features/visit/copy";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getDisplayLocale,
  getLocalizedText,
  getLocalizedTextWithZhFallback,
} from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type WorkbenchItem = {
  id: number;
  slotId: number | null;
  doctorId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date | string | null;
  status: string;
  paymentStatus: string;
  patientEmail: string;
  chiefComplaint: string | null;
  packageId: string | null;
  createdAt: Date | string;
};

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

function appointmentTypeLabel(type: string, lang: "zh" | "en") {
  const labels: Record<string, { zh: string; en: string }> = {
    online_chat: { zh: "图文问诊", en: "Online Chat" },
    video_call: { zh: "视频问诊", en: "Video Call" },
    in_person: { zh: "线下面诊", en: "In Person" },
  };
  return labels[type]?.[lang] ?? type;
}

function parseDoctorToken(doctorLink: string) {
  try {
    const url = new URL(doctorLink);
    return url.searchParams.get("t")?.trim() || url.searchParams.get("token")?.trim() || null;
  } catch {
    return null;
  }
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function DoctorWorkbenchPage() {
  const [isCompatRoute, compatParams] = useRoute("/doctor/:id/workbench");
  const [isPrimaryRoute] = useRoute("/doctor/workbench");
  const compatDoctorId = compatParams?.id ? Number(compatParams.id) : null;
  const { resolved } = useLanguage();
  const lang = resolved as "zh" | "en";
  const locale = getDisplayLocale(lang);
  const visitCopy = getVisitCopy(lang);
  const { loading, isAuthenticated, openLoginModal, user } = useAuth();
  const tr = useCallback(
    (zh: string, en: string) =>
      getLocalizedText({ lang, value: { zh, en }, placeholder: zh }),
    [lang]
  );

  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [summaryContext, setSummaryContext] = useState<{
    appointmentId: number;
    token: string;
  } | null>(null);

  const utils = trpc.useUtils();
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
  const detailQuery = trpc.appointments.getDoctorWorkbenchAppointmentDetail.useQuery(
    {
      appointmentId: selectedAppointmentId ?? 0,
      doctorId: isCompatRoute && compatDoctorId ? compatDoctorId : undefined,
      lang,
    },
    {
      enabled:
        isAuthenticated &&
        !bindingMismatch &&
        typeof selectedAppointmentId === "number" &&
        selectedAppointmentId > 0,
    }
  );

  const issueLinksMutation = trpc.appointments.issueAccessLinks.useMutation();
  const startAppointmentMutation = trpc.appointments.startDoctorWorkbenchAppointment.useMutation({
    onSuccess: async () => {
      await Promise.all([
        workbenchQuery.refetch(),
        detailQuery.refetch(),
      ]);
      toast.success(tr("已开始接诊。", "Consultation started."));
    },
    onError: error => {
      toast.error(error.message || tr("开始接诊失败。", "Failed to start consultation."));
    },
  });
  const completeAppointmentMutation = trpc.appointments.completeAppointment.useMutation();

  const doctorName = useMemo(() => {
    const doctor = doctorQuery.data?.doctor;
    if (!doctor) {
      return tr("医生工作台", "Doctor Workbench");
    }
    return getLocalizedTextWithZhFallback({
      lang,
      value: doctor.name,
      placeholder: tr("医生工作台", "Doctor Workbench"),
    });
  }, [doctorQuery.data?.doctor, lang, tr]);

  const allAppointments = useMemo(
    () => [
      ...(workbenchQuery.data?.upcoming ?? []),
      ...(workbenchQuery.data?.recent ?? []),
    ] as WorkbenchItem[],
    [workbenchQuery.data?.recent, workbenchQuery.data?.upcoming]
  );

  const openDetailSheet = (appointmentId: number) => {
    setSelectedAppointmentId(appointmentId);
    setSheetOpen(true);
  };

  const refreshWorkbenchData = useCallback(async () => {
    await Promise.all([
      workbenchQuery.refetch(),
      slotsQuery.refetch(),
      detailQuery.refetch(),
      myBindingQuery.refetch(),
    ]);
  }, [detailQuery, myBindingQuery, slotsQuery, workbenchQuery]);

  const ensureDoctorAccessToken = useCallback(
    async (appointmentId: number) => {
      const issued = await issueLinksMutation.mutateAsync({ appointmentId });
      const token = parseDoctorToken(issued.doctorLink);
      if (!token) {
        throw new Error(tr("无法解析医生房间 token。", "Failed to parse doctor room token."));
      }
      return {
        token,
        doctorLink: issued.doctorLink,
      };
    },
    [issueLinksMutation, tr]
  );

  const startConsultation = useCallback(
    async (appointmentId: number) => {
      try {
        await startAppointmentMutation.mutateAsync({
          appointmentId,
          doctorId: isCompatRoute && compatDoctorId ? compatDoctorId : undefined,
        });
      } catch {
        // Mutation handles toast messaging.
      }
    },
    [compatDoctorId, isCompatRoute, startAppointmentMutation]
  );

  const openDoctorRoom = useCallback(
    async (appointmentId: number) => {
      try {
        const item = allAppointments.find(entry => entry.id === appointmentId);
        if (item?.status === "paid") {
          await startConsultation(appointmentId);
        }
        const issued = await ensureDoctorAccessToken(appointmentId);
        window.location.href = issued.doctorLink;
      } catch (error) {
        toast.error(
          normalizeErrorMessage(
            error,
            tr("无法打开医生房间。", "Unable to open doctor room.")
          )
        );
      }
    },
    [allAppointments, ensureDoctorAccessToken, startConsultation, tr]
  );

  const openSummaryModalFromWorkbench = useCallback(
    async (appointmentId: number) => {
      try {
        const item = allAppointments.find(entry => entry.id === appointmentId);
        const access = await ensureDoctorAccessToken(appointmentId);

        if (item && (item.status === "paid" || item.status === "active")) {
          try {
            await completeAppointmentMutation.mutateAsync({
              appointmentId,
              token: access.token,
            });
          } catch (error) {
            const message = normalizeErrorMessage(
              error,
              tr("结束问诊失败。", "Failed to end consultation.")
            );
            if (message !== "APPOINTMENT_INVALID_STATUS_TRANSITION") {
              throw error;
            }
          }
        }

        setSummaryContext({
          appointmentId,
          token: access.token,
        });
        await refreshWorkbenchData();
      } catch (error) {
        toast.error(
          normalizeErrorMessage(
            error,
            tr("无法打开病历摘要流程。", "Unable to open medical summary workflow.")
          )
        );
      }
    },
    [allAppointments, completeAppointmentMutation, ensureDoctorAccessToken, refreshWorkbenchData, tr]
  );

  const summaryModalCopy = useMemo(
    () => ({
      title: visitCopy.reviewMedicalSummaryTitle,
      aiDisclaimer: visitCopy.medicalSummaryAIDisclaimer,
      chiefComplaintLabel: visitCopy.medicalSummaryChiefComplaint,
      hpiLabel: visitCopy.medicalSummaryHpi,
      pmhLabel: visitCopy.medicalSummaryPmh,
      assessmentLabel: visitCopy.medicalSummaryAssessment,
      planLabel: visitCopy.medicalSummaryPlan,
      cancelText: visitCopy.medicalSummaryCancel,
      regenerateText: visitCopy.medicalSummaryRegenerate,
      signText: visitCopy.medicalSummarySign,
      generatingText: visitCopy.medicalSummaryGenerating,
      signingText: visitCopy.medicalSummarySigning,
      signSuccessText: visitCopy.consultationEndedSuccess,
      draftFailedText: visitCopy.medicalSummaryDraftFailed,
      draftTimeoutText: visitCopy.medicalSummaryDraftTimeout,
      draftTimeoutHintText: visitCopy.medicalSummaryDraftTimeoutHint,
      requiredFieldsText: visitCopy.medicalSummaryRequiredFields,
      signFailedText: visitCopy.medicalSummarySignFailed,
    }),
    [visitCopy]
  );

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
      <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.08),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#f8fafc_48%,#ffffff_100%)]">
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
            <Card className="overflow-hidden border-slate-200/80 shadow-sm">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-cyan-500" />
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Stethoscope className="h-5 w-5 text-teal-600" />
                  {doctorName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <p>
                  {tr(
                    "工作台现在支持查看诊前资料、AI 分诊摘要、快速开始接诊，以及从这里直接结束问诊并签发病历摘要。",
                    "The workbench now supports pre-visit context review, AI triage summary, quick consultation start, and ending the visit with summary signing directly from here."
                  )}
                </p>
                {doctorQuery.data?.doctor ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                      {tr("科室", "Department")} #{doctorQuery.data.doctor.departmentId}
                    </Badge>
                    <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                      ID #{doctorQuery.data.doctor.id}
                    </Badge>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
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
              <Card className="border-slate-200/80 shadow-sm">
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{tr("已签摘要", "Signed Summaries")}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {
                      allAppointments.filter(item =>
                        item.status === "completed" || item.status === "ended"
                      ).length
                    }
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
                    {allAppointments.map(item => (
                      <div key={item.id} className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="border-0 bg-slate-900 text-white">
                                {appointmentTypeLabel(item.appointmentType, lang)}
                              </Badge>
                              <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                                {statusLabel(item.status, lang)}
                              </Badge>
                              {item.packageId ? (
                                <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                                  {item.packageId}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm font-medium text-slate-900">
                              {formatDateTime(item.scheduledAt, locale)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {maskEmail(item.patientEmail)} · {item.paymentStatus}
                            </p>
                            <p className="line-clamp-2 text-sm text-slate-700">
                              {item.chiefComplaint || tr("主诉待补充", "Chief complaint pending")}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openDetailSheet(item.id)}
                            >
                              <FileSearch className="mr-1.5 h-4 w-4" />
                              {tr("查看资料", "Review Context")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={item.status !== "paid" || startAppointmentMutation.isPending}
                              onClick={() => void startConsultation(item.id)}
                            >
                              <Sparkles className="mr-1.5 h-4 w-4" />
                              {tr("开始接诊", "Start")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={
                                !["paid", "active", "ended", "completed"].includes(item.status) ||
                                issueLinksMutation.isPending
                              }
                              onClick={() => void openDoctorRoom(item.id)}
                            >
                              <ExternalLink className="mr-1.5 h-4 w-4" />
                              {tr("进入房间", "Open Room")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {allAppointments.length === 0 ? (
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
                          <ChevronRight className="h-4 w-4 text-slate-400" />
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

      <DoctorWorkbenchAppointmentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        detail={detailQuery.data}
        isLoading={detailQuery.isLoading}
        errorMessage={detailQuery.error?.message ?? null}
        locale={locale}
        tr={tr}
        onStartConsultation={appointmentId => {
          void startConsultation(appointmentId);
        }}
        onOpenRoom={appointmentId => {
          void openDoctorRoom(appointmentId);
        }}
        onCompleteAndSummarize={appointmentId => {
          void openSummaryModalFromWorkbench(appointmentId);
        }}
        isStarting={startAppointmentMutation.isPending}
        isOpeningRoom={issueLinksMutation.isPending}
        isCompleting={completeAppointmentMutation.isPending || issueLinksMutation.isPending}
      />

      {summaryContext ? (
        <MedicalSummaryModal
          open={Boolean(summaryContext)}
          onOpenChange={open => {
            if (!open) {
              setSummaryContext(null);
            }
          }}
          visitId={summaryContext.appointmentId}
          token={summaryContext.token}
          lang={lang}
          copy={summaryModalCopy}
          onSigned={() => {
            void refreshWorkbenchData();
            void detailQuery.refetch();
          }}
        />
      ) : null}
    </AppLayout>
  );
}
