import { useState } from "react";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  ShieldCheck,
  Workflow,
  Wrench,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/features/auth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getDisplayLocale, getLocalizedText } from "@/lib/i18n";
import { useAdminConsole } from "@/features/admin/hooks/useAdminConsole";
import {
  getAdminConsoleChromeCopy,
  getAdminConsoleModuleTabLabel,
  getAdminConsoleSectionCopy,
  getVisibleAdminConsoleSections,
  type AdminConsoleSectionKey,
  type AdminOperationsTabKey,
} from "@/features/admin/adminConsoleLayout";
import { AdminNavigationRail } from "@/features/admin/components/AdminNavigationRail";
import { TriageSessionsCard } from "@/features/admin/components/TriageSessionsCard";
import { TriageRiskEventsCard } from "@/features/admin/components/TriageRiskEventsCard";
import { AdminOverview } from "@/features/admin/components/AdminOverview";
import { OperationAuditCard } from "@/features/admin/components/OperationAuditCard";
import { RetentionCard } from "@/features/admin/components/RetentionCard";
import { HospitalImageManagementCard } from "@/features/admin/components/HospitalImageManagementCard";
import { ExportCenterCard } from "@/features/admin/components/ExportCenterCard";
import { SchedulingManagementCard } from "@/features/admin/components/SchedulingManagementCard";
import { DoctorAccountManagementCard } from "@/features/admin/components/DoctorAccountManagementCard";
import { UserRoleManagementCard } from "@/features/admin/components/UserRoleManagementCard";
import { ReferralWorkspaceConsole } from "@/features/admin/components/ReferralWorkspaceConsole";
import { ReferralCatalogCard } from "@/features/admin/components/ReferralCatalogCard";
import { AdminAppointmentsWorkspace } from "@/features/admin/components/AdminAppointmentsWorkspace";
import { AdminActionConfirmationProvider } from "@/features/admin/components/AdminActionConfirmation";
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";
import { getAdminConfirmationCopy } from "@/features/admin/copy";

export default function AdminConsole() {
  return (
    <AdminActionConfirmationProvider>
      <AdminConsoleContent />
    </AdminActionConfirmationProvider>
  );
}

function AdminConsoleContent() {
  const { user, loading } = useAuth();
  const { resolved } = useLanguage();
  const [activeTab, setActiveTab] =
    useState<AdminConsoleSectionKey>("overview");
  const [operationsTab, setOperationsTab] =
    useState<AdminOperationsTabKey>("audit");
  const [directoryTab, setDirectoryTab] = useState<"catalog" | "media">(
    "catalog"
  );
  const [usersTab, setUsersTab] = useState<"users" | "doctors">("users");
  const [requestedReferralId, setRequestedReferralId] = useState<number | null>(
    null
  );
  const lang = resolved as "zh" | "en";
  const locale = getDisplayLocale(lang);
  const tr = (zh: string, en: string) =>
    getLocalizedText({ lang, value: { zh, en }, placeholder: zh });
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === "admin";
  const isOps = role === "ops";
  const canAccessAdmin = isAdmin || isOps;
  const activeDirectoryTab = isAdmin ? directoryTab : "media";
  const canReplayWebhook = isAdmin || isOps;
  const canResendAccessLink = isAdmin || isOps;
  const canIssueAccessLinks = isAdmin || isOps;
  const canNotifyFollowup = isAdmin || isOps;
  const canReinitiatePayment = isAdmin;
  const canMutateAppointments = isAdmin;
  const { requestConfirmation } = useAdminActionConfirmation();
  const admin = useAdminConsole({
    canReadAdmin: canAccessAdmin,
    canMutateAdmin: isAdmin,
    canReplayWebhook,
    canResendAccessLink,
    canIssueAccessLinks,
    canNotifyFollowup,
    lang,
    tr,
    activeSection: activeTab,
    activeOperationsTab: operationsTab,
    activeDirectoryTab,
    activeUsersTab: usersTab,
    requestConfirmation,
  });

  const {
    userSearchQuery,
    setUserSearchQuery,
    freeRetentionDaysInput,
    setFreeRetentionDaysInput,
    paidRetentionDaysInput,
    setPaidRetentionDaysInput,
    exportAppointmentsMutation,
    triageQuery,
    triageRiskEventsQuery,
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
    retentionPoliciesQuery,
    retentionAuditsQuery,
    hospitalsQuery,
    adminUsersQuery,
    adminHospitalImageUploadMutation,
    adminHospitalImageClearMutation,
    refreshAdminData,
    updateRetentionPolicyMutation,
    updateUserRoleMutation,
    runRetentionCleanupMutation,
    upsertRetentionPolicy,
    toggleRetentionEnabled,
    toUiError,
  } = admin;

  const openAppointmentInAdmin = (id: number) => {
    setActiveTab("appointments");
    admin.setSelectedAppointmentId(id);
    admin.setIssuedLinks(null);
  };

  const openReferralInAdmin = (id: number) => {
    setRequestedReferralId(id);
    setActiveTab("referrals");
  };

  const handleAuditPageChange = (value: number) => {
    setOperationAuditPage(Math.max(1, value));
  };

  const chromeCopy = getAdminConsoleChromeCopy(lang);
  const sectionCopyByKey = {
    overview: getAdminConsoleSectionCopy("overview", lang),
    appointments: getAdminConsoleSectionCopy("appointments", lang),
    referrals: getAdminConsoleSectionCopy("referrals", lang),
    directory: getAdminConsoleSectionCopy("directory", lang),
    users: getAdminConsoleSectionCopy("users", lang),
    operations: getAdminConsoleSectionCopy("operations", lang),
  } as const;

  const iconBySection = {
    overview: LayoutDashboard,
    appointments: Workflow,
    referrals: ClipboardList,
    directory: Building2,
    users: ShieldCheck,
    operations: Wrench,
  } as const;
  const navigationItems = getVisibleAdminConsoleSections(role).map(value => ({
    value,
    label: sectionCopyByKey[value].navLabel,
    icon: iconBySection[value],
  }));
  const moduleTabCopy = {
    directoryCatalog: getAdminConsoleModuleTabLabel("directoryCatalog", lang),
    directoryMedia: getAdminConsoleModuleTabLabel("directoryMedia", lang),
    userRoles: getAdminConsoleModuleTabLabel("userRoles", lang),
    doctorAccounts: getAdminConsoleModuleTabLabel("doctorAccounts", lang),
    operationAudit: getAdminConsoleModuleTabLabel("operationAudit", lang),
    operationMonitoring: getAdminConsoleModuleTabLabel(
      "operationMonitoring",
      lang
    ),
    operationExports: getAdminConsoleModuleTabLabel("operationExports", lang),
    operationScheduling: getAdminConsoleModuleTabLabel(
      "operationScheduling",
      lang
    ),
    operationRetention: getAdminConsoleModuleTabLabel(
      "operationRetention",
      lang
    ),
  };

  if (loading) {
    return (
      <AppLayout title={tr("管理后台", "Admin Console")}>
        <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
      <div className="admin-console mx-auto flex h-[calc(100dvh-4rem)] min-h-0 w-full max-w-[1680px] flex-1 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={value => setActiveTab(value as typeof activeTab)}
          orientation="vertical"
          className="flex h-full min-h-0 w-full flex-row gap-0 overflow-hidden"
        >
          <AdminNavigationRail
            items={navigationItems}
            activeValue={activeTab}
            collapseLabel={chromeCopy.collapseNavigation}
            expandLabel={chromeCopy.expandNavigation}
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-admin-background">
            <h1 className="sr-only">{sectionCopyByKey[activeTab].title}</h1>

            <TabsList className="h-11 w-full shrink-0 justify-start gap-1 overflow-x-auto rounded-none border-b border-admin-border bg-admin-surface px-3 lg:hidden">
              {navigationItems.map(item => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="flex-none"
                >
                  <item.icon className="size-4" />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div
              className={
                activeTab === "appointments" || activeTab === "referrals"
                  ? "min-h-0 flex-1 overflow-hidden"
                  : "min-h-0 flex-1 overflow-y-auto"
              }
            >
              <TabsContent value="overview" className="mt-0">
                <AdminOverview
                  lang={lang}
                  locale={locale}
                  canReadAdmin={canAccessAdmin}
                  onOpenAppointment={openAppointmentInAdmin}
                  onOpenReferral={openReferralInAdmin}
                />
              </TabsContent>

              <TabsContent
                value="appointments"
                className="mt-0 h-full min-h-0 p-4 sm:p-5"
              >
                <AdminAppointmentsWorkspace
                  admin={admin}
                  lang={lang}
                  locale={locale}
                  tr={tr}
                  permissions={{
                    canIssueAccessLinks,
                    canMutateAppointments,
                    canNotifyFollowup,
                    canReinitiatePayment,
                    canReplayWebhook,
                    canResendAccessLink,
                  }}
                  requestConfirmation={requestConfirmation}
                />
              </TabsContent>

              <TabsContent
                value="referrals"
                className="mt-0 h-full min-h-0 p-4 sm:p-5"
              >
                <ReferralWorkspaceConsole
                  currentUserId={user?.id ?? null}
                  currentUserRole={role ?? null}
                  requestedOrderId={requestedReferralId}
                />
              </TabsContent>

              <TabsContent value="directory" className="mt-0 p-4 sm:p-6">
                <Tabs
                  value={activeDirectoryTab}
                  onValueChange={value =>
                    setDirectoryTab(value as "catalog" | "media")
                  }
                  className="gap-4"
                >
                  <TabsList>
                    {isAdmin ? (
                      <TabsTrigger value="catalog">
                        {moduleTabCopy.directoryCatalog}
                      </TabsTrigger>
                    ) : null}
                    <TabsTrigger value="media">
                      {moduleTabCopy.directoryMedia}
                    </TabsTrigger>
                  </TabsList>
                  {isAdmin ? (
                    <TabsContent value="catalog">
                      <ReferralCatalogCard />
                    </TabsContent>
                  ) : null}
                  <TabsContent value="media">
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
                  </TabsContent>
                </Tabs>
              </TabsContent>

              {isAdmin ? (
                <TabsContent value="users" className="mt-0 p-4 sm:p-6">
                  <Tabs
                    value={usersTab}
                    onValueChange={value =>
                      setUsersTab(value as "users" | "doctors")
                    }
                    className="gap-4"
                  >
                    <TabsList>
                      <TabsTrigger value="users">
                        {moduleTabCopy.userRoles}
                      </TabsTrigger>
                      <TabsTrigger value="doctors">
                        {moduleTabCopy.doctorAccounts}
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="users">
                      <UserRoleManagementCard
                        lang={lang}
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
                          const confirmation = getAdminConfirmationCopy(
                            lang,
                            "updateUserRole"
                          );
                          requestConfirmation({
                            title: confirmation.title,
                            description: confirmation.description,
                            confirmLabel: confirmation.confirmLabel,
                            cancelLabel: confirmation.cancelLabel,
                            tone: "danger",
                            onConfirm: () =>
                              updateUserRoleMutation.mutateAsync(input),
                          });
                        }}
                      />
                    </TabsContent>
                    <TabsContent value="doctors">
                      <DoctorAccountManagementCard tr={tr} lang={lang} />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              ) : null}

              <TabsContent value="operations" className="mt-0 p-4 sm:p-6">
                <Tabs
                  value={operationsTab}
                  onValueChange={value =>
                    setOperationsTab(value as AdminOperationsTabKey)
                  }
                  className="gap-4"
                >
                  <TabsList className="h-auto flex-wrap justify-start">
                    <TabsTrigger value="audit">
                      {moduleTabCopy.operationAudit}
                    </TabsTrigger>
                    <TabsTrigger value="monitoring">
                      {moduleTabCopy.operationMonitoring}
                    </TabsTrigger>
                    <TabsTrigger value="exports">
                      {moduleTabCopy.operationExports}
                    </TabsTrigger>
                    <TabsTrigger value="scheduling">
                      {moduleTabCopy.operationScheduling}
                    </TabsTrigger>
                    <TabsTrigger value="retention">
                      {moduleTabCopy.operationRetention}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="audit">
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
                  </TabsContent>

                  <TabsContent value="monitoring" className="space-y-4">
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

                  <TabsContent value="exports">
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
                  </TabsContent>

                  <TabsContent value="scheduling">
                    <SchedulingManagementCard
                      tr={tr}
                      lang={lang}
                      isReadOnly={!isAdmin}
                    />
                  </TabsContent>

                  <TabsContent value="retention">
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
                      onRunCleanupReal={() => {
                        const confirmation = getAdminConfirmationCopy(
                          lang,
                          "retentionCleanup"
                        );
                        requestConfirmation({
                          title: confirmation.title,
                          description: confirmation.description,
                          confirmLabel: confirmation.confirmLabel,
                          cancelLabel: confirmation.cancelLabel,
                          tone: "danger",
                          onConfirm: () =>
                            runRetentionCleanupMutation.mutateAsync({
                              dryRun: false,
                            }),
                        });
                      }}
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
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
