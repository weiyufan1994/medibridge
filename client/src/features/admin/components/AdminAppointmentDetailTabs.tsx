import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBookingWorkspaceCopy } from "@/features/booking";
import type { UseAdminConsoleResult } from "@/features/admin/types";
import { ActionsSection } from "./appointment-detail/ActionsSection";
import { DiagnosticsSection } from "./appointment-detail/DiagnosticsSection";
import { OverviewSection } from "./appointment-detail/OverviewSection";

type AdminAppointmentDetailTabsProps = {
  admin: UseAdminConsoleResult;
  lang: "zh" | "en";
  locale: string;
  tr: (zh: string, en: string) => string;
  permissions: {
    canIssueAccessLinks: boolean;
    canMutateAppointments: boolean;
    canNotifyFollowup: boolean;
    canReinitiatePayment: boolean;
    canReplayWebhook: boolean;
    canResendAccessLink: boolean;
  };
};

export function AdminAppointmentDetailTabs({
  admin,
  lang,
  locale,
  tr,
  permissions,
}: AdminAppointmentDetailTabsProps) {
  const detailData = admin.appointmentDetailQuery.data;
  if (!admin.selectedAppointmentId || !detailData) {
    return null;
  }
  const copy = getBookingWorkspaceCopy(lang);

  return (
    <Tabs defaultValue="summary" className="gap-3">
      <TabsList className="grid h-10 w-full grid-cols-3">
        <TabsTrigger value="summary">{copy.detail.tabs.summary}</TabsTrigger>
        <TabsTrigger value="diagnostics">
          {copy.detail.tabs.diagnostics}
        </TabsTrigger>
        <TabsTrigger value="actions">{copy.detail.tabs.actions}</TabsTrigger>
      </TabsList>
      <TabsContent value="summary" className="mt-0">
        <OverviewSection
          tr={tr}
          lang={lang}
          locale={locale}
          detailData={detailData}
          risks={admin.risks}
          suggestions={admin.suggestions}
          runSuggestedAction={admin.runSuggestedAction}
          canReinitiatePayment={permissions.canReinitiatePayment}
          canResendAccessLink={permissions.canResendAccessLink}
          canIssueAccessLinks={permissions.canIssueAccessLinks}
          canNotifyFollowup={permissions.canNotifyFollowup}
          canReplayWebhook={permissions.canReplayWebhook}
        />
      </TabsContent>
      <TabsContent value="diagnostics" className="mt-0">
        <DiagnosticsSection
          tr={tr}
          lang={lang}
          locale={locale}
          detailData={detailData}
          webhookReplayMutation={admin.webhookReplayMutation}
          canReplayWebhook={permissions.canReplayWebhook}
        />
      </TabsContent>
      <TabsContent value="actions" className="mt-0">
        <ActionsSection
          tr={tr}
          lang={lang}
          selectedAppointmentId={admin.selectedAppointmentId}
          hideQuickActions
          beforeReinitiatePayment={admin.beforeReinitiatePayment}
          beforeResendAccessLink={admin.beforeResendAccessLink}
          beforeIssueLinks={admin.beforeIssueLinks}
          resendPaymentMutation={admin.resendPaymentMutation}
          resendAccessLinkMutation={admin.resendAccessLinkMutation}
          issueLinksMutation={admin.issueLinksMutation}
          canMutateAdmin={permissions.canMutateAppointments}
          canReinitiatePayment={permissions.canReinitiatePayment}
          canResendAccessLink={permissions.canResendAccessLink}
          canIssueAccessLinks={permissions.canIssueAccessLinks}
          handleCopyDebugSnapshot={admin.handleCopyDebugSnapshot}
          currentStatus={detailData.appointment.status}
          currentPaymentStatus={detailData.appointment.paymentStatus}
          manualStatus={admin.manualStatus}
          setManualStatus={admin.setManualStatus}
          manualPaymentStatus={admin.manualPaymentStatus}
          setManualPaymentStatus={admin.setManualPaymentStatus}
          manualStatusReason={admin.manualStatusReason}
          setManualStatusReason={admin.setManualStatusReason}
          manualScheduledAt={admin.manualScheduledAt}
          setManualScheduledAt={admin.setManualScheduledAt}
          setScheduleToNow={admin.setScheduleToNow}
          applyManualStatusUpdate={admin.applyManualStatusUpdate}
          applyManualScheduleUpdate={admin.applyManualScheduleUpdate}
          updateStatusMutation={admin.updateStatusMutation}
          updateScheduleMutation={admin.updateScheduleMutation}
          generateSummaryMutation={admin.generateSummaryMutation}
          exportSummaryPdfMutation={admin.exportSummaryPdfMutation}
          visitSummaryQuery={admin.visitSummaryQuery}
          issuedLinks={admin.issuedLinks}
        />
      </TabsContent>
    </Tabs>
  );
}
