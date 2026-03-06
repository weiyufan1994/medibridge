import { useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField } from "@/lib/i18n";
import {
  formatChinaDateTime,
  formatLocalDateTime,
  toDate,
} from "@/lib/appointmentTime";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import AppLayout from "@/components/layout/AppLayout";
import { ChatComposer } from "./ChatComposer";
import { VisitMessagesList } from "@/features/visit/components/VisitMessagesList";
import { useVisits } from "@/features/visit/hooks/useVisits";
import { getVisitCopy } from "@/features/visit/copy";

const TRIAGE_SUMMARY_LABEL_MAP = {
  complaint: { zh: "主诉", en: "Chief complaint" },
  duration: { zh: "持续时间", en: "Duration" },
  trigger: { zh: "诱因", en: "Trigger" },
  severity: { zh: "严重程度", en: "Severity" },
  impact: { zh: "对日常活动影响", en: "Impact on daily activities" },
  history: { zh: "既往史", en: "Medical history" },
  medications: { zh: "用药史", en: "Medication history" },
  allergies: { zh: "过敏史", en: "Allergy history" },
  age: { zh: "年龄段", en: "Age group" },
  otherSymptoms: { zh: "其他症状", en: "Other symptoms" },
} as const;

const TRIAGE_SUMMARY_LABEL_ALIASES: Record<string, keyof typeof TRIAGE_SUMMARY_LABEL_MAP> = {
  "chief complaint": "complaint",
  complaint: "complaint",
  "main complaint": "complaint",
  主诉: "complaint",
  duration: "duration",
  持续时间: "duration",
  trigger: "trigger",
  triggers: "trigger",
  诱因: "trigger",
  severity: "severity",
  严重程度: "severity",
  "impact on daily activities": "impact",
  "daily activity impact": "impact",
  "activity impact": "impact",
  "对日常活动影响": "impact",
  "medical history": "history",
  history: "history",
  既往史: "history",
  "medication history": "medications",
  medications: "medications",
  meds: "medications",
  用药史: "medications",
  "allergy history": "allergies",
  allergies: "allergies",
  过敏史: "allergies",
  age: "age",
  "age group": "age",
  年龄段: "age",
  "other symptoms": "otherSymptoms",
  "associated symptoms": "otherSymptoms",
  其他症状: "otherSymptoms",
} as const;

const INTAKE_FIELD_ORDER = [
  "chiefComplaint",
  "duration",
  "medicalHistory",
  "medications",
  "allergies",
  "ageGroup",
  "otherSymptoms",
] as const;

type IntakeFieldKey = (typeof INTAKE_FIELD_ORDER)[number];

function localizeTriageSummary(summary: string, lang: "en" | "zh"): string {
  const normalized = summary
    .split(/[;；]/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const match = part.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
      if (!match) {
        return part;
      }

      const rawLabel = match[1].trim();
      const value = match[2].trim();
      const aliasKey =
        TRIAGE_SUMMARY_LABEL_ALIASES[rawLabel.toLowerCase()] ??
        TRIAGE_SUMMARY_LABEL_ALIASES[rawLabel];
      if (!aliasKey) {
        return part;
      }

      const localizedLabel = TRIAGE_SUMMARY_LABEL_MAP[aliasKey][lang];
      return `${localizedLabel}: ${value}`;
    });

  return normalized.join(lang === "zh" ? "； " : "; ");
}

function parseTokenFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("t")?.trim() || "";
}

function getAppointmentTypeLabel(
  type: "online_chat" | "video_call" | "in_person",
  t: ReturnType<typeof getVisitCopy>
) {
  if (type === "online_chat") return t.appointmentTypeOnline;
  if (type === "video_call") return t.appointmentTypeVideo;
  return t.appointmentTypeInPerson;
}

function maskEmail(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  if (!name || !domain) {
    return email;
  }
  if (name.length <= 2) {
    return `${name[0] ?? "*"}*@${domain}`;
  }
  return `${name.slice(0, 2)}***@${domain}`;
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
  const appointmentType = getAppointmentTypeLabel(appointment.appointmentType, t);
  const scheduledAt = appointment.scheduledAt
    ? toDate(appointment.scheduledAt)
    : null;
  const scheduledTimeText = scheduledAt
    ? viewerRole === "doctor"
      ? formatChinaDateTime(scheduledAt)
      : formatLocalDateTime(scheduledAt)
    : t.tbd;
  const scheduledChinaTimeText = formatChinaDateTime(scheduledAt);
  const patientIdentity =
    appointment.patient.sessionId?.trim() ||
    maskEmail(appointment.patient.email) ||
    t.unknownPatient;

  const doctorHeaderTitle = `🧑‍⚕️ ${doctorName}`;
  const patientLabelPrefix = resolved === "zh" ? "🤒 患者" : "🤒 Patient";
  const patientHeaderTitle = `${patientLabelPrefix} ${patientIdentity}`;
  const headerTitle = isDoctorView ? patientHeaderTitle : doctorHeaderTitle;
  const avatarFallback =
    isDoctorView ? "患" : doctorName.slice(0, 1).toUpperCase();
  const headerSubtitle =
    isDoctorView
      ? `${t.patientContextTitle} · ${patientIdentity}`
      : `${departmentName} · ${appointmentType}`;

  const triageSummary = appointment.triageSummary?.trim() ?? "";
  const localizedTriageSummary = localizeTriageSummary(triageSummary, resolved);
  const intake = appointment.intake;
  const intakeLabelMap: Record<IntakeFieldKey, string> = {
    chiefComplaint: t.intakeChiefComplaint,
    duration: t.intakeDuration,
    medicalHistory: t.intakeMedicalHistory,
    medications: t.intakeMedications,
    allergies: t.intakeAllergies,
    ageGroup: t.intakeAgeGroup,
    otherSymptoms: t.intakeOtherSymptoms,
  };
  const intakeRows = intake
    ? INTAKE_FIELD_ORDER.map(key => {
        const value = intake[key]?.trim() ?? "";
        if (!value) {
          return null;
        }
        return {
          label: intakeLabelMap[key],
          value,
        };
      }).filter((item): item is { label: string; value: string } => Boolean(item))
    : [];

  const liveStatus = currentStatus ?? "connecting";
  const roomClosedByStatus = appointment.status === "ended";
  const effectiveCanSendMessage = canSendMessage && !roomClosedByStatus;
  const composerHint = effectiveCanSendMessage
    ? t.composerHint
    : interpolateStatus(t.composerReadOnlyHint, liveStatus);
  const composerDisabled =
    isSending || !effectiveCanSendMessage || Boolean(pollingFatalError);

  return (
    <AppLayout title={pageTitle}>
      <div className="mx-auto w-full max-w-7xl py-2">
        <Card className="h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border-slate-200 shadow-sm">
          <header className="shrink-0 border-b px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-11 w-11 border border-slate-200">
                  {!isDoctorView ? (
                    <AvatarImage
                      src={doctorData?.doctor.imageUrl ?? undefined}
                      alt={doctorName}
                    />
                  ) : null}
                  <AvatarFallback className="bg-slate-100 text-slate-700">
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {headerTitle}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {headerSubtitle}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={effectiveCanSendMessage ? "default" : "secondary"}
                    className={
                      effectiveCanSendMessage
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-700"
                    }
                  >
                    {effectiveCanSendMessage ? t.chatEnabled : t.readOnly}
                  </Badge>
                  {isReconnecting ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {t.reconnecting}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">{scheduledTimeText}</p>
                {!isDoctorView ? (
                  <p className="text-xs text-slate-400">
                    {t.doctorTimeChina}: {scheduledChinaTimeText}
                  </p>
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
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">
                {t.roomStatus}: {liveStatus}
              </p>
            </div>
            {pollingFatalError ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900">
                  {pollingFatalError}
                </p>
              </div>
            ) : null}
          </header>

          <div className={`grid h-[calc(100%-8.75rem)] min-h-0 ${isDoctorView ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]" : "grid-cols-1"}`}>
            <section className="min-h-0 border-r-0 lg:border-r lg:border-slate-100">
              <div className="flex h-full min-h-0 flex-col">
                <VisitMessagesList
                  showInitialSkeleton={showInitialSkeleton}
                  currentRole={viewerRole}
                  messages={messages}
                  hasMoreHistory={hasMoreHistory}
                  isLoadingOlder={isLoadingOlder}
                  onLoadOlder={() => void loadOlderMessages()}
                  scrollContainerRef={scrollContainerRef}
                  emptyStateText={t.noMessages}
                  loadEarlierText={t.loadEarlierMessages}
                  loadingEarlierText={t.loadingEarlierMessages}
                />
                <Separator />
                <footer className="shrink-0">
                  <ChatComposer
                    value={content}
                    onChange={setContent}
                    onSend={() => void handleSend()}
                    disabled={composerDisabled}
                    isSending={isSending}
                    placeholder={t.composerPlaceholder}
                    hint={composerHint}
                  />
                </footer>
              </div>
            </section>

            {isDoctorView ? (
              <aside className="hidden min-h-0 bg-slate-50/70 lg:block">
                <div className="h-full overflow-y-auto p-4">
                  <div className="sticky top-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <Accordion type="multiple" defaultValue={["context", "triage", "intake"]}>
                      <AccordionItem value="context">
                        <AccordionTrigger>{t.patientContextTitle}</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 text-xs text-slate-600">
                            <p>
                              <span className="font-medium text-slate-800">{resolved === "zh" ? "患者" : "Patient"}: </span>
                              {patientIdentity}
                            </p>
                            <p>
                              <span className="font-medium text-slate-800">{resolved === "zh" ? "科室" : "Department"}: </span>
                              {departmentName}
                            </p>
                            <p>
                              <span className="font-medium text-slate-800">{resolved === "zh" ? "会诊类型" : "Visit Type"}: </span>
                              {appointmentType}
                            </p>
                            <p>
                              <span className="font-medium text-slate-800">{resolved === "zh" ? "预约时间" : "Scheduled"}: </span>
                              {scheduledTimeText}
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="triage">
                        <AccordionTrigger>{t.aiTriageSummaryTitle}</AccordionTrigger>
                        <AccordionContent>
                          {localizedTriageSummary ? (
                            <p className="text-xs leading-relaxed text-slate-600">
                              {localizedTriageSummary}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">{t.aiTriageSummaryEmpty}</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="intake">
                        <AccordionTrigger>{t.preVisitIntakeTitle}</AccordionTrigger>
                        <AccordionContent>
                          {intakeRows.length > 0 ? (
                            <div className="space-y-1.5">
                              {intakeRows.map(row => (
                                <p key={row.label} className="text-xs leading-relaxed text-slate-600">
                                  <span className="font-medium text-slate-700">{row.label}: </span>
                                  {row.value}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">{t.intakeEmpty}</p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
