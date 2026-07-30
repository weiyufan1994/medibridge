import { useState } from "react";
import {
  ClipboardList,
  Loader2,
  Search,
  ShieldCheck,
  Workflow,
  Wrench,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDisplayLocale, getLocalizedText } from "@/lib/i18n";
import { useAdminConsole } from "@/features/admin/hooks/useAdminConsole";
import {
  getAdminConsoleChromeCopy,
  type AdminConsoleFieldLabelKey,
  getAdminConsoleFieldLabel,
  getAdminConsoleSectionCopy,
  type AdminConsoleSectionKey,
} from "@/features/admin/adminConsoleLayout";
import { AdminNavigationRail } from "@/features/admin/components/AdminNavigationRail";
import { AdminSectionHeader } from "@/features/admin/components/AdminSectionHeader";
import { TriageSessionsCard } from "@/features/admin/components/TriageSessionsCard";
import { TriageRiskEventsCard } from "@/features/admin/components/TriageRiskEventsCard";
import { RiskMetricsCard } from "@/features/admin/components/RiskMetricsCard";
import { OperationAuditCard } from "@/features/admin/components/OperationAuditCard";
import { RetentionCard } from "@/features/admin/components/RetentionCard";
import { HospitalImageManagementCard } from "@/features/admin/components/HospitalImageManagementCard";
import { ExportCenterCard } from "@/features/admin/components/ExportCenterCard";
import { SchedulingManagementCard } from "@/features/admin/components/SchedulingManagementCard";
import { DoctorAccountManagementCard } from "@/features/admin/components/DoctorAccountManagementCard";
import { UserRoleManagementCard } from "@/features/admin/components/UserRoleManagementCard";
import { ReferralWorkspaceConsole } from "@/features/admin/components/ReferralWorkspaceConsole";
import { OverviewSection } from "@/features/admin/components/appointment-detail/OverviewSection";
import { DiagnosticsSection } from "@/features/admin/components/appointment-detail/DiagnosticsSection";
import { ActionsSection } from "@/features/admin/components/appointment-detail/ActionsSection";
import { getBookingWorkspaceCopy } from "@/features/booking/copy";
import { BookingWorkspace } from "@/features/booking/components/BookingWorkspace";

const MAX_HEADER_PILLS = 4;

function compactPills(pills: string[]) {
  if (pills.length <= MAX_HEADER_PILLS) {
    return pills;
  }

  return [
    ...pills.slice(0, MAX_HEADER_PILLS),
    `+${pills.length - MAX_HEADER_PILLS}`,
  ];
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const { resolved } = useLanguage();
  const [activeTab, setActiveTab] =
    useState<AdminConsoleSectionKey>("overview");
  const lang = resolved as "zh" | "en";
  const locale = getDisplayLocale(lang);
  const tr = (zh: string, en: string) =>
    getLocalizedText({ lang, value: { zh, en }, placeholder: zh });
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

  const chromeCopy = getAdminConsoleChromeCopy(lang);
  const sectionCopyByKey = {
    overview: getAdminConsoleSectionCopy("overview", lang),
    appointments: getAdminConsoleSectionCopy("appointments", lang),
    referrals: getAdminConsoleSectionCopy("referrals", lang),
    users: getAdminConsoleSectionCopy("users", lang),
    operations: getAdminConsoleSectionCopy("operations", lang),
  } as const;

  const navigationItems = [
    {
      value: "overview" as const,
      label: sectionCopyByKey.overview.navLabel,
      description: sectionCopyByKey.overview.navDescription,
      icon: Search,
    },
    {
      value: "appointments" as const,
      label: sectionCopyByKey.appointments.navLabel,
      description: sectionCopyByKey.appointments.navDescription,
      icon: Workflow,
    },
    {
      value: "referrals" as const,
      label: sectionCopyByKey.referrals.navLabel,
      description: sectionCopyByKey.referrals.navDescription,
      icon: ClipboardList,
    },
    ...(isAdmin
      ? [
          {
            value: "users" as const,
            label: sectionCopyByKey.users.navLabel,
            description: sectionCopyByKey.users.navDescription,
            icon: ShieldCheck,
          },
        ]
      : []),
    {
      value: "operations" as const,
      label: sectionCopyByKey.operations.navLabel,
      description: sectionCopyByKey.operations.navDescription,
      icon: Wrench,
    },
  ];

  const activeSection = sectionCopyByKey[activeTab];
  const fieldLabel = (key: AdminConsoleFieldLabelKey) =>
    getAdminConsoleFieldLabel(key, lang);
  const appointmentStatusLabel = statusFilter || tr("全部", "All");
  const paymentStatusLabel = paymentStatusFilter || tr("全部", "All");
  const activeSectionPills = compactPills(
    (() => {
      if (activeTab === "appointments") {
        return [
          emailQuery.trim()
            ? `${fieldLabel("email")}: ${emailQuery.trim()}`
            : null,
          appointmentIdInput.trim()
            ? `${fieldLabel("appointment")}: #${appointmentIdInput.trim()}`
            : null,
          statusFilter
            ? `${fieldLabel("status")}: ${appointmentStatusLabel}`
            : null,
          paymentStatusFilter
            ? `${fieldLabel("payment")}: ${paymentStatusLabel}`
            : null,
          doctorIdInput.trim()
            ? `${fieldLabel("doctor")}: #${doctorIdInput.trim()}`
            : null,
          hasRiskFilter
            ? `${fieldLabel("risk")}: ${fieldLabel("riskFlagged")}`
            : null,
        ].filter((value): value is string => Boolean(value));
      }

      if (activeTab === "users") {
        return userSearchQuery.trim()
          ? [`${fieldLabel("search")}: ${userSearchQuery.trim()}`]
          : [];
      }

      if (activeTab === "operations") {
        return [
          operationAuditOperatorIdInput.trim()
            ? `${fieldLabel("operator")}: #${operationAuditOperatorIdInput.trim()}`
            : null,
          operationAuditActionTypeInput.trim()
            ? `${fieldLabel("action")}: ${operationAuditActionTypeInput.trim()}`
            : null,
          operationAuditFrom
            ? `${fieldLabel("from")}: ${operationAuditFrom}`
            : null,
          operationAuditTo ? `${fieldLabel("to")}: ${operationAuditTo}` : null,
        ].filter((value): value is string => Boolean(value));
      }

      return [];
    })()
  );
  const bookingItems = (appointmentsQuery.data?.items ?? []).map(item => ({
    id: item.id,
    userId: item.userId ?? null,
    email: item.email,
    status: item.status,
    paymentStatus: item.paymentStatus,
    amount: item.amount,
    currency: item.currency,
    doctorId: item.doctorId ?? null,
    triageSessionId: item.triageSessionId ?? null,
    scheduledAt: item.scheduledAt ?? null,
    createdAt: item.createdAt,
    riskFlag: item.hasRisk,
    riskCodes: item.riskCodes,
  }));
  const activeBookingItem =
    bookingItems.find(item => item.id === selectedAppointmentId) ?? null;
  const detailMeta = appointmentDetailQuery.data
    ? {
        id: appointmentDetailQuery.data.appointment.id,
        email: appointmentDetailQuery.data.appointment.email,
        status: appointmentDetailQuery.data.appointment.status,
        paymentStatus: appointmentDetailQuery.data.appointment.paymentStatus,
        amount: appointmentDetailQuery.data.appointment.amount,
        currency: appointmentDetailQuery.data.appointment.currency,
        scheduledAt: appointmentDetailQuery.data.appointment.scheduledAt,
        riskFlag: activeBookingItem?.riskFlag ?? false,
      }
    : activeBookingItem
      ? {
          id: activeBookingItem.id,
          email: activeBookingItem.email,
          status: activeBookingItem.status,
          paymentStatus: activeBookingItem.paymentStatus,
          amount: activeBookingItem.amount,
          currency: activeBookingItem.currency,
          scheduledAt: activeBookingItem.scheduledAt,
          riskFlag: activeBookingItem.riskFlag,
        }
      : {
          id: null,
          email: null,
          status: null,
          paymentStatus: null,
          amount: null,
          currency: null,
          scheduledAt: null,
          riskFlag: false,
        };
  const bookingDetailContent =
    selectedAppointmentId && appointmentDetailQuery.data ? (
      <div className="space-y-4">
        <OverviewSection
          tr={tr}
          lang={lang}
          locale={locale}
          detailData={appointmentDetailQuery.data}
          risks={risks}
          suggestions={suggestions}
          runSuggestedAction={runSuggestedAction}
          canReinitiatePayment={canReinitiatePayment}
          canResendAccessLink={canResendAccessLink}
          canIssueAccessLinks={canIssueAccessLinks}
          canNotifyFollowup={canNotifyFollowup}
          canReplayWebhook={canReplayWebhook}
        />

        <DiagnosticsSection
          tr={tr}
          lang={lang}
          locale={locale}
          detailData={appointmentDetailQuery.data}
          webhookReplayMutation={webhookReplayMutation}
          canReplayWebhook={canReplayWebhook}
        />

        <ActionsSection
          tr={tr}
          selectedAppointmentId={selectedAppointmentId}
          hideQuickActions
          beforeReinitiatePayment={beforeReinitiatePayment}
          beforeResendAccessLink={beforeResendAccessLink}
          beforeIssueLinks={beforeIssueLinks}
          resendPaymentMutation={resendPaymentMutation}
          resendAccessLinkMutation={resendAccessLinkMutation}
          issueLinksMutation={issueLinksMutation}
          canMutateAdmin={canMutateAppointments}
          canReinitiatePayment={canReinitiatePayment}
          canResendAccessLink={canResendAccessLink}
          canIssueAccessLinks={canIssueAccessLinks}
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
          updateStatusMutation={updateStatusMutation}
          updateScheduleMutation={updateScheduleMutation}
          generateSummaryMutation={generateSummaryMutation}
          exportSummaryPdfMutation={exportSummaryPdfMutation}
          visitSummaryQuery={visitSummaryQuery}
          issuedLinks={issuedLinks}
        />
      </div>
    ) : undefined;
  const bookingCopy = getBookingWorkspaceCopy(lang);
  const bookingStickyActions = [
    {
      kind: "generate_summary_en" as const,
      disabled: !selectedAppointmentId || generateSummaryMutation.isPending,
      pending: generateSummaryMutation.isPending,
      onClick: () => {
        if (!selectedAppointmentId) {
          return;
        }
        generateSummaryMutation.mutate({
          appointmentId: selectedAppointmentId,
          forceRegenerate: true,
        });
      },
    },
    {
      kind: "resend_link" as const,
      disabled:
        !selectedAppointmentId ||
        !canResendAccessLink ||
        resendAccessLinkMutation.isPending,
      pending: resendAccessLinkMutation.isPending,
      title: !canResendAccessLink
        ? bookingCopy.footer.resendLinkDisabled
        : undefined,
      onClick: () => {
        if (!selectedAppointmentId) {
          return;
        }
        if (beforeResendAccessLink()) {
          resendAccessLinkMutation.mutate({
            appointmentId: selectedAppointmentId,
          });
        }
      },
    },
    {
      kind: "reinitiate_payment" as const,
      disabled:
        !selectedAppointmentId ||
        !canReinitiatePayment ||
        resendPaymentMutation.isPending,
      pending: resendPaymentMutation.isPending,
      title: !canReinitiatePayment
        ? bookingCopy.footer.reinitiatePaymentDisabled
        : undefined,
      onClick: () => {
        if (!selectedAppointmentId) {
          return;
        }
        if (beforeReinitiatePayment()) {
          resendPaymentMutation.mutate({
            appointmentId: selectedAppointmentId,
          });
        }
      },
    },
  ];

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
      <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 overflow-hidden py-3">
        <Tabs
          value={activeTab}
          onValueChange={value => setActiveTab(value as typeof activeTab)}
          orientation="vertical"
          className="h-full min-h-0 w-full gap-6 overflow-hidden"
        >
          <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-6 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1">
            <AdminNavigationRail
              heading={chromeCopy.navigationEyebrow}
              description={chromeCopy.navigationDescription}
              items={navigationItems}
              activeValue={activeTab}
            />

            <div className="min-w-0 min-h-0 overflow-hidden rounded-[28px] bg-slate-50/60">
              <div className="flex h-full min-h-0 flex-col gap-4">
                <div className="shrink-0">
                  <AdminSectionHeader
                    eyebrow={activeSection.navLabel}
                    title={activeSection.title}
                    description={activeSection.description}
                    pills={activeSectionPills}
                  />
                </div>

                <div
                  className={`min-h-0 pr-1 pb-2 ${
                    activeTab === "appointments" || activeTab === "referrals"
                      ? "overflow-hidden"
                      : "overflow-y-auto"
                  }`}
                >
                  <TabsContent value="overview" className="space-y-6 pb-4">
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

                  <TabsContent value="appointments" className="h-full min-h-0">
                    <BookingWorkspace
                      lang={lang}
                      locale={locale}
                      filters={{
                        emailQuery,
                        appointmentIdInput,
                        statusFilter,
                        paymentStatusFilter,
                        doctorIdInput,
                        amountMinInput,
                        amountMaxInput,
                        createdAtFrom,
                        createdAtTo,
                        scheduledAtFrom,
                        scheduledAtTo,
                        hasRiskFilter,
                        sortBy,
                        sortDirection,
                        pageSize,
                        page,
                      }}
                      options={{
                        appointmentStatusOptions,
                        paymentStatusOptions,
                      }}
                      callbacks={{
                        onEmailQueryChange: setEmailQuery,
                        onAppointmentIdInputChange: setAppointmentIdInput,
                        onOpenAppointmentById: openAppointmentById,
                        onStatusFilterChange: setStatusFilter,
                        onPaymentStatusFilterChange: setPaymentStatusFilter,
                        onDoctorIdInputChange: setDoctorIdInput,
                        onAmountMinChange: setAmountMinInput,
                        onAmountMaxChange: setAmountMaxInput,
                        onCreatedAtFromChange: setCreatedAtFrom,
                        onCreatedAtToChange: setCreatedAtTo,
                        onScheduledAtFromChange: setScheduledAtFrom,
                        onScheduledAtToChange: setScheduledAtTo,
                        onHasRiskFilterChange: setHasRiskFilter,
                        onSortByChange: setSortBy,
                        onSortDirectionChange: setSortDirection,
                        onPageSizeChange: setPageSize,
                        onPageChange: setPage,
                        onResetFilters: resetAppointmentFilters,
                        onRefresh: () => {
                          void refreshAdminData();
                        },
                        onSelectAppointment: id => {
                          setSelectedAppointmentId(id);
                          setIssuedLinks(null);
                        },
                        onToggleSelection: toggleAppointmentSelection,
                        onToggleAllVisible: toggleSelectAllVisible,
                        onClearSelection: clearSelection,
                        onBatchAction: batchAppointmentsMutation.executeBatch,
                      }}
                      items={bookingItems}
                      activeAppointmentId={selectedAppointmentId}
                      selectedAppointmentIds={selectedAppointmentIds}
                      isAllVisibleSelected={isAllVisibleSelected}
                      isAnyVisibleSelected={isAnyVisibleSelected}
                      isListLoading={appointmentsQuery.isLoading}
                      listErrorMessage={appointmentsQuery.error?.message}
                      total={appointmentsQuery.data?.total ?? 0}
                      totalPages={appointmentsQuery.data?.totalPages ?? 1}
                      riskSummary={appointmentsQuery.data?.riskSummary ?? null}
                      batchIsPending={batchAppointmentsMutation.isPending}
                      batchResult={batchAppointmentsMutation.lastResult}
                      canBatchResendAccessLink={canResendAccessLink}
                      canBatchReinitiatePayment={canReinitiatePayment}
                      canBatchUpdateStatus={canMutateAppointments}
                      detailMeta={detailMeta}
                      isDetailLoading={appointmentDetailQuery.isLoading}
                      detailErrorMessage={appointmentDetailQuery.error?.message}
                      detailContent={bookingDetailContent}
                      stickyActions={bookingStickyActions}
                    />
                  </TabsContent>

                  <TabsContent value="referrals" className="h-full min-h-0">
                    <ReferralWorkspaceConsole
                      currentUserId={user?.id ?? null}
                      currentUserRole={role ?? null}
                    />
                  </TabsContent>

                  {isAdmin ? (
                    <TabsContent value="users" className="space-y-6 pb-4">
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

                  <TabsContent value="operations" className="space-y-6 pb-4">
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

                    <SchedulingManagementCard
                      tr={tr}
                      lang={lang}
                      isReadOnly={!isAdmin}
                    />

                    <DoctorAccountManagementCard tr={tr} lang={lang} />

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
                      isUpdateRetentionPending={
                        updateRetentionPolicyMutation.isPending
                      }
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
                </div>
              </div>
            </div>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
