import { useCallback } from "react";
import type { UseAdminConsoleResult } from "@/features/admin/types";
import type {
  AdminConsoleSectionKey,
  AdminOperationsTabKey,
} from "@/features/admin/adminConsoleLayout";
import type { AdminConfirmationRequest } from "@/features/admin/adminActionConfirmationContext";
import { translateAdminConsoleError } from "@/features/admin/hooks/adminConsoleHelpers";
import { useAdminAppointmentDetailActions } from "@/features/admin/hooks/useAdminAppointmentDetailActions";
import { useAdminAppointmentDetailState } from "@/features/admin/hooks/useAdminAppointmentDetailState";
import { useAdminAppointmentFilters } from "@/features/admin/hooks/useAdminAppointmentFilters";
import { useAdminAppointmentMutations } from "@/features/admin/hooks/useAdminAppointmentMutations";
import { useAdminAppointmentOperations } from "@/features/admin/hooks/useAdminAppointmentOperations";
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

  const toUiError = (message?: string) =>
    translateAdminConsoleError(message, tr);

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
  const { batchAppointmentsMutation, webhookReplayMutation } =
    useAdminAppointmentOperations({
      canMutateAdmin,
      canResendAccessLink,
      selectedAppointmentIds,
      tr,
      toUiError,
      refreshAdminData,
    });

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
    batchAppointmentsMutation,
    webhookReplayMutation,
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
