import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminConsoleModuleTabLabel } from "@/features/admin/adminConsoleLayout";
import type { UseAdminConsoleResult } from "@/features/admin/types";
import { HospitalImageManagementCard } from "./HospitalImageManagementCard";
import { ReferralCatalogCard } from "./ReferralCatalogCard";

type AdminDirectoryWorkspaceProps = {
  admin: UseAdminConsoleResult;
  activeTab: "catalog" | "media";
  isAdmin: boolean;
  lang: "zh" | "en";
  tr: (zh: string, en: string) => string;
  onTabChange: (value: "catalog" | "media") => void;
};

export function AdminDirectoryWorkspace({
  admin,
  activeTab,
  isAdmin,
  lang,
  tr,
  onTabChange,
}: AdminDirectoryWorkspaceProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={value => onTabChange(value as "catalog" | "media")}
      className="gap-4"
    >
      <TabsList>
        {isAdmin ? (
          <TabsTrigger value="catalog">
            {getAdminConsoleModuleTabLabel("directoryCatalog", lang)}
          </TabsTrigger>
        ) : null}
        <TabsTrigger value="media">
          {getAdminConsoleModuleTabLabel("directoryMedia", lang)}
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
          isLoading={admin.hospitalsQuery.isLoading}
          errorMessage={
            admin.hospitalsQuery.error?.message
              ? admin.toUiError(admin.hospitalsQuery.error.message)
              : undefined
          }
          hospitals={admin.hospitalsQuery.data ?? []}
          isReadOnly={!isAdmin}
          uploadState={admin.adminHospitalImageUploadMutation}
          clearState={admin.adminHospitalImageClearMutation}
        />
      </TabsContent>
    </Tabs>
  );
}
