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
  getAdminConsoleSectionCopy,
  getVisibleAdminConsoleSections,
  type AdminConsoleSectionKey,
  type AdminOperationsTabKey,
} from "@/features/admin/adminConsoleLayout";
import { AdminNavigationRail } from "@/features/admin/components/AdminNavigationRail";
import { AdminOverview } from "@/features/admin/components/AdminOverview";
import { ReferralWorkspaceConsole } from "@/features/admin/components/ReferralWorkspaceConsole";
import { AdminAppointmentsWorkspace } from "@/features/admin/components/AdminAppointmentsWorkspace";
import { AdminDirectoryWorkspace } from "@/features/admin/components/AdminDirectoryWorkspace";
import { AdminOperationsWorkspace } from "@/features/admin/components/AdminOperationsWorkspace";
import { AdminUsersWorkspace } from "@/features/admin/components/AdminUsersWorkspace";
import { AdminActionConfirmationProvider } from "@/features/admin/components/AdminActionConfirmation";
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";

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

  const openAppointmentInAdmin = (id: number) => {
    setActiveTab("appointments");
    admin.setSelectedAppointmentId(id);
    admin.setIssuedLinks(null);
  };

  const openReferralInAdmin = (id: number) => {
    setRequestedReferralId(id);
    setActiveTab("referrals");
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
                <AdminDirectoryWorkspace
                  admin={admin}
                  activeTab={activeDirectoryTab}
                  isAdmin={isAdmin}
                  lang={lang}
                  tr={tr}
                  onTabChange={setDirectoryTab}
                />
              </TabsContent>

              {isAdmin ? (
                <TabsContent value="users" className="mt-0 p-4 sm:p-6">
                  <AdminUsersWorkspace
                    admin={admin}
                    activeTab={usersTab}
                    lang={lang}
                    locale={locale}
                    tr={tr}
                    onTabChange={setUsersTab}
                    requestConfirmation={requestConfirmation}
                  />
                </TabsContent>
              ) : null}

              <TabsContent value="operations" className="mt-0 p-4 sm:p-6">
                <AdminOperationsWorkspace
                  admin={admin}
                  activeTab={operationsTab}
                  isAdmin={isAdmin}
                  lang={lang}
                  locale={locale}
                  tr={tr}
                  onOpenAppointment={openAppointmentInAdmin}
                  onTabChange={setOperationsTab}
                  requestConfirmation={requestConfirmation}
                />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}
