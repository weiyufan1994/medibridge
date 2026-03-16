import { useState } from "react";
import { Loader2, Search, ShieldCheck, Workflow, Wrench } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminConsole } from "@/features/admin/hooks/useAdminConsole";
import { FiltersCard } from "@/features/admin/components/FiltersCard";
import { AppointmentsCard } from "@/features/admin/components/AppointmentsCard";
import { TriageSessionsCard } from "@/features/admin/components/TriageSessionsCard";
import { TriageRiskEventsCard } from "@/features/admin/components/TriageRiskEventsCard";
import { RiskMetricsCard } from "@/features/admin/components/RiskMetricsCard";
import { OperationAuditCard } from "@/features/admin/components/OperationAuditCard";
import { RetentionCard } from "@/features/admin/components/RetentionCard";
import { AppointmentDetailCard } from "@/features/admin/components/AppointmentDetailCard";
import { HospitalImageManagementCard } from "@/features/admin/components/HospitalImageManagementCard";
import { ExportCenterCard } from "@/features/admin/components/ExportCenterCard";
import { SchedulingManagementCard } from "@/features/admin/components/SchedulingManagementCard";
import { DoctorAccountManagementCard } from "@/features/admin/components/DoctorAccountManagementCard";
import { UserRoleManagementCard } from "@/features/admin/components/UserRoleManagementCard";

export default function AdminPage() {
  const { user, loading } = useAuth();
  const { resolved } = useLanguage();
  const [activeTab, setActiveTab] = useState<
    "overview" | "appointments" | "users" | "operations"
  >("overview");
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
    userSearchQuery,
    setUserSearchQuery,
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
    resetAppointmentFilters,
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
    triageRiskEventsQuery,
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
    adminUsersQuery,
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
    updateUserRoleMutation,
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

  const openAppointmentInAdmin = (id: number) => {
    setActiveTab("appointments");
    setSelectedAppointmentId(id);
    setIssuedLinks(null);
  };

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
              {tr(
                "仅管理员或 ops 可访问。",
                "This page is available to admin and ops users only."
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={tr("管理后台", "Admin Console")}>
      <div className="mx-auto flex-1 w-full max-w-7xl overflow-y-auto py-2">
        <Tabs
          value={activeTab}
          onValueChange={value => setActiveTab(value as typeof activeTab)}
          className="gap-6"
        >
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-600">
                {tr("后台导航", "Console sections")}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {tr(
                  "集中查看预约、风险、分诊会话与运营操作。",
                  "Review appointments, risk signals, triage sessions, and operations in one place."
                )}
              </h1>
            </div>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl bg-slate-100 p-2">
              <TabsTrigger
                value="overview"
                className="h-10 rounded-xl px-4 data-[state=active]:bg-white data-[state=active]:text-teal-700"
              >
                <Search className="h-4 w-4" />
                {tr("总览", "Overview")}
              </TabsTrigger>
              <TabsTrigger
                value="appointments"
                className="h-10 rounded-xl px-4 data-[state=active]:bg-white data-[state=active]:text-teal-700"
              >
                <Workflow className="h-4 w-4" />
                {tr("预约工作台", "Appointments")}
              </TabsTrigger>
              {isAdmin ? (
                <TabsTrigger
                  value="users"
                  className="h-10 rounded-xl px-4 data-[state=active]:bg-white data-[state=active]:text-teal-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {tr("用户与权限", "Users & Roles")}
                </TabsTrigger>
              ) : null}
              <TabsTrigger
                value="operations"
                className="h-10 rounded-xl px-4 data-[state=active]:bg-white data-[state=active]:text-teal-700"
              >
                <Wrench className="h-4 w-4" />
                {tr("运营工具", "Operations")}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <RiskMetricsCard
              tr={tr}
              isLoading={metricsQuery.isLoading}
              errorMessage={metricsQuery.error?.message}
              generatedAt={metricsQuery.data?.generatedAt}
              riskSummary={appointmentsQuery.data?.riskSummary ?? null}
              riskItems={appointmentsQuery.data?.items ?? []}
              onOpenAppointmentById={openAppointmentInAdmin}
            />

            <TriageSessionsCard
              tr={tr}
              locale={locale}
              isLoading={triageQuery.isLoading}
              errorMessage={triageQuery.error?.message}
              items={triageQuery.data ?? []}
            />

            <TriageRiskEventsCard
              tr={tr}
              locale={locale}
              isLoading={triageRiskEventsQuery.isLoading}
              errorMessage={triageRiskEventsQuery.error?.message}
              items={triageRiskEventsQuery.data ?? []}
            />
          </TabsContent>

          <TabsContent value="appointments" className="space-y-6">
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
              onPageChange={setPage}
              onRefresh={() => {
                void refreshAdminData();
              }}
              onResetFilters={resetAppointmentFilters}
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
          </TabsContent>

          {isAdmin ? (
            <TabsContent value="users" className="space-y-6">
              <UserRoleManagementCard
                tr={tr}
                locale={locale}
                isLoading={adminUsersQuery.isLoading}
                errorMessage={adminUsersQuery.error?.message}
                users={adminUsersQuery.data ?? []}
                isReadOnly={!isAdmin}
                isUpdating={updateUserRoleMutation.isPending}
                searchQuery={userSearchQuery}
                onSearchQueryChange={setUserSearchQuery}
                onRefresh={() => {
                  void adminUsersQuery.refetch();
                }}
                onUpdateRole={input => {
                  updateUserRoleMutation.mutate(input);
                }}
              />
            </TabsContent>
          ) : null}

          <TabsContent value="operations" className="space-y-6">
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
              onOpenAppointmentById={openAppointmentInAdmin}
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
                hospitalsQuery.error?.message
                  ? toUiError(hospitalsQuery.error.message)
                  : undefined
              }
              hospitals={hospitalsQuery.data ?? []}
              isReadOnly={!isAdmin}
              uploadState={adminHospitalImageUploadMutation}
              clearState={adminHospitalImageClearMutation}
            />

            <SchedulingManagementCard tr={tr} lang={lang} isReadOnly={!isAdmin} />

            <DoctorAccountManagementCard tr={tr} />

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
              isReadOnly={!isAdmin}
              isUpdateRetentionPending={updateRetentionPolicyMutation.isPending}
              isCleanupPending={runRetentionCleanupMutation.isPending}
              onRunCleanupDryRun={() =>
                runRetentionCleanupMutation.mutate({ dryRun: true })
              }
              onRunCleanupReal={() =>
                runRetentionCleanupMutation.mutate({ dryRun: false })
              }
              isAuditsLoading={retentionAuditsQuery.isLoading}
              auditsErrorMessage={
                retentionAuditsQuery.error?.message
                  ? toUiError(retentionAuditsQuery.error.message)
                  : undefined
              }
              audits={retentionAuditsQuery.data ?? []}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
