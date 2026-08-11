import type { LocalizedText } from "@shared/types";
import type {
  AppointmentIdInput,
  SimpleMutation,
} from "@/features/admin/adminTypes/common";

export type ReinitiatePaymentMutation = SimpleMutation & {
  mutate: (input: AppointmentIdInput) => void;
  mutateAsync: (input: AppointmentIdInput) => Promise<unknown>;
};

export type ResendAccessLinkMutation = SimpleMutation & {
  mutate: (input: AppointmentIdInput) => void;
  mutateAsync: (input: AppointmentIdInput) => Promise<unknown>;
};

export type IssueLinksMutation = SimpleMutation & {
  mutate: (input: AppointmentIdInput) => void;
  mutateAsync: (input: AppointmentIdInput) => Promise<unknown>;
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
    id: number;
    name: LocalizedText;
    hospitalName: LocalizedText;
    departmentName: LocalizedText;
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
  userId: number | null;
  email: string;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  doctorId: number;
  triageSessionId: number;
  scheduledAt: Date | string | null;
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

export type AdminBatchActionResult = {
  appointmentId: number;
  status: "success" | "skipped" | "failed";
  reason?: string;
};

export type AdminAppointmentStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "active"
  | "ended"
  | "completed"
  | "expired"
  | "refunded"
  | "canceled";

export type AdminPaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "canceled";

export type AdminAppointmentSortBy =
  | "createdAt"
  | "scheduledAt"
  | "amount"
  | "status"
  | "paymentStatus"
  | "id";
