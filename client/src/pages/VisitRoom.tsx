import { useMemo, useRef } from "react";
import { useRoute } from "wouter";
import { Loader2, Stethoscope } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedField } from "@/lib/i18n";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function getAppointmentTypeLabel(
  type: "online_chat" | "video_call" | "in_person"
) {
  if (type === "online_chat") return "Online chat";
  if (type === "video_call") return "Video call";
  return "In person";
}

function isInSession(
  scheduledAt: Date | null,
  status: "pending" | "confirmed" | "rescheduled" | "completed" | "cancelled"
) {
  if (status === "completed" || status === "cancelled") {
    return false;
  }
  if (!scheduledAt) {
    return false;
  }
  return scheduledAt.getTime() <= Date.now();
}

export default function VisitRoomPage() {
  const { resolved } = useLanguage();
  const t = getVisitCopy(resolved);
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
    }),
    [appointmentId, token, validInput]
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
    messagesQuery,
    sendMutation,
    setContent,
    handleSend,
    showInitialSkeleton,
  } = useVisits({
    accessInput,
    enabled: validInput,
    scrollContainerRef,
    resolved,
  });

  if (!validInput) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
          {t.invalidToken}
        </Card>
      </main>
    );
  }

  if (appointmentQuery.isLoading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </main>
    );
  }

  if (appointmentQuery.error || !appointmentQuery.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <Card className="rounded-2xl border-slate-200 p-6 text-sm text-slate-600">
          {appointmentQuery.error?.message || t.appointmentNotFound}
        </Card>
      </main>
    );
  }

  const appointment = appointmentQuery.data;
  const doctorData = doctorQuery.data;
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
  const scheduledTimeText =
    scheduledAt?.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }) || "TBD";
  const inSession = isInSession(scheduledAt, appointment.status);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-4 rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 to-emerald-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-600">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">MediBridge</h1>
            <p className="text-xs text-slate-600">
              AI-Powered Medical Bridge to China
            </p>
          </div>
        </div>
      </header>

      <Card className="h-[calc(100vh-11rem)] overflow-hidden rounded-2xl border-slate-200 shadow-sm">
        <header className="shrink-0 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="h-11 w-11 border border-slate-200">
                <AvatarImage
                  src={doctorData?.doctor.imageUrl ?? undefined}
                  alt={doctorName}
                />
                <AvatarFallback className="bg-slate-100 text-slate-700">
                  {doctorName.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {doctorName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {departmentName} · {appointmentType}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={inSession ? "default" : "secondary"}
                  className={
                    inSession
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700"
                  }
                >
                  {inSession ? "In session" : "Scheduled"}
                </Badge>
                {isReconnecting ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    Reconnecting...
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">{scheduledTimeText}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">{t.historyRetentionNote}</p>
        </header>

        <Separator />

        <VisitMessagesList
          showInitialSkeleton={showInitialSkeleton}
          messages={messages}
          scrollContainerRef={scrollContainerRef}
          emptyStateText={t.noMessages}
        />

        <Separator />

        <footer className="shrink-0">
          <ChatComposer
            value={content}
            onChange={setContent}
            onSend={() => void handleSend()}
            disabled={sendMutation.isPending}
            isSending={sendMutation.isPending}
            placeholder={t.composerPlaceholder}
            hint={t.composerHint}
          />
        </footer>
      </Card>
    </main>
  );
}
