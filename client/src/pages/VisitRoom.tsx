import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField } from "@/lib/i18n";
import {
  formatChinaDateTime,
  formatLocalDateTime,
} from "@/lib/appointmentTime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AppLayout from "@/components/layout/AppLayout";
import { ChatComposer } from "./ChatComposer";
import { VisitMessagesList } from "@/features/visit/components/VisitMessagesList";
import { useVisits } from "@/features/visit/hooks/useVisits";
import { getVisitCopy } from "@/features/visit/copy";

function parseTokenFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("t")?.trim() || "";
}

function interpolateStatus(template: string, status: string) {
  return template.replace("{{status}}", status);
}

export default function VisitRoomPage() {
  const { resolved } = useLanguage();
  const t = getVisitCopy(resolved);
  const pageTitle = resolved === "zh" ? "线上会诊室" : "Visit Room";
  const [, params] = useRoute<{ id: string }>("/visit/:id");
  const appointmentId = Number(params?.id ?? NaN);
  const token = parseTokenFromLocation();
  const validInput =
    Number.isInteger(appointmentId) && appointmentId > 0 && token.length >= 16;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const accessInput = useMemo(
    () => ({
      appointmentId: validInput ? appointmentId : 1,
      token: validInput ? token : "invalid-token-000",
      lang: resolved,
    }),
    [appointmentId, token, validInput, resolved]
  );

  const appointmentQuery = trpc.appointments.getByToken.useQuery(accessInput, {
    enabled: validInput,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const utils = trpc.useUtils();
  const completeAppointmentMutation = trpc.appointments.completeAppointment.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.appointments.getByToken.invalidate(accessInput),
        utils.appointments.listMyAppointments.invalidate(),
        utils.appointments.listMine.invalidate(),
        utils.visit.roomGetMessages.invalidate({ token: accessInput.token, limit: 50 }),
      ]);
      toast.success(t.consultationEndedSuccess);
    },
    onError: error => {
      toast.error(error.message || t.consultationEndFailed);
    },
  });

  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: appointmentQuery.data?.doctorId ?? 0 },
    {
      enabled: Boolean(appointmentQuery.data?.doctorId),
      retry: 1,
    }
  );

  const {
    content,
    isReconnecting,
    messages,
    hasMoreHistory,
    isLoadingOlder,
    pollingFatalError,
    isSending,
    role,
    currentStatus,
    canSendMessage,
    setContent,
    loadOlderMessages,
    handleSend,
    showInitialSkeleton,
  } = useVisits({
    accessInput: { token: accessInput.token },
    enabled: validInput,
    scrollContainerRef,
    resolved,
  });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!validInput) {
    return (
      <AppLayout title={pageTitle}>
        <div className="mx-auto max-w-3xl py-4">
          <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
            {t.invalidToken}
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (appointmentQuery.isLoading) {
    return (
      <AppLayout title={pageTitle}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (appointmentQuery.error || !appointmentQuery.data) {
    return (
      <AppLayout title={pageTitle}>
        <div className="mx-auto max-w-3xl py-4">
          <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
            {appointmentQuery.error?.message || t.appointmentNotFound}
          </Card>
        </div>
      </AppLayout>
    );
  }

  const appointment = appointmentQuery.data;
  const doctorData = doctorQuery.data;
  const viewerRole = role ?? appointment.role;
  const isDoctorView = viewerRole === "doctor";

  const doctorName = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.doctor.name,
        en: doctorData.doctor.nameEn,
        placeholder: t.assignedDoctorFallback,
      })
    : t.assignedDoctorFallback;
  const departmentName = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.department.name,
        en: doctorData.department.nameEn,
        placeholder: t.departmentFallback,
      })
    : t.departmentFallback;
  const doctorTitle = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.doctor.title,
        en: doctorData.doctor.titleEn,
        placeholder: resolved === "zh" ? "医生" : "Doctor",
      })
    : resolved === "zh"
      ? "医生"
      : "Doctor";
  const avatarFallback = doctorName.slice(0, 1).toUpperCase();
  const summaryTitle = resolved === "zh" ? "系统问诊摘要" : "System Intake Summary";
  const intake = appointment.intake;
  const intakeHighlights = [
    intake?.chiefComplaint,
    intake?.duration,
    intake?.otherSymptoms,
    intake?.medicalHistory,
    intake?.medications,
    intake?.allergies,
  ]
    .map(item => item?.trim() ?? "")
    .filter(Boolean);
  const summaryText =
    appointment.triageSummary?.trim() ||
    intakeHighlights.join("；") ||
    t.aiTriageSummaryEmpty;

  const liveStatus = currentStatus ?? "connecting";
  const roomClosedByStatus = appointment.status === "ended";
  const effectiveCanSendMessage = canSendMessage && !roomClosedByStatus;
  const composerHint = effectiveCanSendMessage
    ? t.composerHint
    : interpolateStatus(t.composerReadOnlyHint, liveStatus);
  const composerDisabled =
    isSending || !effectiveCanSendMessage || Boolean(pollingFatalError);

  const localNowText = formatLocalDateTime(now);
  const chinaNowText = formatChinaDateTime(now);

  return (
    <AppLayout title={pageTitle}>
      <div className="flex w-full justify-center bg-slate-50 px-4 py-4 md:py-6">
        <div className="flex h-[calc(100dvh-6.5rem)] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="shrink-0 border-b border-slate-50 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-11 w-11 border border-slate-200">
                  <AvatarImage
                    src={doctorData?.doctor.imageUrl ?? undefined}
                    alt={doctorName}
                  />
                  <AvatarFallback className="bg-slate-100 text-slate-700">
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {doctorName}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {resolved === "zh" ? "● 会诊进行中" : "● Consultation Live"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {departmentName}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {doctorTitle}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="text-[11px] text-slate-400">
                  {resolved === "zh" ? "当地时间" : "Local Time"}: {localNowText}
                </p>
                <p className="text-[11px] text-slate-400">
                  {resolved === "zh" ? "北京时间" : "China Time"}: {chinaNowText}
                </p>
                {isReconnecting ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    {t.reconnecting}
                  </span>
                ) : null}
                {!effectiveCanSendMessage ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] text-slate-600">
                    {t.readOnly}
                  </span>
                ) : null}

                {isDoctorView && !roomClosedByStatus ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={completeAppointmentMutation.isPending}
                      >
                        {t.endConsultation}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.endConsultationTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.endConsultationDesc}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            void completeAppointmentMutation.mutateAsync({
                              appointmentId: appointment.id,
                              token: accessInput.token,
                            })
                          }
                        >
                          {completeAppointmentMutation.isPending
                            ? t.ending
                            : t.confirmEnd}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </div>
            </div>
            {pollingFatalError ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900">
                  {pollingFatalError}
                </p>
              </div>
            ) : null}
          </header>

          <section className="min-h-0 flex-1">
            <div className="flex h-full min-h-0 flex-col">
              <VisitMessagesList
                showInitialSkeleton={showInitialSkeleton}
                currentRole={viewerRole}
                messages={messages}
                summaryTitle={summaryTitle}
                summaryText={summaryText}
                hasMoreHistory={hasMoreHistory}
                isLoadingOlder={isLoadingOlder}
                onLoadOlder={() => void loadOlderMessages()}
                scrollContainerRef={scrollContainerRef}
                emptyStateText={t.noMessages}
                loadEarlierText={t.loadEarlierMessages}
                loadingEarlierText={t.loadingEarlierMessages}
              />
              <footer className="shrink-0 border-t border-slate-100">
                <ChatComposer
                  value={content}
                  onChange={setContent}
                  onSend={() => void handleSend()}
                  disabled={composerDisabled}
                  isSending={isSending}
                  placeholder={t.composerPlaceholder}
                  hint={composerHint}
                  onSelectAttachment={file => {
                    toast.info(
                      resolved === "zh"
                        ? `已选择附件：${file.name}（上传功能即将开放）`
                        : `Attachment selected: ${file.name} (upload will be enabled soon)`
                    );
                  }}
                />
              </footer>
            </div>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
