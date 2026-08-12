import type {
  AppointmentStatus,
  PaymentStatus,
  UserRole,
} from "./system.contract-inputs";

type LocalizedText = { zh: string; en: string };
type OperatorType = "admin" | "patient" | "doctor" | "system" | "webhook";

type AppointmentListItem = {
  id: number;
  userId: number | null;
  email: string;
  doctorId: number;
  triageSessionId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  amount: number;
  currency: string;
  stripeSessionId: string | null;
  scheduledAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  riskCodes: string[];
  hasRisk: boolean;
};

type StatusEvent = {
  id: number;
  appointmentId: number;
  fromStatus: string | null;
  toStatus: string;
  operatorType: OperatorType;
  operatorId: number | null;
  reason: string | null;
  payloadJson: unknown;
  createdAt: Date;
};

type PublicLocalizedHospital = {
  id: number;
  contact: string | null;
  website: string | null;
  description: string | null;
  descriptionEn: string | null;
  imageUrl: string | null;
  sourceHash: string | null;
  translationStatus: "pending" | "done" | "failed" | null;
  translatedAt: Date | null;
  lastTranslationError: string | null;
  translationProvider: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
  name: LocalizedText;
  city: LocalizedText;
  level: LocalizedText;
  address: LocalizedText;
};

type RetentionCleanupResult =
  | {
      dryRun: boolean;
      scannedMessages: 0;
      deletedMessages: 0;
      totalCandidates: 0;
      freeCandidates: 0;
      paidCandidates: 0;
      freeRetentionDays: 0;
      paidRetentionDays: 0;
      guestCandidates: 0;
      deletedGuests: 0;
      guestRetentionDays: number;
      freeSampleIds: number[];
      paidSampleIds: number[];
      guestSampleIds: number[];
      failureReason: string;
      generatedAt: string;
      nextCleanupAt: string;
    }
  | {
      dryRun: boolean;
      scannedMessages: number;
      deletedMessages: number;
      totalCandidates: number;
      freeCandidates: number;
      paidCandidates: number;
      freeRetentionDays: number;
      paidRetentionDays: number;
      guestCandidates: number;
      deletedGuests: number;
      guestRetentionDays: number;
      freeSampleIds: number[];
      paidSampleIds: number[];
      guestSampleIds: number[];
      nextCleanupAt: string;
      generatedAt: string;
    };

type ExportVariant<
  Scope extends string,
  FilePrefix extends string,
  Format extends "json" | "csv",
> = {
  scope: Scope;
  format: Format;
  filename: `admin-${FilePrefix}-${string}.${Format}`;
  mimeType: Format extends "json" ? "application/json" : "text/csv";
  content: string;
};

type ExportResult =
  | ExportVariant<"appointments", "appointments", "json">
  | ExportVariant<"appointments", "appointments", "csv">
  | ExportVariant<"risk_summary", "risk-summary", "json">
  | ExportVariant<"risk_summary", "risk-summary", "csv">
  | ExportVariant<"retention_audits", "retention-audits", "json">
  | ExportVariant<"retention_audits", "retention-audits", "csv">
  | ExportVariant<"webhook_timeline", "webhook-timeline", "json">
  | ExportVariant<"webhook_timeline", "webhook-timeline", "csv">
  | ExportVariant<"operation_audit", "operation-audit", "json">
  | ExportVariant<"operation_audit", "operation-audit", "csv">;

export type ExpectedSystemRouterOutputs = {
  adminAppointmentDetail: {
    appointment: Omit<AppointmentListItem, "riskCodes" | "hasRisk">;
    doctor: {
      id: number;
      name: LocalizedText;
      hospitalName: LocalizedText;
      departmentName: LocalizedText;
    } | null;
    triageSession: {
      id: number;
      status: "active" | "completed";
      summary: string | null;
      summaryGeneratedAt: Date | null;
    } | null;
    intake: {
      chiefComplaint: string;
      duration: string;
      medicalHistory: string;
      medications: string;
      allergies: string;
      ageGroup: string;
      otherSymptoms: string;
    } | null;
    activeTokens: {
      id: number;
      role: "patient" | "doctor";
      expiresAt: Date;
      useCount: number;
      maxUses: number;
      lastUsedAt: Date | null;
      ipFirstSeen: string | null;
    }[];
    statusEvents: Omit<StatusEvent, "appointmentId">[];
    webhookEvents: {
      eventId: string;
      type: string;
      stripeSessionId: string | null;
      appointmentId: number | null;
      payloadHash: string | null;
      createdAt: Date;
    }[];
    recentMessages: {
      id: number;
      senderType: "patient" | "doctor" | "system";
      content: string;
      originalContent: string | null;
      translatedContent: string | null;
      sourceLanguage: string | null;
      targetLanguage: string | null;
      createdAt: Date;
    }[];
  };
  adminAppointments: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    items: AppointmentListItem[];
    riskSummary: {
      total: number;
      pendingPaymentTimeout: number;
      webhookFailure: number;
      tokenExpiringSoon: number;
      tokenUsageExhausted: number;
    };
  };
  adminBatchAppointmentsAction: {
    results: {
      appointmentId: number;
      status: "success" | "skipped" | "failed";
      reason?: string;
    }[];
    summary: {
      total: number;
      success: number;
      skipped: number;
      failed: number;
    };
    idempotencyKey: string;
  };
  adminClearHospitalImage: { hospitalId: number; imageUrl: null };
  adminExport: ExportResult;
  adminExportVisitSummaryPdf: {
    appointmentId: number;
    filename:
      | `visit-summary-${number}-zh.pdf`
      | `visit-summary-${number}-en.pdf`;
    mimeType: "application/pdf";
    base64: string;
    generatedAt: string;
  };
  adminGenerateVisitSummary:
    | {
        appointmentId: number;
        summary: LocalizedText;
        source: string;
        generatedAt: Date;
        cached: true;
      }
    | {
        appointmentId: number;
        summary: LocalizedText;
        source: string;
        generatedAt: Date;
        cached: false;
      };
  adminGetVisitSummary: {
    id: number;
    appointmentId: number;
    summary: LocalizedText;
    source: string;
    generatedBy: number | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  adminHospitals: PublicLocalizedHospital[];
  adminIssueAccessLinks: {
    appointmentId: number;
    patientLink: string;
    doctorLink: string;
    expiresAt: Date;
  };
  adminNotifyDoctorFollowup: { ok: boolean };
  adminOperationAudit: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    items: StatusEvent[];
  };
  adminReinitiatePayment: { appointmentId: number; checkoutUrl: string };
  adminResendAccessLink: { ok: true };
  adminRetentionCleanupAudits: {
    id: number;
    dryRun: boolean;
    freeRetentionDays: number;
    paidRetentionDays: number;
    scannedMessages: number;
    deletedMessages: number;
    detailsJson: unknown;
    createdBy: number | null;
    createdAt: Date;
  }[];
  adminRetentionPolicies: {
    id: number;
    tier: "free" | "paid";
    retentionDays: number;
    enabled: boolean;
    updatedBy: number | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  adminRunRetentionCleanup: RetentionCleanupResult;
  adminTriageRiskEvents: {
    knowledgeTrace: Record<string, never> | null;
    id: number;
    sessionId: number;
    messageId: number | null;
    riskCode: string;
    severity: string;
    recommendedAction: string;
    triggerSource: string;
    rawExcerpt: string | null;
    createdAt: Date;
  }[];
  adminTriageSessions: {
    id: number;
    userId: number | null;
    status: "active" | "completed";
    summary: string | null;
    summaryGeneratedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  adminUpdateAppointmentSchedule: {
    ok: true;
    appointmentId: number;
    scheduledAt: Date;
  };
  adminUpdateAppointmentStatus: { ok: true };
  adminUpdateUserRole: {
    id: number;
    email: string | null;
    name: string | null;
    role: UserRole;
    loginMethod: string | null;
    lastSignedIn: Date;
    createdAt: Date;
  };
  adminUploadHospitalImage: { hospitalId: number; imageUrl: string };
  adminUpsertRetentionPolicy: {
    id: number;
    tier: "free" | "paid";
    retentionDays: number;
    enabled: boolean;
    updatedBy: number | null;
    updatedAt: Date;
  };
  adminUsers: {
    id: number;
    email: string | null;
    name: string | null;
    role: UserRole;
    loginMethod: string | null;
    lastSignedIn: Date;
    createdAt: Date;
  }[];
  adminWebhookReplay:
    | {
        ok: false;
        skipped: true;
        action: "skipped-idempotent";
        eventId: string;
      }
    | { ok: true; skipped: false; action: string; eventId: string };
  health: { ok: boolean };
  metrics: { generatedAt: string; counters: { key: string; value: number }[] };
  notifyOwner: { success: boolean };
};
