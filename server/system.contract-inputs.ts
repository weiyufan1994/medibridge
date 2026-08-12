export type ExpectedSystemRouterInputs = {
  adminAppointmentDetail: { appointmentId: number };
  adminAppointments: {
    page?: number;
    pageSize?: number;
    status?: AppointmentStatus;
    paymentStatus?: PaymentStatus;
    emailQuery?: string;
    doctorId?: number;
    amountMin?: number;
    amountMax?: number;
    createdAtFrom?: unknown;
    createdAtTo?: unknown;
    scheduledAtFrom?: unknown;
    scheduledAtTo?: unknown;
    hasRisk?: boolean;
    sortBy?: AppointmentSortField;
    sortDirection?: "asc" | "desc";
  };
  adminBatchAppointmentsAction: {
    action: "resend_access_link" | "reinitiate_payment" | "update_status";
    appointmentIds: number[];
    idempotencyKey?: string;
    toStatus?: AppointmentStatus;
    toPaymentStatus?: PaymentStatus;
    reason?: string;
  };
  adminClearHospitalImage: { hospitalId: number };
  adminExport: {
    scope:
      | "appointments"
      | "risk_summary"
      | "retention_audits"
      | "webhook_timeline"
      | "operation_audit";
    format?: "json" | "csv";
    pageSize?: number;
    status?: AppointmentStatus;
    paymentStatus?: PaymentStatus;
    emailQuery?: string;
    doctorId?: number;
    amountMin?: number;
    amountMax?: number;
    createdAtFrom?: unknown;
    createdAtTo?: unknown;
    scheduledAtFrom?: unknown;
    scheduledAtTo?: unknown;
    hasRisk?: boolean;
    sortBy?: AppointmentSortField;
    sortDirection?: "asc" | "desc";
    webhookAppointmentId?: number;
    auditPage?: number;
    auditPageSize?: number;
    auditOperatorId?: number;
    auditActionType?: string;
    auditFrom?: unknown;
    auditTo?: unknown;
  };
  adminExportVisitSummaryPdf: {
    appointmentId: number;
    lang?: "zh" | "en";
  };
  adminGenerateVisitSummary: {
    appointmentId: number;
    forceRegenerate?: boolean;
  };
  adminGetVisitSummary: { appointmentId: number };
  adminHospitals: void;
  adminIssueAccessLinks: { appointmentId: number };
  adminNotifyDoctorFollowup: { appointmentId: number };
  adminOperationAudit: {
    page?: number;
    pageSize?: number;
    operatorId?: number;
    actionType?: string;
    from?: unknown;
    to?: unknown;
  };
  adminReinitiatePayment: { appointmentId: number };
  adminResendAccessLink: { appointmentId: number };
  adminRetentionCleanupAudits: { limit?: number };
  adminRetentionPolicies: void;
  adminRunRetentionCleanup: { dryRun?: boolean };
  adminTriageRiskEvents: { limit?: number };
  adminTriageSessions: {
    limit?: number;
    status?: "active" | "completed";
    userId?: number;
  };
  adminUpdateAppointmentSchedule: {
    appointmentId: number;
    scheduledAt: unknown;
    reason?: string;
  };
  adminUpdateAppointmentStatus: {
    appointmentId: number;
    toStatus: AppointmentStatus;
    toPaymentStatus: PaymentStatus;
    reason: string;
  };
  adminUpdateUserRole: {
    userId: number;
    role: UserRole;
  };
  adminUploadHospitalImage: {
    hospitalId: number;
    imageBase64: string;
    fileName?: string;
    contentType?: string;
  };
  adminUpsertRetentionPolicy: {
    tier: "free" | "paid";
    retentionDays: number;
    enabled?: boolean;
  };
  adminUsers: {
    emailQuery?: string;
    limit?: number;
  };
  adminWebhookReplay: {
    eventId?: string;
    appointmentId?: number;
    replayKey?: string;
  };
  health: { timestamp: number };
  metrics: void;
  notifyOwner: { title: string; content: string };
};

export type AppointmentStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "active"
  | "ended"
  | "completed"
  | "expired"
  | "refunded"
  | "canceled";

export type PaymentStatus =
  | "paid"
  | "expired"
  | "refunded"
  | "canceled"
  | "unpaid"
  | "pending"
  | "failed";

export type UserRole = "admin" | "free" | "pro" | "ops";

type AppointmentSortField =
  | "id"
  | "createdAt"
  | "status"
  | "paymentStatus"
  | "scheduledAt"
  | "amount";
