import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatAppointmentTimes } from "@/lib/appointmentTime";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDashboardAppointmentCopy } from "@/features/dashboard/copy";
import { PatientSummaryModal } from "@/features/visit/components/PatientSummaryModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MyAppointmentItem = {
  id: number;
  doctorId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date | string | null;
  status:
    | "draft"
    | "pending_payment"
    | "paid"
    | "active"
    | "ended"
    | "completed"
    | "expired"
    | "refunded"
    | "canceled";
  paymentStatus:
    | "unpaid"
    | "pending"
    | "paid"
    | "failed"
    | "expired"
    | "refunded"
    | "canceled";
  createdAt: Date | string;
};

type AppointmentSectionVariant = "upcoming" | "past";
type AppointmentTab = "upcoming" | "past_visits";

const UPCOMING_STATUSES = new Set<MyAppointmentItem["status"]>([
  "draft",
  "pending_payment",
  "paid",
  "active",
]);

function toAppointmentTypeLabel(
  type: MyAppointmentItem["appointmentType"],
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  if (type === "online_chat") return t.typeOnline;
  if (type === "video_call") return t.typeVideo;
  return t.typeInPerson;
}

function toStatusLabel(
  item: MyAppointmentItem,
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  if (
    (item.status === "paid" || item.status === "active") &&
    isScheduledInFuture(item)
  ) {
    return t.statusNotStarted;
  }
  const status = item.status;
  if (status === "draft") return t.statusDraft;
  if (status === "pending_payment") return t.statusPendingPayment;
  if (status === "paid") return t.statusPaid;
  if (status === "active") return t.statusActive;
  if (status === "ended") return t.statusEnded;
  if (status === "completed") return t.statusCompleted;
  if (status === "expired") return t.statusExpired;
  if (status === "refunded") return t.statusRefunded;
  return t.statusCanceled;
}

function getHint(
  item: MyAppointmentItem,
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  if (item.status === "pending_payment") return t.hintPendingPayment;
  if (item.status === "paid" && isScheduledInFuture(item)) return t.hintNotStarted;
  if (item.status === "paid") return t.hintPaid;
  if (item.status === "active" && isScheduledInFuture(item)) return t.hintNotStarted;
  if (item.status === "active") return t.hintActive;
  if (item.status === "ended" || item.status === "completed") return t.hintEnded;
  return t.hintInactive;
}

function getStatusBadgeClass(
  variant: AppointmentSectionVariant,
  item: MyAppointmentItem
) {
  if (
    (item.status === "paid" || item.status === "active") &&
    isScheduledInFuture(item)
  ) {
    return "rounded-full border border-sky-100 bg-sky-50 text-sky-700";
  }
  const status = item.status;
  if (status === "paid") {
    return "rounded-full border border-teal-100 bg-teal-50 text-teal-700";
  }
  if (variant === "upcoming") {
    return "rounded-full border border-teal-100 bg-teal-50 text-teal-700";
  }
  if (status === "ended" || status === "completed") {
    return "rounded-full border-0 bg-emerald-100 text-emerald-700";
  }
  return "rounded-full border-0 bg-slate-100 text-slate-600";
}

function parseDate(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isScheduledInFuture(item: MyAppointmentItem, now = new Date()) {
  const scheduledAt = parseDate(item.scheduledAt);
  if (!scheduledAt) {
    return false;
  }
  return scheduledAt.getTime() > now.getTime();
}

function canEnterVisitRoomNow(item: MyAppointmentItem, now = new Date()) {
  if (item.status !== "paid" && item.status !== "active") {
    return true;
  }
  return !isScheduledInFuture(item, now);
}

function getUpcomingActionLabel(
  item: MyAppointmentItem,
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  if (item.status === "pending_payment" || item.status === "draft") {
    return t.payNow;
  }
  return t.enterVisitRoom;
}

function mapAppointmentActionErrorMessage(
  error: unknown,
  t: ReturnType<typeof getDashboardAppointmentCopy>
) {
  const raw = error instanceof Error ? error.message : t.actionFailed;
  if (raw === "APPOINTMENT_NOT_STARTED") {
    return t.hintNotStarted;
  }
  if (raw === "APPOINTMENT_NOT_ALLOWED") {
    return t.hintInactive;
  }
  return raw;
}

function sortByScheduledAtDesc(items: MyAppointmentItem[]) {
  return [...items].sort((left, right) => {
    const leftTime = parseDate(left.scheduledAt)?.getTime() ?? 0;
    const rightTime = parseDate(right.scheduledAt)?.getTime() ?? 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return right.id - left.id;
  });
}

function extractTokenFromJoinUrl(joinUrl: string) {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const parsed = new URL(joinUrl, window.location.origin);
    return parsed.searchParams.get("t")?.trim() ?? "";
  } catch {
    return "";
  }
}

function DoctorAvatar(props: { doctorName: string; imageUrl?: string | null }) {
  return (
    <Avatar className="h-10 w-10 border border-slate-100">
      <AvatarImage src={props.imageUrl ?? undefined} />
      <AvatarFallback className="bg-slate-100 text-slate-700">
        {props.doctorName.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

function AppointmentCard(props: {
  item: MyAppointmentItem;
  t: ReturnType<typeof getDashboardAppointmentCopy>;
  resolved: "en" | "zh";
  section: AppointmentSectionVariant;
  onUpcomingAction: (item: MyAppointmentItem) => Promise<void>;
  onResend: (appointmentId: number) => Promise<void>;
  onViewMedicalSummary: (item: MyAppointmentItem) => Promise<void>;
  onViewChatHistory: (item: MyAppointmentItem) => Promise<void>;
  isActing: boolean;
}) {
  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: props.item.doctorId },
    {
      enabled: props.item.doctorId > 0,
      retry: 1,
    }
  );

  const doctorName =
    props.resolved === "zh"
      ? doctorQuery.data?.doctor?.name ||
        doctorQuery.data?.doctor?.nameEn ||
        props.t.doctorFallback.replace("{{id}}", String(props.item.doctorId))
      : doctorQuery.data?.doctor?.nameEn ||
        doctorQuery.data?.doctor?.name ||
        props.t.doctorFallback.replace("{{id}}", String(props.item.doctorId));
  const doctorImage = doctorQuery.data?.doctor?.imageUrl;
  const locale = props.resolved === "zh" ? "zh-CN" : "en-US";
  const timeDisplay = formatAppointmentTimes(props.item.scheduledAt, "-", locale);
  const isScheduleLocked = !canEnterVisitRoomNow(props.item);
  const actionLabel = getUpcomingActionLabel(props.item, props.t);

  return (
    <article className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="flex items-center gap-3">
          <DoctorAvatar doctorName={doctorName} imageUrl={doctorImage} />
          <div>
            <p className="text-base font-semibold text-slate-900">{doctorName}</p>
            <p className="text-sm text-slate-500">
              {toAppointmentTypeLabel(props.item.appointmentType, props.t)}
            </p>
          </div>
        </div>
        <Badge className={getStatusBadgeClass(props.section, props.item)}>
          {toStatusLabel(props.item, props.t)}
        </Badge>
      </div>

      <div className="px-5 pb-5">
        <div className="grid gap-3 rounded-lg border border-slate-100 bg-teal-50/30 p-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {props.t.localTimeLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{timeDisplay.localTime}</p>
          </div>
          <div className="flex justify-center">
            <ArrowRight className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {props.t.chinaTimeLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{timeDisplay.doctorTime}</p>
          </div>
        </div>
      </div>

      <Separator className="bg-slate-200/80" />

      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-slate-500">{getHint(props.item, props.t)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {props.section === "upcoming" ? (
            <>
              <Button
                type="button"
                className="h-11 rounded-lg bg-teal-600 px-4 text-white hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600"
                onClick={() => {
                  void props.onUpcomingAction(props.item);
                }}
                disabled={props.isActing || isScheduleLocked}
              >
                {actionLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-lg border-teal-200 px-4 text-teal-700 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600"
                onClick={() => {
                  void props.onResend(props.item.id);
                }}
                disabled={props.isActing}
              >
                {props.t.resendLink}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                className="h-11 rounded-lg bg-teal-600 px-4 text-white hover:bg-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600"
                onClick={() => {
                  void props.onViewMedicalSummary(props.item);
                }}
                disabled={props.isActing}
              >
                {props.t.viewMedicalSummary}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-lg border-teal-200 px-4 text-teal-700 hover:bg-teal-50 focus-visible:ring-2 focus-visible:ring-teal-600"
                onClick={() => {
                  void props.onViewChatHistory(props.item);
                }}
                disabled={props.isActing}
              >
                {props.t.viewChatHistory}
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function AppointmentList(props: {
  t: ReturnType<typeof getDashboardAppointmentCopy>;
  resolved: "en" | "zh";
  items: MyAppointmentItem[];
  section: AppointmentSectionVariant;
  onUpcomingAction: (item: MyAppointmentItem) => Promise<void>;
  onResend: (appointmentId: number) => Promise<void>;
  onViewMedicalSummary: (item: MyAppointmentItem) => Promise<void>;
  onViewChatHistory: (item: MyAppointmentItem) => Promise<void>;
  actingAppointmentId: number | null;
  tabLabel: string;
}) {
  return (
    <section aria-label={props.tabLabel} className="space-y-3">
      {props.items.length > 0 ? (
        <div className="space-y-3">
          {props.items.map(item => (
            <AppointmentCard
              key={item.id}
              item={item}
              t={props.t}
              resolved={props.resolved}
              section={props.section}
              onUpcomingAction={props.onUpcomingAction}
              onResend={props.onResend}
              onViewMedicalSummary={props.onViewMedicalSummary}
              onViewChatHistory={props.onViewChatHistory}
              isActing={props.actingAppointmentId === item.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50 p-4 text-sm text-slate-500">
          {props.t.emptySection}
        </div>
      )}
    </section>
  );
}

export function MyAppointments() {
  const [activeTab, setActiveTab] = React.useState<AppointmentTab>("upcoming");
  const [actingAppointmentId, setActingAppointmentId] = React.useState<number | null>(null);
  const [summaryModalOpen, setSummaryModalOpen] = React.useState(false);
  const [summaryAccess, setSummaryAccess] = React.useState<{
    appointmentId: number;
    token: string;
  } | null>(null);

  const { resolved } = useLanguage();
  const t = getDashboardAppointmentCopy(resolved);
  const query = trpc.appointments.listMyAppointments.useQuery();
  const resendMutation = trpc.appointments.resendLink.useMutation();
  const openRoomMutation = trpc.appointments.openMyRoom.useMutation();
  const retryPaymentMutation = trpc.payments.createCheckoutSessionForAppointment.useMutation();

  const summaryQueryInput = React.useMemo(
    () => ({
      appointmentId: summaryAccess?.appointmentId ?? 1,
      token: summaryAccess?.token ?? "summary-placeholder-token",
      lang: resolved,
    }),
    [resolved, summaryAccess]
  );

  const summaryDetailQuery = trpc.appointments.getByToken.useQuery(summaryQueryInput, {
    enabled: Boolean(summaryAccess && summaryModalOpen),
    retry: 1,
  });
  const summaryDoctorQuery = trpc.doctors.getById.useQuery(
    { id: summaryDetailQuery.data?.doctorId ?? 0 },
    {
      enabled: Boolean(summaryModalOpen && summaryDetailQuery.data?.doctorId),
      retry: 1,
    }
  );

  const handleTabChange = (value: string) => {
    if (value === "upcoming" || value === "past_visits") {
      setActiveTab(value);
    }
  };

  const handleOpenAccess = async (item: MyAppointmentItem) => {
    setActingAppointmentId(item.id);
    try {
      if (item.status === "pending_payment" || item.status === "draft") {
        const checkout = await retryPaymentMutation.mutateAsync({
          appointmentId: item.id,
        });
        if (typeof window !== "undefined") {
          window.location.href = checkout.checkoutSessionUrl;
        }
        return;
      }

      if (
        item.status === "paid" ||
        item.status === "active" ||
        item.status === "ended" ||
        item.status === "completed"
      ) {
        const result = await openRoomMutation.mutateAsync({
          appointmentId: item.id,
        });
        if (typeof window !== "undefined") {
          window.location.href = result.joinUrl;
        }
        return;
      }

      const result = await resendMutation.mutateAsync({ appointmentId: item.id });
      if (result.devLink && typeof window !== "undefined") {
        const nextUrl = new URL(result.devLink);
        window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
        return;
      }
      toast.success(t.accessSentEmail);
    } catch (error) {
      const message = mapAppointmentActionErrorMessage(error, t);
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleViewChatHistory = async (item: MyAppointmentItem) => {
    setActingAppointmentId(item.id);
    try {
      const result = await openRoomMutation.mutateAsync({
        appointmentId: item.id,
      });
      if (typeof window !== "undefined") {
        window.location.href = result.joinUrl;
      }
    } catch (error) {
      const message = mapAppointmentActionErrorMessage(error, t);
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleViewMedicalSummary = async (item: MyAppointmentItem) => {
    setActingAppointmentId(item.id);
    try {
      const result = await openRoomMutation.mutateAsync({
        appointmentId: item.id,
      });
      const token = extractTokenFromJoinUrl(result.joinUrl);
      if (!token) {
        throw new Error(t.medicalSummaryLoadFailed);
      }
      setSummaryAccess({
        appointmentId: item.id,
        token,
      });
      setSummaryModalOpen(true);
    } catch (error) {
      const message = mapAppointmentActionErrorMessage(error, t);
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleResend = async (appointmentId: number) => {
    setActingAppointmentId(appointmentId);
    try {
      await resendMutation.mutateAsync({ appointmentId });
      toast.success(t.accessSent);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.resendFailed;
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleSummaryOpenChange = (nextOpen: boolean) => {
    setSummaryModalOpen(nextOpen);
    if (!nextOpen) {
      setSummaryAccess(null);
    }
  };

  if (query.isLoading) {
    return (
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            {t.loadingAppointments}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.error) {
    return (
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">{t.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{query.error.message}</p>
        </CardContent>
      </Card>
    );
  }

  const data = query.data ?? {
    upcoming: [],
    completed: [],
    past: [],
  };
  const allItems = [...data.upcoming, ...data.completed, ...data.past];
  const upcomingItems = sortByScheduledAtDesc(
    allItems.filter(item => UPCOMING_STATUSES.has(item.status))
  );
  const pastVisitItems = sortByScheduledAtDesc(
    allItems.filter(item => item.status === "ended" || item.status === "completed")
  );

  const summaryDoctorId = summaryDetailQuery.data?.doctorId ?? null;
  const summaryDoctorFallback = t.doctorFallback.replace(
    "{{id}}",
    summaryDoctorId ? String(summaryDoctorId) : "-"
  );
  const summaryDoctorName =
    resolved === "zh"
      ? summaryDoctorQuery.data?.doctor?.name ||
        summaryDoctorQuery.data?.doctor?.nameEn ||
        summaryDoctorFallback
      : summaryDoctorQuery.data?.doctor?.nameEn ||
        summaryDoctorQuery.data?.doctor?.name ||
        summaryDoctorFallback;

  return (
    <>
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">{t.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-4">
            <TabsList
              aria-label={t.title}
              className="h-11 rounded-xl bg-slate-100 p-1"
            >
              <TabsTrigger
                value="upcoming"
                className="h-9 min-w-[130px] rounded-lg px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm"
              >
                {t.tabUpcoming}
              </TabsTrigger>
              <TabsTrigger
                value="past_visits"
                className="h-9 min-w-[130px] rounded-lg px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm"
              >
                {t.tabPastVisits}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              <AppointmentList
                t={t}
                resolved={resolved}
                section="upcoming"
                items={upcomingItems}
                onUpcomingAction={handleOpenAccess}
                onResend={handleResend}
                onViewMedicalSummary={handleViewMedicalSummary}
                onViewChatHistory={handleViewChatHistory}
                actingAppointmentId={actingAppointmentId}
                tabLabel={t.tabUpcoming}
              />
            </TabsContent>
            <TabsContent value="past_visits">
              <AppointmentList
                t={t}
                resolved={resolved}
                section="past"
                items={pastVisitItems}
                onUpcomingAction={handleOpenAccess}
                onResend={handleResend}
                onViewMedicalSummary={handleViewMedicalSummary}
                onViewChatHistory={handleViewChatHistory}
                actingAppointmentId={actingAppointmentId}
                tabLabel={t.tabPastVisits}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <PatientSummaryModal
        open={summaryModalOpen}
        onOpenChange={handleSummaryOpenChange}
        resolved={resolved}
        doctorName={summaryDoctorName}
        scheduledAt={summaryDetailQuery.data?.scheduledAt ?? null}
        summary={
          summaryDetailQuery.data?.medicalSummary
            ? {
                chiefComplaint: summaryDetailQuery.data.medicalSummary.chiefComplaint,
                historyOfPresentIllness:
                  summaryDetailQuery.data.medicalSummary.historyOfPresentIllness,
                pastMedicalHistory: summaryDetailQuery.data.medicalSummary.pastMedicalHistory,
                assessmentDiagnosis: summaryDetailQuery.data.medicalSummary.assessmentDiagnosis,
                planRecommendations: summaryDetailQuery.data.medicalSummary.planRecommendations,
                updatedAt: summaryDetailQuery.data.medicalSummary.updatedAt,
              }
            : null
        }
        isLoading={summaryDetailQuery.isLoading}
        errorMessage={summaryDetailQuery.error?.message ?? null}
        copy={{
          title: t.medicalSummaryModalTitle,
          subtitle: t.medicalSummaryModalSubtitle,
          closeText: t.medicalSummaryClose,
          doctorLabel: t.medicalSummaryDoctorLabel,
          timeLabel: t.medicalSummaryTimeLabel,
          issuedAtLabel: t.medicalSummaryIssuedAtLabel,
          localTimeLabel: t.localTimeLabel,
          chinaTimeLabel: t.chinaTimeLabel,
          chiefComplaintLabel: resolved === "zh" ? "主诉" : "Chief Complaint",
          hpiLabel: resolved === "zh" ? "现病史" : "History of Present Illness",
          pmhLabel: resolved === "zh" ? "既往史" : "Past Medical History",
          assessmentLabel: resolved === "zh" ? "初步诊断" : "Assessment / Diagnosis",
          planLabel: resolved === "zh" ? "处置与建议" : "Plan / Recommendations",
          disclaimer: t.medicalSummaryDisclaimer,
          loadingText: t.medicalSummaryLoading,
          emptyText: t.medicalSummaryEmpty,
          fallbackDoctor: t.doctorFallback.replace("{{id}}", "-"),
        }}
      />
    </>
  );
}
