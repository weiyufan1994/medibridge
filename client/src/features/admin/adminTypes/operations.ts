import type { SimpleMutation } from "@/features/admin/adminTypes/common";

export type UpdateRetentionPolicyMutation = SimpleMutation;

export type RunRetentionCleanupMutation = SimpleMutation & {
  mutate: (input: { dryRun: boolean }) => void;
  mutateAsync: (input: { dryRun: boolean }) => Promise<unknown>;
};

export type AdminTriageSessionItem = {
  id: number;
  userId: number | null;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type AdminTriageRiskEventItem = {
  id: number;
  sessionId: number;
  messageId: number | null;
  riskCode: string;
  severity: string;
  recommendedAction: string;
  triggerSource: string;
  rawExcerpt: string | null;
  createdAt: Date | string;
  knowledgeTrace: {
    mode?: string;
    queryTerms?: string[];
    documentTitles?: string[];
  } | null;
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

export type AdminExportScope =
  | "appointments"
  | "risk_summary"
  | "retention_audits"
  | "webhook_timeline"
  | "operation_audit";
