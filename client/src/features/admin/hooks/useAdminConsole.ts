import { useCallback, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type {
  AdminBatchActionResult,
  UseAdminConsoleResult,
} from "@/features/admin/types";
import type {
  AdminConsoleSectionKey,
  AdminOperationsTabKey,
} from "@/features/admin/adminConsoleLayout";
import type { AdminConfirmationRequest } from "@/features/admin/adminActionConfirmationContext";
import { useAdminAppointmentDetailActions } from "@/features/admin/hooks/useAdminAppointmentDetailActions";
import { useAdminAppointmentDetailState } from "@/features/admin/hooks/useAdminAppointmentDetailState";
import { useAdminAppointmentFilters } from "@/features/admin/hooks/useAdminAppointmentFilters";
import { useAdminAppointmentMutations } from "@/features/admin/hooks/useAdminAppointmentMutations";
import { useAdminOperations } from "@/features/admin/hooks/useAdminOperations";
import { useAdminDirectory } from "@/features/admin/hooks/useAdminDirectory";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";

type TranslateFn = (zh: string, en: string) => string;

type UseAdminConsoleParams = {
  canReadAdmin: boolean;
  canMutateAdmin: boolean;
  canReplayWebhook: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  canNotifyFollowup: boolean;
  lang: "zh" | "en";
  tr: TranslateFn;
  activeSection: AdminConsoleSectionKey;
  activeOperationsTab: AdminOperationsTabKey;
  activeDirectoryTab: "catalog" | "media";
  activeUsersTab: "users" | "doctors";
  requestConfirmation: (request: AdminConfirmationRequest) => void;
};

const DEFAULT_BATCH_RESULT: AdminBatchActionResult[] = [];
const VALID_STATUS_VALUES = [
  "draft",
  "pending_payment",
  "paid",
  "active",
  "ended",
  "completed",
  "expired",
  "refunded",
  "canceled",
] as const;
const VALID_PAYMENT_STATUS_VALUES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
  "canceled",
] as const;
type AdminAppointmentStatus = (typeof VALID_STATUS_VALUES)[number];
type AdminPaymentStatus = (typeof VALID_PAYMENT_STATUS_VALUES)[number];
type ValidatedBatchInput = {
  action: "resend_access_link" | "reinitiate_payment" | "update_status";
  toStatus?: AdminAppointmentStatus;
  toPaymentStatus?: AdminPaymentStatus;
  reason?: string;
  idempotencyKey?: string;
};

const toStatusValue = (
  value: string | undefined
): AdminAppointmentStatus | undefined => {
  if (!value) {
    return undefined;
  }
  if ((VALID_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as AdminAppointmentStatus;
  }
  return undefined;
};
const toPaymentStatusValue = (
  value: string | undefined
): AdminPaymentStatus | undefined => {
  if (!value) {
    return undefined;
  }
  if ((VALID_PAYMENT_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as AdminPaymentStatus;
  }
  return undefined;
};
const toArray = (values: number[]): number[] => Array.from(new Set(values));

export function useAdminConsole({
  canReadAdmin,
  canMutateAdmin,
  canReplayWebhook,
  canResendAccessLink,
  canIssueAccessLinks,
  canNotifyFollowup,
  lang,
  tr,
  activeSection,
  activeOperationsTab,
  activeDirectoryTab,
  activeUsersTab,
  requestConfirmation,
}: UseAdminConsoleParams): UseAdminConsoleResult {
  const [batchLastResult, setBatchLastResult] = useState<
    AdminBatchActionResult[] | null
  >(DEFAULT_BATCH_RESULT);
  const {
    emailQuery,
    setEmailQuery,
    statusFilter,
    setStatusFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
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
    selectedAppointmentIds,
    appointmentStatusOptions,
    paymentStatusOptions,
    appointmentsQuery,
    exportFilters,
    isAllVisibleSelected,
    isAnyVisibleSelected,
    resetAppointmentFilters,
    toggleAppointmentSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useAdminAppointmentFilters({
    canReadAdmin,
    isAppointmentsActive: activeSection === "appointments",
  });
  const detailState = useAdminAppointmentDetailState({
    canReadAdmin,
    isAppointmentsActive: activeSection === "appointments",
    lang,
  });
  const {
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
    issuedLinks,
    setIssuedLinks,
    appointmentDetailQuery,
    visitSummaryQuery,
    risks,
    suggestions,
  } = detailState;

  const toUiError = (message?: string) => {
    const raw = (message ?? "").trim();
    if (!raw) {
      return tr("操作失败，请重试。", "Operation failed. Please retry.");
    }
    if (raw === "RETENTION_STORAGE_UNAVAILABLE") {
      return tr(
        "数据保留策略表不可用。请先执行数据库迁移（含 0020）。",
        "Retention storage is unavailable. Run database migrations (including 0020)."
      );
    }
    if (raw.includes("Unknown column") && raw.includes("imageUrl")) {
      return tr(
        "医院封面字段不可用。请执行最新数据库迁移（含 0023）并重启服务。",
        "Hospital cover field is unavailable. Run latest DB migrations (including 0023) and restart the server."
      );
    }
    if (raw.includes("Failed query")) {
      return tr(
        "数据库结构与当前代码不一致。请执行最新数据库迁移并重启服务。",
        "Database schema is out of sync with current code. Run latest migrations and restart the server."
      );
    }
    return raw;
  };

  const {
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
    exportAppointmentsMutation,
    upsertRetentionPolicy,
    toggleRetentionEnabled,
    refreshOperationsData,
  } = useAdminOperations({
    canReadAdmin,
    activeSection,
    activeOperationsTab,
    exportFilters,
    tr,
    toUiError,
  });

  const {
    hospitalsQuery,
    refreshDirectoryData,
    adminHospitalImageUploadMutation,
    adminHospitalImageClearMutation,
  } = useAdminDirectory({
    activeSection,
    activeDirectoryTab,
    canReadAdmin,
    canMutateAdmin,
    lang,
    tr,
    toUiError,
    requestConfirmation,
  });

  const {
    userSearchQuery,
    setUserSearchQuery,
    adminUsersQuery,
    updateUserRoleMutation,
    refreshUsersData,
  } = useAdminUsers({
    activeSection,
    activeUsersTab,
    canReadAdmin,
    canMutateAdmin,
    tr,
    toUiError,
  });

  const refreshAdminData = useCallback(async () => {
    if (activeSection === "appointments") {
      await Promise.all([
        appointmentsQuery.refetch(),
        selectedAppointmentId
          ? appointmentDetailQuery.refetch()
          : Promise.resolve(),
        selectedAppointmentId ? visitSummaryQuery.refetch() : Promise.resolve(),
      ]);
      return;
    }
    if (activeSection === "directory") {
      await refreshDirectoryData();
      return;
    }
    if (activeSection === "users") {
      await refreshUsersData();
      return;
    }
    if (activeSection === "operations") {
      await refreshOperationsData();
    }
  }, [
    activeSection,
    appointmentDetailQuery,
    appointmentsQuery,
    refreshDirectoryData,
    refreshOperationsData,
    refreshUsersData,
    selectedAppointmentId,
    visitSummaryQuery,
  ]);

  const detailMutations = useAdminAppointmentMutations({
    tr,
    toUiError,
    refreshAdminData,
    detailState,
  });
  const detailActions = useAdminAppointmentDetailActions({
    canMutateAdmin,
    canResendAccessLink,
    canIssueAccessLinks,
    canNotifyFollowup,
    lang,
    tr,
    requestConfirmation,
    detailState,
    mutations: detailMutations,
  });
  const {
    resendPaymentMutation,
    resendAccessLinkMutation,
    issueLinksMutation,
    notifyDoctorFollowupMutation,
    updateStatusMutation,
    updateScheduleMutation,
    generateSummaryMutation,
    exportSummaryPdfMutation,
  } = detailMutations;
  const {
    openAppointmentById,
    applyManualStatusUpdate,
    applyManualScheduleUpdate,
    setScheduleToNow,
    handleCopyDebugSnapshot,
    beforeReinitiatePayment,
    beforeResendAccessLink,
    beforeIssueLinks,
    runSuggestedAction,
  } = detailActions;

  const adminBatchMutation =
    trpc.system.adminBatchAppointmentsAction.useMutation({
      onSuccess: result => {
        setBatchLastResult(result.results);
        const msg = tr(
          `批量处理完成：成功 ${result.summary.success}，跳过 ${result.summary.skipped}，失败 ${result.summary.failed}`,
          `Batch done: ${result.summary.success} success, ${result.summary.skipped} skipped, ${result.summary.failed} failed`
        );
        toast.success(msg);
        refreshAdminData().catch(() => {
          toast.error(
            tr(
              "刷新列表失败，请重试。",
              "Failed to refresh list. Please retry."
            )
          );
        });
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const webhookReplayMutation = trpc.system.adminWebhookReplay.useMutation({
    onSuccess: result => {
      if (result.ok) {
        toast.success(tr("Webhook 重试成功。", "Webhook replay completed."));
      } else {
        toast.success(
          tr("Webhook 重试已去重。", "Webhook replay skipped by idempotency.")
        );
      }
      void refreshAdminData();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const executeBatch = (input: {
    action: "resend_access_link" | "reinitiate_payment" | "update_status";
    toStatus?: string;
    toPaymentStatus?: string;
    reason?: string;
    idempotencyKey?: string;
  }) => {
    if (selectedAppointmentIds.length === 0) {
      toast.error(
        tr("请先选择至少一条预约。", "Select at least one appointment.")
      );
      return;
    }
    const validatedInput: ValidatedBatchInput = {
      action: input.action,
      toStatus: toStatusValue(input.toStatus),
      toPaymentStatus: toPaymentStatusValue(input.toPaymentStatus),
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    };
    if (validatedInput.action === "resend_access_link") {
      if (!canResendAccessLink) {
        toast.message(
          tr(
            "当前角色无权执行该批量动作。",
            "Current role cannot execute this batch action."
          )
        );
        return;
      }
    }

    if (
      validatedInput.action === "reinitiate_payment" ||
      validatedInput.action === "update_status"
    ) {
      if (!canMutateAdmin) {
        toast.message(
          tr(
            "当前角色无权执行该批量动作。",
            "Current role cannot execute this batch action."
          )
        );
        return;
      }
    }

    const normalizedReason =
      typeof validatedInput.reason === "string" &&
      validatedInput.reason.trim().length
        ? validatedInput.reason.trim()
        : "admin_batch_action";
    return adminBatchMutation.mutateAsync({
      appointmentIds: toArray(selectedAppointmentIds),
      action: validatedInput.action,
      toStatus: validatedInput.toStatus,
      toPaymentStatus: validatedInput.toPaymentStatus,
      reason: normalizedReason,
      idempotencyKey: validatedInput.idempotencyKey ?? randomUUID(),
    });
  };

  const replayWebhookByEvent = (params: {
    eventId?: string;
    appointmentId?: number;
  }) => {
    webhookReplayMutation.mutate({
      eventId: params.eventId,
      appointmentId: params.appointmentId,
      replayKey: randomUUID(),
    });
  };

  return {
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
    appointmentsQuery,
    triageQuery,
    triageRiskEventsQuery,
    appointmentDetailQuery,
    visitSummaryQuery,
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
    canReadAdmin,
    canMutateAdmin,
    canReplayWebhook,
    canResendAccessLink,
    canIssueAccessLinks,
    canNotifyFollowup,
    hospitalsQuery,
    adminUsersQuery,
    refreshAdminData,
    resendPaymentMutation,
    resendAccessLinkMutation,
    issueLinksMutation,
    adminHospitalImageUploadMutation,
    adminHospitalImageClearMutation,
    notifyDoctorFollowupMutation,
    updateStatusMutation,
    updateScheduleMutation,
    generateSummaryMutation,
    exportSummaryPdfMutation,
    updateRetentionPolicyMutation,
    updateUserRoleMutation,
    runRetentionCleanupMutation,
    batchAppointmentsMutation: {
      isPending: adminBatchMutation.isPending,
      executeBatch,
      lastResult: batchLastResult,
    },
    webhookReplayMutation: {
      isPending: webhookReplayMutation.isPending,
      replayByEvent: replayWebhookByEvent,
    },
    exportAppointmentsMutation,
    selectedAppointmentIds,
    selectedCount: selectedAppointmentIds.length,
    isAllVisibleSelected,
    isAnyVisibleSelected,
    toggleAppointmentSelection,
    toggleSelectAllVisible,
    clearSelection,
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
  };
}

function randomUUID() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
