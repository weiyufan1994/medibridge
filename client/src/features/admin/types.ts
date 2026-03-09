import type { AdminSuggestion } from "@/features/admin/risk";

export type AdminErrorLike = {
  message: string;
};

export type QueryState<TData> = {
  isLoading: boolean;
  error: AdminErrorLike | null;
  data: TData | undefined;
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

export type NotifyDoctorFollowupMutation = SimpleMutation;

export type UpdateRetentionPolicyMutation = SimpleMutation;

export type RunRetentionCleanupMutation = SimpleMutation & {
  mutate: (input: { dryRun: boolean }) => void;
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

export type UseAdminConsoleResult = {
  emailQuery: string;
  setEmailQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  paymentStatusFilter: string;
  setPaymentStatusFilter: (value: string) => void;
  appointmentIdInput: string;
  setAppointmentIdInput: (value: string) => void;
  selectedAppointmentId: number | null;
  setSelectedAppointmentId: (value: number | null) => void;
  manualStatus: string;
  setManualStatus: (value: string) => void;
  manualPaymentStatus: string;
  setManualPaymentStatus: (value: string) => void;
  manualStatusReason: string;
  setManualStatusReason: (value: string) => void;
  freeRetentionDaysInput: string;
  setFreeRetentionDaysInput: (value: string) => void;
  paidRetentionDaysInput: string;
  setPaidRetentionDaysInput: (value: string) => void;
  issuedLinks: { patientLink: string; doctorLink: string } | null;
  setIssuedLinks: (value: { patientLink: string; doctorLink: string } | null) => void;
  appointmentStatusOptions: readonly string[];
  paymentStatusOptions: readonly string[];
  appointmentsQuery: QueryState<AdminAppointmentListItem[]>;
  triageQuery: QueryState<AdminTriageSessionItem[]>;
  metricsQuery: QueryState<AdminMetricsData>;
  appointmentDetailQuery: QueryState<AppointmentDetailData>;
  visitSummaryQuery: VisitSummaryQuery;
  retentionPoliciesQuery: QueryState<AdminRetentionPolicy[]>;
  retentionAuditsQuery: QueryState<AdminRetentionAudit[]>;
  refreshAdminData: () => Promise<void>;
  resendPaymentMutation: ReinitiatePaymentMutation;
  resendAccessLinkMutation: ResendAccessLinkMutation;
  issueLinksMutation: IssueLinksMutation;
  notifyDoctorFollowupMutation: NotifyDoctorFollowupMutation;
  updateStatusMutation: UpdateStatusMutation;
  generateSummaryMutation: GenerateSummaryMutation;
  exportSummaryPdfMutation: ExportSummaryPdfMutation;
  updateRetentionPolicyMutation: UpdateRetentionPolicyMutation;
  runRetentionCleanupMutation: RunRetentionCleanupMutation;
  risks: Array<{ code: string; level: "critical" | "warning"; message: string }>;
  suggestions: AdminSuggestion[];
  openAppointmentById: () => void;
  applyManualStatusUpdate: () => void;
  upsertRetentionPolicy: (tier: "free" | "paid") => void;
  toggleRetentionEnabled: (tier: "free" | "paid", enabled: boolean) => void;
  handleCopyDebugSnapshot: () => Promise<void>;
  beforeReinitiatePayment: () => boolean;
  beforeResendAccessLink: () => boolean;
  beforeIssueLinks: () => boolean;
  runSuggestedAction: (suggestion: AdminSuggestion) => void;
  toUiError: (message?: string) => string;
};
