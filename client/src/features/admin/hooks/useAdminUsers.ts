import { useState } from "react";
import { toast } from "sonner";
import type { AdminConsoleSectionKey } from "@/features/admin/adminConsoleLayout";
import { trpc } from "@/lib/trpc";

type TranslateFn = (zh: string, en: string) => string;

type UseAdminUsersParams = {
  activeSection: AdminConsoleSectionKey;
  activeUsersTab: "users" | "doctors";
  canReadAdmin: boolean;
  canMutateAdmin: boolean;
  tr: TranslateFn;
  toUiError: (message?: string) => string;
};

export function useAdminUsers({
  activeSection,
  activeUsersTab,
  canReadAdmin,
  canMutateAdmin,
  tr,
  toUiError,
}: UseAdminUsersParams) {
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const adminUsersQuery = trpc.system.adminUsers.useQuery(
    {
      emailQuery: userSearchQuery.trim() || undefined,
      limit: 50,
    },
    {
      enabled:
        canReadAdmin &&
        canMutateAdmin &&
        activeSection === "users" &&
        activeUsersTab === "users",
    }
  );
  const updateUserRoleMutation = trpc.system.adminUpdateUserRole.useMutation({
    onSuccess: async () => {
      toast.success(tr("用户权限已更新。", "User role updated."));
      await adminUsersQuery.refetch();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });

  return {
    userSearchQuery,
    setUserSearchQuery,
    adminUsersQuery,
    updateUserRoleMutation,
    refreshUsersData: () => adminUsersQuery.refetch(),
  };
}
