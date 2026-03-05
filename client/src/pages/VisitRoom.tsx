import { useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
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
  type: "online_chat" | "video_call" | "in_person"
) {
  if (type === "online_chat") return "Online chat";
  if (type === "video_call") return "Video call";
  return "In person";
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
    retry: 0,
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
  const doctorName = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.doctor.name,
        en: doctorData.doctor.nameEn,
        placeholder: "Assigned doctor",
      })
    : "Assigned doctor";
  const departmentName = doctorData
    ? getLocalizedField({
        lang: resolved,
        zh: doctorData.department.name,
        en: doctorData.department.nameEn,
        placeholder: "Department",
      })
    : "Department";
  const appointmentType = getAppointmentTypeLabel(appointment.appointmentType);
  const scheduledAt = appointment.scheduledAt
    ? toDate(appointment.scheduledAt)
    : null;
  const scheduledTimeText = scheduledAt
    ? viewerRole === "doctor"
      ? formatChinaDateTime(scheduledAt)
      : formatLocalDateTime(scheduledAt)
    : "TBD";
  const scheduledChinaTimeText = formatChinaDateTime(scheduledAt);
  const patientIdentity =
    appointment.patient.sessionId?.trim() ||
    maskEmail(appointment.patient.email) ||
    "Unknown patient";
  const doctorHeaderTitle = `🧑‍⚕️ ${doctorName}`;
  const patientLabelPrefix = resolved === "zh" ? "🤒 患者" : "🤒 Patient";
  const patientHeaderTitle = `${patientLabelPrefix} ${patientIdentity}`;
  const headerTitle =
    viewerRole === "doctor" ? patientHeaderTitle : doctorHeaderTitle;
  const avatarFallback =
    viewerRole === "doctor" ? "患" : doctorName.slice(0, 1).toUpperCase();
  const headerSubtitle =
    viewerRole === "doctor"
      ? `${resolved === "zh" ? "患者摘要" : "Patient context"} · ${patientIdentity}`
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
  const composerHint = canSendMessage
    ? t.composerHint
    : `Read-only (${liveStatus})`;
  const composerDisabled = isSending || !canSendMessage || Boolean(pollingFatalError);

  return (
    <AppLayout title={pageTitle}>
      <div className="mx-auto w-full max-w-5xl py-2">
        <Card className="h-[calc(100vh-9rem)] overflow-hidden rounded-2xl border-slate-200 shadow-sm">
          <header className="shrink-0 px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-11 w-11 border border-slate-200">
                  {viewerRole === "patient" ? (
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
                    variant={canSendMessage ? "default" : "secondary"}
                    className={canSendMessage ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}
                  >
                    {canSendMessage ? "Chat enabled" : "Read only"}
                  </Badge>
                  {isReconnecting ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Reconnecting...
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">{scheduledTimeText}</p>
                {viewerRole === "patient" ? (
                  <p className="text-xs text-slate-400">
                    Doctor time (China): {scheduledChinaTimeText}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-600">Room status: {liveStatus}</p>
            </div>
            {triageSummary.length > 0 ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700">
                  {resolved === "zh" ? "AI 分诊摘要" : "AI Triage Summary"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {localizedTriageSummary}
                </p>
              </div>
            ) : null}
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">{t.intakeTitle}</p>
              {intakeRows.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {intakeRows.map(row => (
                    <p key={row.label} className="text-xs leading-relaxed text-slate-600">
                      <span className="font-medium text-slate-700">{row.label}: </span>
                      {row.value}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.intakeEmpty}</p>
              )}
            </div>
            {pollingFatalError ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-900">
                  {pollingFatalError}
                </p>
              </div>
            ) : null}
          </header>

          <Separator />

          <VisitMessagesList
            showInitialSkeleton={showInitialSkeleton}
            currentRole={viewerRole}
            messages={messages}
            hasMoreHistory={hasMoreHistory}
            isLoadingOlder={isLoadingOlder}
            onLoadOlder={() => void loadOlderMessages()}
            scrollContainerRef={scrollContainerRef}
            emptyStateText={t.noMessages}
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
        </Card>
      </div>
    </AppLayout>
  );
}
