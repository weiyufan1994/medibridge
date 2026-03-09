import { Loader2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminConsole } from "@/features/admin/hooks/useAdminConsole";
import { FiltersCard } from "@/features/admin/components/FiltersCard";
import { AppointmentsCard } from "@/features/admin/components/AppointmentsCard";
import { TriageSessionsCard } from "@/features/admin/components/TriageSessionsCard";
import { RiskMetricsCard } from "@/features/admin/components/RiskMetricsCard";
import { RetentionCard } from "@/features/admin/components/RetentionCard";
import { AppointmentDetailCard } from "@/features/admin/components/AppointmentDetailCard";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const { resolved } = useLanguage();
  const lang = resolved as "zh" | "en";
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === "admin";

  const {
    emailQuery,
    setEmailQuery,
    statusFilter,
    setStatusFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    appointmentIdInput,
    setAppointmentIdInput,
    selectedAppointmentId,
    setSelectedAppointmentId,
    manualStatus,
    setManualStatus,
    manualPaymentStatus,
    setManualPaymentStatus,
    manualStatusReason,
    setManualStatusReason,
    freeRetentionDaysInput,
    setFreeRetentionDaysInput,
    paidRetentionDaysInput,
    setPaidRetentionDaysInput,
    issuedLinks,
    setIssuedLinks,
    appointmentStatusOptions,
    paymentStatusOptions,
    appointmentsQuery,
    triageQuery,
    metricsQuery,
    appointmentDetailQuery,
    visitSummaryQuery,
    retentionPoliciesQuery,
    retentionAuditsQuery,
    refreshAdminData,
    resendPaymentMutation,
    resendAccessLinkMutation,
    issueLinksMutation,
    updateStatusMutation,
    generateSummaryMutation,
    exportSummaryPdfMutation,
    updateRetentionPolicyMutation,
    runRetentionCleanupMutation,
    risks,
    suggestions,
    openAppointmentById,
    applyManualStatusUpdate,
    upsertRetentionPolicy,
    toggleRetentionEnabled,
    handleCopyDebugSnapshot,
    beforeReinitiatePayment,
    beforeResendAccessLink,
    beforeIssueLinks,
    runSuggestedAction,
    toUiError,
  } = useAdminConsole({ isAdmin, lang, tr });
  if (loading) {
    return (
      <AppLayout title={tr("管理后台", "Admin Console")}>
        <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout title={tr("管理后台", "Admin Console")}>
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>{tr("无访问权限", "Access denied")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {tr("仅管理员可访问该页面。", "This page is available to admin users only.")}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={tr("管理后台", "Admin Console")}>
      <div className="mx-auto flex-1 w-full max-w-7xl overflow-y-auto space-y-6 py-2">
        <FiltersCard
          tr={tr}
          emailQuery={emailQuery}
          onEmailQueryChange={setEmailQuery}
          appointmentIdInput={appointmentIdInput}
          onAppointmentIdInputChange={setAppointmentIdInput}
          onOpenAppointmentById={openAppointmentById}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          paymentStatusFilter={paymentStatusFilter}
          onPaymentStatusFilterChange={setPaymentStatusFilter}
          appointmentStatusOptions={appointmentStatusOptions}
          paymentStatusOptions={paymentStatusOptions}
          onRefresh={() => {
            void refreshAdminData();
          }}
        />

        <AppointmentsCard
          tr={tr}
          locale={locale}
          isLoading={appointmentsQuery.isLoading}
          errorMessage={appointmentsQuery.error?.message}
          items={appointmentsQuery.data ?? []}
          onSelectAppointment={id => {
            setSelectedAppointmentId(id);
            setIssuedLinks(null);
          }}
        />

        <AppointmentDetailCard
          tr={tr}
          lang={lang}
          locale={locale}
          selectedAppointmentId={selectedAppointmentId}
          appointmentDetailQuery={appointmentDetailQuery}
          risks={risks}
          suggestions={suggestions}
          runSuggestedAction={runSuggestedAction}
          beforeReinitiatePayment={beforeReinitiatePayment}
          beforeResendAccessLink={beforeResendAccessLink}
          beforeIssueLinks={beforeIssueLinks}
          resendPaymentMutation={resendPaymentMutation}
          resendAccessLinkMutation={resendAccessLinkMutation}
          issueLinksMutation={issueLinksMutation}
          handleCopyDebugSnapshot={handleCopyDebugSnapshot}
          manualStatus={manualStatus}
          setManualStatus={setManualStatus}
          manualPaymentStatus={manualPaymentStatus}
          setManualPaymentStatus={setManualPaymentStatus}
          manualStatusReason={manualStatusReason}
          setManualStatusReason={setManualStatusReason}
          appointmentStatusOptions={appointmentStatusOptions}
          paymentStatusOptions={paymentStatusOptions}
          applyManualStatusUpdate={applyManualStatusUpdate}
          updateStatusMutation={updateStatusMutation}
          generateSummaryMutation={generateSummaryMutation}
          exportSummaryPdfMutation={exportSummaryPdfMutation}
          visitSummaryQuery={visitSummaryQuery}
          issuedLinks={issuedLinks}
        />

        <TriageSessionsCard
          tr={tr}
          locale={locale}
          isLoading={triageQuery.isLoading}
          errorMessage={triageQuery.error?.message}
          items={triageQuery.data ?? []}
        />

        <RiskMetricsCard
          tr={tr}
          isLoading={metricsQuery.isLoading}
          errorMessage={metricsQuery.error?.message}
          generatedAt={metricsQuery.data?.generatedAt}
          counters={metricsQuery.data?.counters ?? []}
        />

        <RetentionCard
          tr={tr}
          locale={locale}
          isPoliciesLoading={retentionPoliciesQuery.isLoading}
          policiesErrorMessage={
            retentionPoliciesQuery.error?.message
              ? toUiError(retentionPoliciesQuery.error.message)
              : undefined
          }
          policies={retentionPoliciesQuery.data ?? []}
          freeRetentionDaysInput={freeRetentionDaysInput}
          paidRetentionDaysInput={paidRetentionDaysInput}
          onFreeRetentionDaysInputChange={setFreeRetentionDaysInput}
          onPaidRetentionDaysInputChange={setPaidRetentionDaysInput}
          onUpsertRetentionPolicy={upsertRetentionPolicy}
          onToggleRetentionEnabled={toggleRetentionEnabled}
          isUpdateRetentionPending={updateRetentionPolicyMutation.isPending}
          isCleanupPending={runRetentionCleanupMutation.isPending}
          onRunCleanupDryRun={() => runRetentionCleanupMutation.mutate({ dryRun: true })}
          onRunCleanupReal={() => runRetentionCleanupMutation.mutate({ dryRun: false })}
          isAuditsLoading={retentionAuditsQuery.isLoading}
          auditsErrorMessage={
            retentionAuditsQuery.error?.message
              ? toUiError(retentionAuditsQuery.error.message)
              : undefined
          }
          audits={retentionAuditsQuery.data ?? []}
        />
      </div>
    </AppLayout>
  );
}
