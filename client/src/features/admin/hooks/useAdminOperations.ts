import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  AdminExportScope,
  AdminPaymentStatus,
  AdminAppointmentStatus,
  AdminAppointmentSortBy,
} from "@/features/admin/types";
import type {
  AdminConsoleSectionKey,
  AdminOperationsTabKey,
} from "@/features/admin/adminConsoleLayout";
import { downloadTextFile } from "@/features/admin/utils/adminFormatting";
import { parseOptionalNonNegativeInteger } from "@/features/admin/hooks/adminConsoleHelpers";
import { trpc } from "@/lib/trpc";

type TranslateFn = (zh: string, en: string) => string;

type AdminExportFilters = {
  pageSize: number;
  status?: AdminAppointmentStatus;
  paymentStatus?: AdminPaymentStatus;
  doctorId?: number;
  amountMin?: number;
  amountMax?: number;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  scheduledAtFrom?: Date;
  scheduledAtTo?: Date;
  hasRisk?: boolean;
  sortBy: AdminAppointmentSortBy;
  sortDirection: "asc" | "desc";
};

type UseAdminOperationsParams = {
  canReadAdmin: boolean;
  activeSection: AdminConsoleSectionKey;
  activeOperationsTab: AdminOperationsTabKey;
  exportFilters: AdminExportFilters;
  tr: TranslateFn;
  toUiError: (message?: string) => string;
};

export function useAdminOperations({
  canReadAdmin,
  activeSection,
  activeOperationsTab,
  exportFilters,
  tr,
  toUiError,
}: UseAdminOperationsParams) {
  const [operationAuditPage, setOperationAuditPage] = useState(1);
  const [operationAuditOperatorIdInput, setOperationAuditOperatorIdInput] =
    useState("");
  const [operationAuditActionTypeInput, setOperationAuditActionTypeInput] =
    useState("");
  const [operationAuditFrom, setOperationAuditFrom] = useState("");
  const [operationAuditTo, setOperationAuditTo] = useState("");
  const [freeRetentionDaysInput, setFreeRetentionDaysInput] = useState("7");
  const [paidRetentionDaysInput, setPaidRetentionDaysInput] = useState("180");

  const parseDate = (value: string) => {
    if (!value.trim()) {
      return undefined;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  };

  const rawOperationAuditOperatorId = parseOptionalNonNegativeInteger(
    operationAuditOperatorIdInput
  );
  const operationAuditOperatorId =
    rawOperationAuditOperatorId !== undefined && rawOperationAuditOperatorId > 0
      ? rawOperationAuditOperatorId
      : undefined;

  const operationAuditQuery = trpc.system.adminOperationAudit.useQuery(
    {
      page: operationAuditPage,
      pageSize: 20,
      operatorId: operationAuditOperatorId,
      actionType: operationAuditActionTypeInput.trim() || undefined,
      from: parseDate(operationAuditFrom),
      to: parseDate(operationAuditTo),
    },
    {
      enabled:
        canReadAdmin &&
        activeSection === "operations" &&
        activeOperationsTab === "audit",
    }
  );
  const triageQuery = trpc.system.adminTriageSessions.useQuery(
    { limit: 50 },
    {
      enabled:
        canReadAdmin &&
        activeSection === "operations" &&
        activeOperationsTab === "monitoring",
    }
  );
  const triageRiskEventsQuery = trpc.system.adminTriageRiskEvents.useQuery(
    { limit: 50 },
    {
      enabled:
        canReadAdmin &&
        activeSection === "operations" &&
        activeOperationsTab === "monitoring",
    }
  );
  const retentionPoliciesQuery = trpc.system.adminRetentionPolicies.useQuery(
    undefined,
    {
      enabled:
        canReadAdmin &&
        activeSection === "operations" &&
        activeOperationsTab === "retention",
    }
  );
  const retentionAuditsQuery = trpc.system.adminRetentionCleanupAudits.useQuery(
    { limit: 20 },
    {
      enabled:
        canReadAdmin &&
        activeSection === "operations" &&
        activeOperationsTab === "retention",
    }
  );

  useEffect(() => {
    const rows = retentionPoliciesQuery.data;
    if (!rows || rows.length === 0) {
      return;
    }
    const free = rows.find(item => item.tier === "free");
    const paid = rows.find(item => item.tier === "paid");
    if (free) {
      setFreeRetentionDaysInput(String(free.retentionDays));
    }
    if (paid) {
      setPaidRetentionDaysInput(String(paid.retentionDays));
    }
  }, [retentionPoliciesQuery.data]);

  const updateRetentionPolicyMutation =
    trpc.system.adminUpsertRetentionPolicy.useMutation({
      onSuccess: async () => {
        toast.success(tr("保留策略已更新。", "Retention policy updated."));
        await retentionPoliciesQuery.refetch();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });

  const runRetentionCleanupMutation =
    trpc.system.adminRunRetentionCleanup.useMutation({
      onSuccess: async result => {
        const failureReason = (result as { failureReason?: string })
          .failureReason;
        const toIds = (input: unknown) =>
          Array.isArray(input)
            ? input
                .map(item => (typeof item === "number" ? item : Number(item)))
                .filter(item => Number.isFinite(item))
            : [];
        const freeSamples = toIds(
          (result as { freeSampleIds?: unknown }).freeSampleIds
        );
        const paidSamples = toIds(
          (result as { paidSampleIds?: unknown }).paidSampleIds
        );
        const sampleIds = freeSamples
          .concat(paidSamples)
          .slice(0, 5)
          .join(", ");
        if (failureReason) {
          toast.error(
            tr(`清理失败：${failureReason}`, `Cleanup failed: ${failureReason}`)
          );
        } else if (result.dryRun) {
          toast.success(
            tr(
              `演练完成。候选数：${result.totalCandidates}，样例ID：${sampleIds}`,
              `Dry-run done. Candidates: ${result.totalCandidates}, sample IDs: ${sampleIds}`
            )
          );
        } else {
          toast.success(
            tr(
              `清理完成。删除数：${result.deletedMessages}，样例ID：${sampleIds}`,
              `Cleanup done. Deleted: ${result.deletedMessages}, sample IDs: ${sampleIds}`
            )
          );
        }
        await retentionAuditsQuery.refetch();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });

  const exportMutation = trpc.system.adminExport.useMutation({
    onSuccess: result => {
      downloadTextFile(result.content, result.mimeType, result.filename);
      toast.success(tr("导出完成。", "Export completed."));
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });

  const upsertRetentionPolicy = (tier: "free" | "paid") => {
    const raw =
      tier === "free" ? freeRetentionDaysInput : paidRetentionDaysInput;
    const parsed = Number(raw.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      toast.error(
        tr(
          "保留天数需在 1 到 3650 之间。",
          "Retention days must be between 1 and 3650."
        )
      );
      return;
    }
    updateRetentionPolicyMutation.mutate({
      tier,
      retentionDays: parsed,
      enabled:
        retentionPoliciesQuery.data?.find(item => item.tier === tier)
          ?.enabled ?? true,
    });
  };

  const toggleRetentionEnabled = (tier: "free" | "paid", enabled: boolean) => {
    const policy = retentionPoliciesQuery.data?.find(
      item => item.tier === tier
    );
    const fallbackDays = tier === "free" ? 7 : 180;
    updateRetentionPolicyMutation.mutate({
      tier,
      retentionDays: policy?.retentionDays ?? fallbackDays,
      enabled,
    });
  };

  const exportScope = (input: {
    scope: AdminExportScope;
    format?: "csv" | "json";
    webhookAppointmentId?: number;
    auditOperatorId?: number;
    auditActionType?: string;
    auditFrom?: string;
    auditTo?: string;
  }) => {
    exportMutation.mutate({
      scope: input.scope,
      format: input.format ?? "csv",
      ...exportFilters,
      webhookAppointmentId: input.webhookAppointmentId,
      auditOperatorId: input.auditOperatorId,
      auditActionType: input.auditActionType,
      auditFrom: input.auditFrom,
      auditTo: input.auditTo,
    });
  };

  const refreshOperationsData = useCallback(async () => {
    if (activeOperationsTab === "audit") {
      await operationAuditQuery.refetch();
      return;
    }
    if (activeOperationsTab === "monitoring") {
      await Promise.all([
        triageQuery.refetch(),
        triageRiskEventsQuery.refetch(),
      ]);
      return;
    }
    if (activeOperationsTab === "retention") {
      await Promise.all([
        retentionPoliciesQuery.refetch(),
        retentionAuditsQuery.refetch(),
      ]);
    }
  }, [
    activeOperationsTab,
    operationAuditQuery,
    retentionAuditsQuery,
    retentionPoliciesQuery,
    triageQuery,
    triageRiskEventsQuery,
  ]);

  return {
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
    freeRetentionDaysInput,
    setFreeRetentionDaysInput,
    paidRetentionDaysInput,
    setPaidRetentionDaysInput,
    operationAuditQuery,
    triageQuery,
    triageRiskEventsQuery,
    retentionPoliciesQuery,
    retentionAuditsQuery,
    updateRetentionPolicyMutation,
    runRetentionCleanupMutation,
    exportAppointmentsMutation: {
      isPending: exportMutation.isPending,
      exportScope,
    },
    upsertRetentionPolicy,
    toggleRetentionEnabled,
    refreshOperationsData,
  };
}
