import type { AdminSuggestion } from "@/features/admin/risk";

export type AdminErrorLike = {
  message: string;
};

export type QueryState<TData> = {
  isLoading: boolean;
  error: AdminErrorLike | null;
  data: TData | undefined;
  refetch: () => Promise<{
    data: TData | undefined;
  }>;
};

export type SimpleMutation = {
  isPending: boolean;
};

export type AppointmentIdInput = {
  appointmentId: number;
};

export type ReinitiatePaymentMutation = SimpleMutation & {
  mutate: (input: AppointmentIdInput) => void;
};

export type ResendAccessLinkMutation = SimpleMutation & {
  mutate: (input: AppointmentIdInput) => void;
};

export type IssueLinksMutation = SimpleMutation & {
  mutate: (input: AppointmentIdInput) => void;
};

export type GenerateSummaryMutation = SimpleMutation & {
  mutate: (input: AppointmentIdInput & { forceRegenerate: boolean }) => void;
};

export type ExportSummaryPdfMutation = SimpleMutation & {
  mutate: (input: AppointmentIdInput & { lang: "zh" | "en" }) => void;
};

export type UpdateStatusMutation = SimpleMutation;
export type UpdateScheduleMutation = SimpleMutation;

export type NotifyDoctorFollowupMutation = SimpleMutation;

export type UpdateRetentionPolicyMutation = SimpleMutation;

export type RunRetentionCleanupMutation = SimpleMutation & {
  mutate: (input: { dryRun: boolean }) => void;
};

export type AdminHospital = {
  id: number;
  name: string;
  nameEn: string | null;
  city: string | null;
  cityEn: string | null;
  level: string | null;
  levelEn: string | null;
  imageUrl: string | null;
};

export type HospitalImageUploadState = {
  isPending: boolean;
  uploadHospitalImage: (hospitalId: number, file: File) => void;
};

export type HospitalImageClearState = {
  isPending: boolean;
  clearHospitalImage: (hospitalId: number) => void;
};

export type VisitSummaryData = {
  summaryZh: string;
  summaryEn: string;
};

export type VisitSummaryQuery = {
  isLoading: boolean;
  data: VisitSummaryData | null | undefined;
};

export type AdminToken = {
  id: number;
  role: string;
  useCount: number;
  maxUses: number;
  lastUsedAt: Date | string | null;
  expiresAt: Date | string | null;
  ipFirstSeen: string | null;
};

export type AdminStatusEvent = {
  id: number;
  createdAt: Date | string | null;
  fromStatus: string | null;
  toStatus: string;
  operatorType: string;
  operatorId: number | null;
  reason: string | null;
};

export type AdminWebhookEvent = {
  eventId: string;
  createdAt: Date | string | null;
  type: string;
  stripeSessionId: string | null;
  appointmentId: number | null;
};

export type AdminRecentMessage = {
  id: number;
  createdAt: Date | string | null;
  senderType: string;
  translatedContent: string | null;
  content: string | null;
  originalContent: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
};

export type AppointmentDetailData = {
  appointment: {
    id: number;
    email: string;
    status: string;
    paymentStatus: string;
    amount: number;
    currency: string;
    scheduledAt: Date | string | null;
    paidAt: Date | string | null;
  };
  doctor: {
    name: string;
    departmentName: string;
  } | null;
  triageSession: {
    summary: string | null;
  } | null;
  intake: unknown | null;
  activeTokens: AdminToken[];
  statusEvents: AdminStatusEvent[];
  webhookEvents: AdminWebhookEvent[];
  recentMessages: AdminRecentMessage[];
};

export type AdminAppointmentListItem = {
  id: number;
  email: string;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  doctorId: number;
  triageSessionId: number;
  createdAt: Date | string;
  hasRisk: boolean;
  riskCodes: string[];
};

export type AdminAppointmentRiskSummary = {
  total: number;
  pendingPaymentTimeout: number;
  webhookFailure: number;
  tokenExpiringSoon: number;
  tokenUsageExhausted: number;
};

export type AdminAppointmentListResult = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  riskSummary: AdminAppointmentRiskSummary;
  items: AdminAppointmentListItem[];
};

export type AdminTriageSessionItem = {
  id: number;
  userId: number | null;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type AdminMetricsData = {
  generatedAt?: string;
  counters?: unknown[];
};

export type AdminRetentionPolicy = {
  tier: "free" | "paid";
  retentionDays: number;
  enabled: boolean;
  updatedAt: Date | string;
};

export type AdminRetentionAudit = {
  id: number;
  createdAt: Date | string;
  dryRun: boolean;
  detailsJson: unknown;
  deletedMessages: number;
  freeRetentionDays: number;
  paidRetentionDays: number;
};

export type AdminOperationAuditItem = {
  id: number;
  appointmentId: number;
  fromStatus: string | null;
  toStatus: string;
  operatorType: string;
  operatorId: number | null;
  reason: string | null;
  payloadJson: unknown;
  createdAt: Date | string;
};

export type AdminOperationAuditResult = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AdminOperationAuditItem[];
};

export type AdminBatchActionResult = {
  appointmentId: number;
  status: "success" | "skipped" | "failed";
  reason?: string;
};

export type AdminExportScope =
  | "appointments"
  | "risk_summary"
  | "retention_audits"
  | "webhook_timeline"
  | "operation_audit";

export type UseAdminConsoleResult = {
  canReadAdmin: boolean;
  canMutateAdmin: boolean;
  canReplayWebhook: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  canNotifyFollowup: boolean;
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
  sortBy: "createdAt" | "scheduledAt" | "amount" | "status" | "paymentStatus" | "id";
  setSortBy: (
    value: "createdAt" | "scheduledAt" | "amount" | "status" | "paymentStatus" | "id"
  ) => void;
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
  metricsQuery: QueryState<AdminMetricsData>;
  appointmentDetailQuery: QueryState<AppointmentDetailData>;
  visitSummaryQuery: VisitSummaryQuery;
  retentionPoliciesQuery: QueryState<AdminRetentionPolicy[]>;
  retentionAuditsQuery: QueryState<AdminRetentionAudit[]>;
  hospitalsQuery: QueryState<AdminHospital[]>;
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
    }) => void;
    lastResult: AdminBatchActionResult[] | null;
  };
  webhookReplayMutation: {
    isPending: boolean;
    replayByEvent: (input: { eventId?: string; appointmentId?: number }) => void;
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
  risks: Array<{ code: string; level: "critical" | "warning"; message: string }>;
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
