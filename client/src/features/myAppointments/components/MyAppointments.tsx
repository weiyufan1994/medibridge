import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDashboardAppointmentCopy } from "@/features/dashboard";
import { PatientSummaryModal } from "@/features/visit";
import { useMyAppointmentsController } from "../useMyAppointmentsController";
import { MyAppointmentsList } from "./MyAppointmentsList";

export function MyAppointments() {
  const { resolved } = useLanguage();
  const copy = getDashboardAppointmentCopy(resolved);
  const controller = useMyAppointmentsController({ resolved, copy });
  const {
    activeTab,
    actingAppointmentId,
    handleOpenAccess,
    handleResend,
    handleSummaryOpenChange,
    handleTabChange,
    handleViewChatHistory,
    handleViewMedicalSummary,
    pastVisitItems,
    query,
    summaryDetailQuery,
    summaryDoctorName,
    summaryModalOpen,
    upcomingItems,
  } = controller;

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
