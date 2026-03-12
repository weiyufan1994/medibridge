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
import { OperationAuditCard } from "@/features/admin/components/OperationAuditCard";
import { RetentionCard } from "@/features/admin/components/RetentionCard";
import { AppointmentDetailCard } from "@/features/admin/components/AppointmentDetailCard";
import { HospitalImageManagementCard } from "@/features/admin/components/HospitalImageManagementCard";
import { ExportCenterCard } from "@/features/admin/components/ExportCenterCard";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const { resolved } = useLanguage();
  const lang = resolved as "zh" | "en";
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === "admin";
  const isOps = role === "ops";
  const canAccessAdmin = isAdmin || isOps;
  const canReplayWebhook = isAdmin || isOps;
  const canResendAccessLink = isAdmin || isOps;
  const canIssueAccessLinks = isAdmin || isOps;
  const canNotifyFollowup = isAdmin || isOps;
  const canReinitiatePayment = isAdmin;
  const canMutateAppointments = isAdmin;

  const {
    emailQuery,
    setEmailQuery,
    page,
    setPage,
    pageSize,
    setPageSize,
    statusFilter,
    setStatusFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    doctorIdInput,
    setDoctorIdInput,
    amountMinInput,
    setAmountMinInput,
    amountMaxInput,
    setAmountMaxInput,
    createdAtFrom,
    setCreatedAtFrom,
    createdAtTo,
    setCreatedAtTo,
    scheduledAtFrom,
    setScheduledAtFrom,
    scheduledAtTo,
    setScheduledAtTo,
    hasRiskFilter,
    setHasRiskFilter,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
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
    manualScheduledAt,
    setManualScheduledAt,
    freeRetentionDaysInput,
    setFreeRetentionDaysInput,
    paidRetentionDaysInput,
    setPaidRetentionDaysInput,
    issuedLinks,
    setIssuedLinks,
    appointmentStatusOptions,
    paymentStatusOptions,
    selectedAppointmentIds,
    isAllVisibleSelected,
    isAnyVisibleSelected,
    toggleAppointmentSelection,
    toggleSelectAllVisible,
    clearSelection,
    batchAppointmentsMutation,
    exportAppointmentsMutation,
    webhookReplayMutation,
    appointmentsQuery,
    triageQuery,
    metricsQuery,
    operationAuditQuery,
    operationAuditPage,
    setOperationAuditPage,
    operationAuditOperatorIdInput,
    setOperationAuditOperatorIdInput,
    operationAuditActionTypeInput,
    setOperationAuditActionTypeInput,
    operationAuditFrom,
    setOperationAuditFrom,
    operationAuditTo,
    setOperationAuditTo,
    appointmentDetailQuery,
    visitSummaryQuery,
    retentionPoliciesQuery,
    retentionAuditsQuery,
    hospitalsQuery,
    adminHospitalImageUploadMutation,
    adminHospitalImageClearMutation,
    refreshAdminData,
    resendPaymentMutation,
    resendAccessLinkMutation,
    issueLinksMutation,
    updateStatusMutation,
    updateScheduleMutation,
    generateSummaryMutation,
    exportSummaryPdfMutation,
    updateRetentionPolicyMutation,
    runRetentionCleanupMutation,
    risks,
    suggestions,
    openAppointmentById,
    applyManualStatusUpdate,
    applyManualScheduleUpdate,
    setScheduleToNow,
    upsertRetentionPolicy,
    toggleRetentionEnabled,
    handleCopyDebugSnapshot,
    beforeReinitiatePayment,
    beforeResendAccessLink,
    beforeIssueLinks,
    runSuggestedAction,
    toUiError,
  } = useAdminConsole({
    canReadAdmin: canAccessAdmin,
    canMutateAdmin: isAdmin,
    canReplayWebhook,
    canResendAccessLink,
    canIssueAccessLinks,
    canNotifyFollowup,
    lang,
    tr,
  });

  const handleAuditPageChange = (value: number) => {
    setOperationAuditPage(Math.max(1, value));
  };

  if (loading) {
    return (
      <AppLayout title={tr("管理后台", "Admin Console")}>
        <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (!canAccessAdmin) {
    return (
      <AppLayout title={tr("管理后台", "Admin Console")}>
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>{tr("无访问权限", "Access denied")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {tr("仅管理员或 ops 可访问。", "This page is available to admin and ops users only.")}
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
          doctorIdInput={doctorIdInput}
          onDoctorIdInputChange={setDoctorIdInput}
          amountMinInput={amountMinInput}
          onAmountMinChange={setAmountMinInput}
          amountMaxInput={amountMaxInput}
          onAmountMaxChange={setAmountMaxInput}
          createdAtFrom={createdAtFrom}
          onCreatedAtFromChange={setCreatedAtFrom}
          createdAtTo={createdAtTo}
          onCreatedAtToChange={setCreatedAtTo}
          scheduledAtFrom={scheduledAtFrom}
          onScheduledAtFromChange={setScheduledAtFrom}
          scheduledAtTo={scheduledAtTo}
          onScheduledAtToChange={setScheduledAtTo}
          hasRiskFilter={hasRiskFilter}
          onHasRiskFilterChange={setHasRiskFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          sortDirection={sortDirection}
          onSortDirectionChange={setSortDirection}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          page={page}
          totalPages={appointmentsQuery.data?.totalPages ?? 1}
          onPageChange={value => {
            setPage(value);
          }}
          onRefresh={() => {
            void refreshAdminData();
          }}
        />

        <OperationAuditCard
          tr={tr}
          locale={locale}
          isLoading={operationAuditQuery.isLoading}
          errorMessage={operationAuditQuery.error?.message}
          total={operationAuditQuery.data?.total ?? 0}
          items={operationAuditQuery.data?.items ?? []}
          page={operationAuditPage}
          totalPages={operationAuditQuery.data?.totalPages ?? 1}
          onPageChange={handleAuditPageChange}
          onRefresh={() => {
            void refreshAdminData();
          }}
          onOpenAppointmentById={id => {
            setSelectedAppointmentId(id);
            setIssuedLinks(null);
          }}
          operatorIdInput={operationAuditOperatorIdInput}
          onOperatorIdInputChange={value => {
            setOperationAuditOperatorIdInput(value);
            setOperationAuditPage(1);
          }}
          actionTypeInput={operationAuditActionTypeInput}
          onActionTypeInputChange={value => {
            setOperationAuditActionTypeInput(value);
            setOperationAuditPage(1);
          }}
          from={operationAuditFrom}
          onFromChange={value => {
            setOperationAuditFrom(value);
            setOperationAuditPage(1);
          }}
          to={operationAuditTo}
          onToChange={value => {
            setOperationAuditTo(value);
            setOperationAuditPage(1);
          }}
        />

        <ExportCenterCard
          tr={tr}
          locale={locale}
          isExporting={exportAppointmentsMutation.isPending}
          onExport={({
            scope,
            format,
            webhookAppointmentId,
            auditOperatorId,
            auditActionType,
            auditFrom,
            auditTo,
          }) => {
            exportAppointmentsMutation.exportScope({
              scope,
              format,
              webhookAppointmentId,
              auditOperatorId,
              auditActionType,
              auditFrom,
              auditTo,
            });
          }}
        />

        <HospitalImageManagementCard
          tr={tr}
          lang={lang}
          isLoading={hospitalsQuery.isLoading}
          errorMessage={
            hospitalsQuery.error?.message ? toUiError(hospitalsQuery.error.message) : undefined
          }
          hospitals={hospitalsQuery.data ?? []}
          isReadOnly={!isAdmin}
          uploadState={adminHospitalImageUploadMutation}
          clearState={adminHospitalImageClearMutation}
        />

        <AppointmentsCard
          tr={tr}
          locale={locale}
          isLoading={appointmentsQuery.isLoading}
          errorMessage={appointmentsQuery.error?.message}
          page={page}
          pageSize={pageSize}
          total={appointmentsQuery.data?.total ?? 0}
          totalPages={appointmentsQuery.data?.totalPages ?? 1}
          items={(appointmentsQuery.data?.items ?? []) as Array<{
            id: number;
            email: string;
            status: string;
            paymentStatus: string;
            amount: number;
            currency: string;
            doctorId: number;
            triageSessionId: number;
            createdAt: string | Date;
            hasRisk: boolean;
            riskCodes: string[];
          }>}
          selectedIds={selectedAppointmentIds}
          isAllVisibleSelected={isAllVisibleSelected}
          isAnyVisibleSelected={isAnyVisibleSelected}
          onSelectAppointment={id => {
            setSelectedAppointmentId(id);
            setIssuedLinks(null);
          }}
          onToggleSelect={toggleAppointmentSelection}
          onToggleAllVisible={toggleSelectAllVisible}
          onClearSelection={clearSelection}
          onBatchAction={batchAppointmentsMutation.executeBatch}
          batchResult={batchAppointmentsMutation.lastResult}
          onPageChange={setPage}
          onRefresh={() => {
            void refreshAdminData();
          }}
          batchIsPending={batchAppointmentsMutation.isPending}
          canBatchResendAccessLink={canResendAccessLink}
          canBatchReinitiatePayment={canReinitiatePayment}
          canBatchUpdateStatus={canMutateAppointments}
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
          webhookReplayMutation={webhookReplayMutation}
          beforeReinitiatePayment={beforeReinitiatePayment}
          beforeResendAccessLink={beforeResendAccessLink}
          beforeIssueLinks={beforeIssueLinks}
          resendPaymentMutation={resendPaymentMutation}
          resendAccessLinkMutation={resendAccessLinkMutation}
          issueLinksMutation={issueLinksMutation}
          canMutateAppointments={canMutateAppointments}
          canReinitiatePayment={canReinitiatePayment}
          canResendAccessLink={canResendAccessLink}
          canIssueAccessLinks={canIssueAccessLinks}
          canNotifyFollowup={canNotifyFollowup}
          handleCopyDebugSnapshot={handleCopyDebugSnapshot}
          manualStatus={manualStatus}
          setManualStatus={setManualStatus}
          manualPaymentStatus={manualPaymentStatus}
          setManualPaymentStatus={setManualPaymentStatus}
          manualStatusReason={manualStatusReason}
          setManualStatusReason={setManualStatusReason}
          manualScheduledAt={manualScheduledAt}
          setManualScheduledAt={setManualScheduledAt}
          setScheduleToNow={setScheduleToNow}
          appointmentStatusOptions={appointmentStatusOptions}
          paymentStatusOptions={paymentStatusOptions}
          applyManualStatusUpdate={applyManualStatusUpdate}
          applyManualScheduleUpdate={applyManualScheduleUpdate}
          canReplayWebhook={canReplayWebhook}
          updateStatusMutation={updateStatusMutation}
          updateScheduleMutation={updateScheduleMutation}
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
          riskSummary={appointmentsQuery.data?.riskSummary ?? null}
          riskItems={appointmentsQuery.data?.items ?? []}
          onOpenAppointmentById={id => {
            setSelectedAppointmentId(id);
            setIssuedLinks(null);
          }}
        />

        <RetentionCard
          tr={tr}
          locale={locale}
          isPoliciesLoading={retentionPoliciesQuery.isLoading}
          policiesErrorMessage={
            retentionPoliciesQuery.error?.message ? toUiError(retentionPoliciesQuery.error.message) : undefined
          }
          policies={retentionPoliciesQuery.data ?? []}
          freeRetentionDaysInput={freeRetentionDaysInput}
          paidRetentionDaysInput={paidRetentionDaysInput}
          onFreeRetentionDaysInputChange={setFreeRetentionDaysInput}
          onPaidRetentionDaysInputChange={setPaidRetentionDaysInput}
          onUpsertRetentionPolicy={upsertRetentionPolicy}
          onToggleRetentionEnabled={toggleRetentionEnabled}
          isReadOnly={!isAdmin}
          isUpdateRetentionPending={updateRetentionPolicyMutation.isPending}
          isCleanupPending={runRetentionCleanupMutation.isPending}
          onRunCleanupDryRun={() => runRetentionCleanupMutation.mutate({ dryRun: true })}
          onRunCleanupReal={() => runRetentionCleanupMutation.mutate({ dryRun: false })}
          isAuditsLoading={retentionAuditsQuery.isLoading}
          auditsErrorMessage={
            retentionAuditsQuery.error?.message ? toUiError(retentionAuditsQuery.error.message) : undefined
          }
          audits={retentionAuditsQuery.data ?? []}
        />
      </div>
    </AppLayout>
  );
}
