import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminConfirmationRequest } from "@/features/admin/adminActionConfirmationContext";
import { getAdminConsoleModuleTabLabel } from "@/features/admin/adminConsoleLayout";
import { getAdminConfirmationCopy } from "@/features/admin/copy";
import type { UseAdminConsoleResult } from "@/features/admin/types";
import { DoctorAccountManagementCard } from "./DoctorAccountManagementCard";
import { UserRoleManagementCard } from "./UserRoleManagementCard";

type AdminUsersWorkspaceProps = {
  admin: UseAdminConsoleResult;
  activeTab: "users" | "doctors";
  lang: "zh" | "en";
  locale: string;
  tr: (zh: string, en: string) => string;
  onTabChange: (value: "users" | "doctors") => void;
  requestConfirmation: (request: AdminConfirmationRequest) => void;
};

export function AdminUsersWorkspace({
  admin,
  activeTab,
  lang,
  locale,
  tr,
  onTabChange,
  requestConfirmation,
}: AdminUsersWorkspaceProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={value => onTabChange(value as "users" | "doctors")}
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="users">
          {getAdminConsoleModuleTabLabel("userRoles", lang)}
        </TabsTrigger>
        <TabsTrigger value="doctors">
          {getAdminConsoleModuleTabLabel("doctorAccounts", lang)}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        <UserRoleManagementCard
          lang={lang}
          locale={locale}
          isLoading={admin.adminUsersQuery.isLoading}
          errorMessage={admin.adminUsersQuery.error?.message}
          users={admin.adminUsersQuery.data ?? []}
          isReadOnly={!admin.canMutateAdmin}
          isUpdating={admin.updateUserRoleMutation.isPending}
          searchQuery={admin.userSearchQuery}
          onSearchQueryChange={admin.setUserSearchQuery}
          onRefresh={() => void admin.adminUsersQuery.refetch()}
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
              onConfirm: () => admin.updateUserRoleMutation.mutateAsync(input),
            });
          }}
        />
      </TabsContent>
      <TabsContent value="doctors">
        <DoctorAccountManagementCard tr={tr} lang={lang} />
      </TabsContent>
    </Tabs>
  );
}
