import type { AdminSuggestion } from "@/features/admin/risk";
import type {
  AdminHospital,
  AdminUserItem,
  HospitalImageClearState,
  HospitalImageUploadState,
  QueryState,
  UpdateUserRoleMutation,
  VisitSummaryQuery,
} from "@/features/admin/adminTypes/common";
import type {
  AdminAppointmentListResult,
  AdminAppointmentSortBy,
  AdminBatchActionResult,
  AppointmentDetailData,
  ExportSummaryPdfMutation,
  GenerateSummaryMutation,
  IssueLinksMutation,
  NotifyDoctorFollowupMutation,
  ReinitiatePaymentMutation,
  ResendAccessLinkMutation,
  UpdateScheduleMutation,
  UpdateStatusMutation,
} from "@/features/admin/adminTypes/appointments";
import type {
  AdminExportScope,
  AdminOperationAuditResult,
  AdminRetentionAudit,
  AdminRetentionPolicy,
  AdminTriageRiskEventItem,
  AdminTriageSessionItem,
  RunRetentionCleanupMutation,
  UpdateRetentionPolicyMutation,
} from "@/features/admin/adminTypes/operations";

export type UseAdminConsoleResult = {
  canReadAdmin: boolean;
  canMutateAdmin: boolean;
  canReplayWebhook: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  canNotifyFollowup: boolean;
  userSearchQuery: string;
  setUserSearchQuery: (value: string) => void;
  emailQuery: string;
  setEmailQuery: (value: string) => void;
  page: number;
  setPage: (value: number) => void;
  pageSize: number;
  setPageSize: (value: number) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  paymentStatusFilter: string;
  setPaymentStatusFilter: (value: string) => void;
  resetAppointmentFilters: () => void;
  appointmentIdInput: string;
  setAppointmentIdInput: (value: string) => void;
  doctorIdInput: string;
  setDoctorIdInput: (value: string) => void;
  amountMinInput: string;
  setAmountMinInput: (value: string) => void;
  amountMaxInput: string;
  setAmountMaxInput: (value: string) => void;
  createdAtFrom: string;
  setCreatedAtFrom: (value: string) => void;
  createdAtTo: string;
  setCreatedAtTo: (value: string) => void;
  scheduledAtFrom: string;
  setScheduledAtFrom: (value: string) => void;
  scheduledAtTo: string;
  setScheduledAtTo: (value: string) => void;
  hasRiskFilter: boolean;
  setHasRiskFilter: (value: boolean) => void;
  sortBy: AdminAppointmentSortBy;
  setSortBy: (value: AdminAppointmentSortBy) => void;
  sortDirection: "asc" | "desc";
  setSortDirection: (value: "asc" | "desc") => void;
  selectedAppointmentId: number | null;
  setSelectedAppointmentId: (value: number | null) => void;
  manualStatus: string;
  setManualStatus: (value: string) => void;
  manualPaymentStatus: string;
  setManualPaymentStatus: (value: string) => void;
  manualStatusReason: string;
  setManualStatusReason: (value: string) => void;
  manualScheduledAt: string;
  setManualScheduledAt: (value: string) => void;
  freeRetentionDaysInput: string;
  setFreeRetentionDaysInput: (value: string) => void;
  paidRetentionDaysInput: string;
  setPaidRetentionDaysInput: (value: string) => void;
  issuedLinks: { patientLink: string; doctorLink: string } | null;
  setIssuedLinks: (
    value: { patientLink: string; doctorLink: string } | null
  ) => void;
  appointmentStatusOptions: readonly string[];
  paymentStatusOptions: readonly string[];
  appointmentsQuery: QueryState<AdminAppointmentListResult | null>;
  triageQuery: QueryState<AdminTriageSessionItem[]>;
  triageRiskEventsQuery: QueryState<AdminTriageRiskEventItem[]>;
  appointmentDetailQuery: QueryState<AppointmentDetailData>;
  visitSummaryQuery: VisitSummaryQuery;
  retentionPoliciesQuery: QueryState<AdminRetentionPolicy[]>;
  retentionAuditsQuery: QueryState<AdminRetentionAudit[]>;
  hospitalsQuery: QueryState<AdminHospital[]>;
  adminUsersQuery: QueryState<AdminUserItem[]>;
  operationAuditQuery: QueryState<AdminOperationAuditResult | null>;
  operationAuditPage: number;
  setOperationAuditPage: (value: number) => void;
  operationAuditOperatorIdInput: string;
  setOperationAuditOperatorIdInput: (value: string) => void;
  operationAuditActionTypeInput: string;
  setOperationAuditActionTypeInput: (value: string) => void;
  operationAuditFrom: string;
  setOperationAuditFrom: (value: string) => void;
  operationAuditTo: string;
  setOperationAuditTo: (value: string) => void;
  refreshAdminData: () => Promise<void>;
  resendPaymentMutation: ReinitiatePaymentMutation;
  resendAccessLinkMutation: ResendAccessLinkMutation;
  issueLinksMutation: IssueLinksMutation;
  adminHospitalImageUploadMutation: HospitalImageUploadState;
  adminHospitalImageClearMutation: HospitalImageClearState;
  notifyDoctorFollowupMutation: NotifyDoctorFollowupMutation;
  updateStatusMutation: UpdateStatusMutation;
  updateScheduleMutation: UpdateScheduleMutation;
  generateSummaryMutation: GenerateSummaryMutation;
  exportSummaryPdfMutation: ExportSummaryPdfMutation;
  updateRetentionPolicyMutation: UpdateRetentionPolicyMutation;
  updateUserRoleMutation: UpdateUserRoleMutation;
  runRetentionCleanupMutation: RunRetentionCleanupMutation;
  selectedAppointmentIds: number[];
  selectedCount: number;
  isAllVisibleSelected: boolean;
  isAnyVisibleSelected: boolean;
  toggleAppointmentSelection: (appointmentId: number, checked: boolean) => void;
  toggleSelectAllVisible: (checked: boolean) => void;
  clearSelection: () => void;
  batchAppointmentsMutation: {
    isPending: boolean;
    executeBatch: (input: {
      action: "resend_access_link" | "reinitiate_payment" | "update_status";
      toStatus?: string;
      toPaymentStatus?: string;
      reason?: string;
      idempotencyKey?: string;
    }) => Promise<unknown> | undefined;
    lastResult: AdminBatchActionResult[] | null;
  };
  webhookReplayMutation: {
    isPending: boolean;
    replayByEvent: (input: {
      eventId?: string;
      appointmentId?: number;
    }) => void;
  };
  exportAppointmentsMutation: {
    isPending: boolean;
    exportScope: (input: {
      scope: AdminExportScope;
      format: "csv" | "json";
      webhookAppointmentId?: number;
      auditOperatorId?: number;
      auditActionType?: string;
      auditFrom?: string;
      auditTo?: string;
    }) => void;
  };
  risks: Array<{
    code: string;
    level: "critical" | "warning";
    message: string;
  }>;
  suggestions: AdminSuggestion[];
  openAppointmentById: () => void;
  applyManualStatusUpdate: () => void;
  applyManualScheduleUpdate: () => void;
  setScheduleToNow: () => void;
  upsertRetentionPolicy: (tier: "free" | "paid") => void;
  toggleRetentionEnabled: (tier: "free" | "paid", enabled: boolean) => void;
  handleCopyDebugSnapshot: () => Promise<void>;
  beforeReinitiatePayment: () => boolean;
  beforeResendAccessLink: () => boolean;
  beforeIssueLinks: () => boolean;
  runSuggestedAction: (suggestion: AdminSuggestion) => void;
  toUiError: (message?: string) => string;
};
