import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReferralAdminPanel } from "@/features/admin/components/ReferralAdminPanel";
import { ReferralCatalogCard } from "@/features/admin/components/ReferralCatalogCard";
import { getReferralCopy } from "@/features/referrals/copy";

type ReferralWorkspaceConsoleProps = {
  currentUserId: number | null;
  currentUserRole: string | null;
};

export function ReferralWorkspaceConsole({
  currentUserId,
  currentUserRole,
}: ReferralWorkspaceConsoleProps) {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const isAdmin = currentUserRole === "admin";

  return (
    <Tabs
      defaultValue="workbench"
      className="flex h-full min-h-0 flex-col gap-3 overflow-hidden"
    >
      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 py-3">
        <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <TabsTrigger
            value="workbench"
            className="rounded-lg text-sm font-semibold data-[state=active]:border-slate-200 data-[state=active]:bg-white"
          >
            {copy.admin.workspaceTabs.workbench}
          </TabsTrigger>
          <TabsTrigger
            value="catalog"
            disabled={!isAdmin}
            className="rounded-lg text-sm font-semibold data-[state=active]:border-slate-200 data-[state=active]:bg-white"
            title={
              !isAdmin ? copy.admin.workspaceTabs.catalogPermission : undefined
            }
          >
            {copy.admin.workspaceTabs.catalog}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="workbench" className="min-h-0 overflow-hidden">
        <ReferralAdminPanel
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </TabsContent>

      <TabsContent value="catalog" className="min-h-0 overflow-hidden">
        {isAdmin ? (
          <div className="h-full min-h-0 overflow-y-auto pr-1">
            <ReferralCatalogCard />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-sm text-muted-foreground">
            {copy.admin.workspaceTabs.catalogPermission}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
