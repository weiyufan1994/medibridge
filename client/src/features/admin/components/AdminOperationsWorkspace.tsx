import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AdminConfirmationRequest } from "@/features/admin/adminActionConfirmationContext";
import {
  getAdminConsoleModuleTabLabel,
  type AdminOperationsTabKey,
} from "@/features/admin/adminConsoleLayout";
import { getAdminConfirmationCopy } from "@/features/admin/copy";
import type { UseAdminConsoleResult } from "@/features/admin/types";
import { ExportCenterCard } from "./ExportCenterCard";
import { OperationAuditCard } from "./OperationAuditCard";
import { RetentionCard } from "./RetentionCard";
import { SchedulingManagementCard } from "./SchedulingManagementCard";
import { TriageRiskEventsCard } from "./TriageRiskEventsCard";
import { TriageSessionsCard } from "./TriageSessionsCard";

type AdminOperationsWorkspaceProps = {
  admin: UseAdminConsoleResult;
  activeTab: AdminOperationsTabKey;
  isAdmin: boolean;
  lang: "zh" | "en";
  locale: string;
  tr: (zh: string, en: string) => string;
  onOpenAppointment: (id: number) => void;
  onTabChange: (value: AdminOperationsTabKey) => void;
  requestConfirmation: (request: AdminConfirmationRequest) => void;
};

export function AdminOperationsWorkspace({
  admin,
  activeTab,
  isAdmin,
  lang,
  locale,
  tr,
  onOpenAppointment,
  onTabChange,
  requestConfirmation,
}: AdminOperationsWorkspaceProps) {
  const setAuditFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    admin.setOperationAuditPage(1);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={value => onTabChange(value as AdminOperationsTabKey)}
      className="gap-4"
    >
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="audit">
          {getAdminConsoleModuleTabLabel("operationAudit", lang)}
        </TabsTrigger>
        <TabsTrigger value="monitoring">
          {getAdminConsoleModuleTabLabel("operationMonitoring", lang)}
        </TabsTrigger>
        <TabsTrigger value="exports">
          {getAdminConsoleModuleTabLabel("operationExports", lang)}
        </TabsTrigger>
        <TabsTrigger value="scheduling">
          {getAdminConsoleModuleTabLabel("operationScheduling", lang)}
        </TabsTrigger>
        <TabsTrigger value="retention">
          {getAdminConsoleModuleTabLabel("operationRetention", lang)}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="audit">
        <OperationAuditCard
          tr={tr}
          locale={locale}
          isLoading={admin.operationAuditQuery.isLoading}
          errorMessage={admin.operationAuditQuery.error?.message}
          total={admin.operationAuditQuery.data?.total ?? 0}
          items={admin.operationAuditQuery.data?.items ?? []}
          page={admin.operationAuditPage}
          totalPages={admin.operationAuditQuery.data?.totalPages ?? 1}
          onPageChange={value =>
            admin.setOperationAuditPage(Math.max(1, value))
          }
          onRefresh={() => void admin.refreshAdminData()}
          onOpenAppointmentById={onOpenAppointment}
          operatorIdInput={admin.operationAuditOperatorIdInput}
          onOperatorIdInputChange={value =>
            setAuditFilter(admin.setOperationAuditOperatorIdInput, value)
          }
          actionTypeInput={admin.operationAuditActionTypeInput}
          onActionTypeInputChange={value =>
            setAuditFilter(admin.setOperationAuditActionTypeInput, value)
          }
          from={admin.operationAuditFrom}
          onFromChange={value =>
            setAuditFilter(admin.setOperationAuditFrom, value)
          }
          to={admin.operationAuditTo}
          onToChange={value => setAuditFilter(admin.setOperationAuditTo, value)}
        />
      </TabsContent>

      <TabsContent value="monitoring" className="space-y-4">
        <TriageSessionsCard
          tr={tr}
          locale={locale}
          isLoading={admin.triageQuery.isLoading}
          errorMessage={admin.triageQuery.error?.message}
          items={admin.triageQuery.data ?? []}
        />
        <TriageRiskEventsCard
          tr={tr}
          locale={locale}
          isLoading={admin.triageRiskEventsQuery.isLoading}
          errorMessage={admin.triageRiskEventsQuery.error?.message}
          items={admin.triageRiskEventsQuery.data ?? []}
        />
      </TabsContent>

      <TabsContent value="exports">
        <ExportCenterCard
          tr={tr}
          locale={locale}
          isExporting={admin.exportAppointmentsMutation.isPending}
          onExport={input =>
            admin.exportAppointmentsMutation.exportScope(input)
          }
        />
      </TabsContent>

      <TabsContent value="scheduling">
        <SchedulingManagementCard tr={tr} lang={lang} isReadOnly={!isAdmin} />
      </TabsContent>

      <TabsContent value="retention">
        <RetentionCard
          tr={tr}
          locale={locale}
          isPoliciesLoading={admin.retentionPoliciesQuery.isLoading}
          policiesErrorMessage={
            admin.retentionPoliciesQuery.error?.message
              ? admin.toUiError(admin.retentionPoliciesQuery.error.message)
              : undefined
          }
          policies={admin.retentionPoliciesQuery.data ?? []}
          freeRetentionDaysInput={admin.freeRetentionDaysInput}
          paidRetentionDaysInput={admin.paidRetentionDaysInput}
          onFreeRetentionDaysInputChange={admin.setFreeRetentionDaysInput}
          onPaidRetentionDaysInputChange={admin.setPaidRetentionDaysInput}
          onUpsertRetentionPolicy={admin.upsertRetentionPolicy}
          onToggleRetentionEnabled={admin.toggleRetentionEnabled}
          isReadOnly={!isAdmin}
          isUpdateRetentionPending={
            admin.updateRetentionPolicyMutation.isPending
          }
          isCleanupPending={admin.runRetentionCleanupMutation.isPending}
          onRunCleanupDryRun={() =>
            admin.runRetentionCleanupMutation.mutate({ dryRun: true })
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
                admin.runRetentionCleanupMutation.mutateAsync({
                  dryRun: false,
                }),
            });
          }}
          isAuditsLoading={admin.retentionAuditsQuery.isLoading}
          auditsErrorMessage={
            admin.retentionAuditsQuery.error?.message
              ? admin.toUiError(admin.retentionAuditsQuery.error.message)
              : undefined
          }
          audits={admin.retentionAuditsQuery.data ?? []}
        />
      </TabsContent>
    </Tabs>
  );
}
