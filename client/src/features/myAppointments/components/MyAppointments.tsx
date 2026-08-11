import React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAppointmentSurfaceText } from "@/features/appointment";
import { getDashboardAppointmentCopy } from "@/features/dashboard";
import { PatientSummaryModal } from "@/features/visit";
import { trpc } from "@/lib/trpc";
import {
  extractMyAppointmentTokenFromJoinUrl,
  getMyAppointmentSections,
  mapMyAppointmentActionErrorMessage,
  type MyAppointmentItem,
  type MyAppointmentTab,
} from "../myAppointmentsPresentation";
import { MyAppointmentsList } from "./MyAppointmentsList";

export function MyAppointments() {
  const [activeTab, setActiveTab] =
    React.useState<MyAppointmentTab>("upcoming");
  const [actingAppointmentId, setActingAppointmentId] = React.useState<
    number | null
  >(null);
  const [summaryModalOpen, setSummaryModalOpen] = React.useState(false);
  const [summaryAccess, setSummaryAccess] = React.useState<{
    appointmentId: number;
    token: string;
  } | null>(null);

  const { resolved } = useLanguage();
  const copy = getDashboardAppointmentCopy(resolved);
  const query = trpc.appointments.listMyAppointments.useQuery();
  const resendMutation = trpc.appointments.resendLink.useMutation();
  const openRoomMutation = trpc.appointments.openMyRoom.useMutation();
  const retryPaymentMutation =
    trpc.payments.createCheckoutSessionForAppointment.useMutation();

  const summaryQueryInput = React.useMemo(
    () => ({
      appointmentId: summaryAccess?.appointmentId ?? 1,
      token: summaryAccess?.token ?? "summary-placeholder-token",
      lang: resolved,
    }),
    [resolved, summaryAccess]
  );

  const summaryDetailQuery = trpc.appointments.getByToken.useQuery(
    summaryQueryInput,
    {
      enabled: Boolean(summaryAccess && summaryModalOpen),
      retry: 1,
    }
  );
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

      const result = await resendMutation.mutateAsync({
        appointmentId: item.id,
      });
      if (result.devLink && typeof window !== "undefined") {
        const nextUrl = new URL(result.devLink);
        window.location.href = `${nextUrl.pathname}${nextUrl.search}`;
        return;
      }
      toast.success(copy.accessSentEmail);
    } catch (error) {
      const message = mapMyAppointmentActionErrorMessage(error, copy);
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
      const message = mapMyAppointmentActionErrorMessage(error, copy);
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
      const token = extractMyAppointmentTokenFromJoinUrl(result.joinUrl);
      if (!token) {
        throw new Error(copy.medicalSummaryLoadFailed);
      }
      setSummaryAccess({
        appointmentId: item.id,
        token,
      });
      setSummaryModalOpen(true);
    } catch (error) {
      const message = mapMyAppointmentActionErrorMessage(error, copy);
      toast.error(message);
    } finally {
      setActingAppointmentId(null);
    }
  };

  const handleResend = async (appointmentId: number) => {
    setActingAppointmentId(appointmentId);
    try {
      await resendMutation.mutateAsync({ appointmentId });
      toast.success(copy.accessSent);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : copy.resendFailed;
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
          <CardTitle className="text-slate-900">{copy.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            {copy.loadingAppointments}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (query.error) {
    return (
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">{copy.title}</CardTitle>
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
  const { upcomingItems, pastVisitItems } = getMyAppointmentSections(data);

  const summaryDoctorId = summaryDetailQuery.data?.doctorId ?? null;
  const summaryDoctorFallback = copy.doctorFallback.replace(
    "{{id}}",
    summaryDoctorId ? String(summaryDoctorId) : "-"
  );
  const summaryDoctorName = getAppointmentSurfaceText({
    lang: resolved,
    value: summaryDoctorQuery.data?.doctor?.name,
    fallback: summaryDoctorFallback,
  });

  return (
    <>
      <Card className="rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900">{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="gap-4"
          >
            <TabsList
              aria-label={copy.title}
              className="h-11 rounded-xl bg-slate-100 p-1"
            >
              <TabsTrigger
                value="upcoming"
                className="h-9 min-w-[130px] rounded-lg px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm"
              >
                {copy.tabUpcoming}
              </TabsTrigger>
              <TabsTrigger
                value="past_visits"
                className="h-9 min-w-[130px] rounded-lg px-4 text-sm data-[state=active]:bg-white data-[state=active]:text-teal-700 data-[state=active]:shadow-sm"
              >
                {copy.tabPastVisits}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              <MyAppointmentsList
                copy={copy}
                resolved={resolved}
                section="upcoming"
                items={upcomingItems}
                onUpcomingAction={handleOpenAccess}
                onResend={handleResend}
                onViewMedicalSummary={handleViewMedicalSummary}
                onViewChatHistory={handleViewChatHistory}
                actingAppointmentId={actingAppointmentId}
                tabLabel={copy.tabUpcoming}
              />
            </TabsContent>
            <TabsContent value="past_visits">
              <MyAppointmentsList
                copy={copy}
                resolved={resolved}
                section="past"
                items={pastVisitItems}
                onUpcomingAction={handleOpenAccess}
                onResend={handleResend}
                onViewMedicalSummary={handleViewMedicalSummary}
                onViewChatHistory={handleViewChatHistory}
                actingAppointmentId={actingAppointmentId}
                tabLabel={copy.tabPastVisits}
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
                chiefComplaint:
                  summaryDetailQuery.data.medicalSummary.chiefComplaint,
                historyOfPresentIllness:
                  summaryDetailQuery.data.medicalSummary
                    .historyOfPresentIllness,
                pastMedicalHistory:
                  summaryDetailQuery.data.medicalSummary.pastMedicalHistory,
                assessmentDiagnosis:
                  summaryDetailQuery.data.medicalSummary.assessmentDiagnosis,
                planRecommendations:
                  summaryDetailQuery.data.medicalSummary.planRecommendations,
                updatedAt: summaryDetailQuery.data.medicalSummary.updatedAt,
              }
            : null
        }
        isLoading={summaryDetailQuery.isLoading}
        errorMessage={summaryDetailQuery.error?.message ?? null}
        copy={{
          title: copy.medicalSummaryModalTitle,
          subtitle: copy.medicalSummaryModalSubtitle,
          closeText: copy.medicalSummaryClose,
          doctorLabel: copy.medicalSummaryDoctorLabel,
          timeLabel: copy.medicalSummaryTimeLabel,
          issuedAtLabel: copy.medicalSummaryIssuedAtLabel,
          localTimeLabel: copy.localTimeLabel,
          chinaTimeLabel: copy.chinaTimeLabel,
          chiefComplaintLabel: copy.medicalSummaryChiefComplaintLabel,
          hpiLabel: copy.medicalSummaryHpiLabel,
          pmhLabel: copy.medicalSummaryPmhLabel,
          assessmentLabel: copy.medicalSummaryAssessmentLabel,
          planLabel: copy.medicalSummaryPlanLabel,
          disclaimer: copy.medicalSummaryDisclaimer,
          loadingText: copy.medicalSummaryLoading,
          emptyText: copy.medicalSummaryEmpty,
          fallbackDoctor: copy.doctorFallback.replace("{{id}}", "-"),
        }}
      />
    </>
  );
}
