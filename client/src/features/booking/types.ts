import type { ReactNode } from "react";

export type BookingWorkspaceLang = "zh" | "en";

export type BookingSortField =
  | "createdAt"
  | "scheduledAt"
  | "amount"
  | "status"
  | "paymentStatus"
  | "id";

export type BookingSortDirection = "asc" | "desc";

export type BookingBatchActionInput = {
  action: "resend_access_link" | "reinitiate_payment" | "update_status";
  toStatus?: string;
  toPaymentStatus?: string;
  reason?: string;
};

export type BookingBatchResult = {
  appointmentId: number;
  status: "success" | "skipped" | "failed";
  reason?: string;
};

export type BookingWorklistItem = {
  id: number;
  userId: number | null;
  email: string;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  doctorId: number | null;
  triageSessionId: number | null;
  scheduledAt: Date | string | null;
  createdAt: Date | string;
  riskFlag: boolean;
  riskCodes: string[];
};

export type BookingRiskSummary = {
  total: number;
  pendingPaymentTimeout: number;
  webhookFailure: number;
  tokenExpiringSoon: number;
  tokenUsageExhausted: number;
};

export type BookingDetailMeta = {
  id: number | null;
  email: string | null;
  status: string | null;
  paymentStatus: string | null;
  amount: number | null;
  currency: string | null;
  scheduledAt: Date | string | null;
  riskFlag: boolean;
};

export type BookingStickyActionKind =
  | "generate_summary_en"
  | "resend_link"
  | "reinitiate_payment";

export type BookingStickyAction = {
  kind: BookingStickyActionKind;
  disabled?: boolean;
  onClick: () => void;
  pending?: boolean;
  title?: string;
};

export type BookingWorkspaceFilters = {
  emailQuery: string;
  appointmentIdInput: string;
  statusFilter: string;
  paymentStatusFilter: string;
  doctorIdInput: string;
  amountMinInput: string;
  amountMaxInput: string;
  createdAtFrom: string;
  createdAtTo: string;
  scheduledAtFrom: string;
  scheduledAtTo: string;
  hasRiskFilter: boolean;
  sortBy: BookingSortField;
  sortDirection: BookingSortDirection;
  pageSize: number;
  page: number;
};

export type BookingWorkspaceOptions = {
  appointmentStatusOptions: readonly string[];
  paymentStatusOptions: readonly string[];
  pageSizeOptions?: readonly number[];
};

export type BookingWorkspaceCallbacks = {
  onEmailQueryChange: (value: string) => void;
  onAppointmentIdInputChange: (value: string) => void;
  onOpenAppointmentById: () => void;
  onStatusFilterChange: (value: string) => void;
  onPaymentStatusFilterChange: (value: string) => void;
  onDoctorIdInputChange: (value: string) => void;
  onAmountMinChange: (value: string) => void;
  onAmountMaxChange: (value: string) => void;
  onCreatedAtFromChange: (value: string) => void;
  onCreatedAtToChange: (value: string) => void;
  onScheduledAtFromChange: (value: string) => void;
  onScheduledAtToChange: (value: string) => void;
  onHasRiskFilterChange: (value: boolean) => void;
  onSortByChange: (value: BookingSortField) => void;
  onSortDirectionChange: (value: BookingSortDirection) => void;
  onPageSizeChange: (value: number) => void;
  onPageChange: (value: number) => void;
  onResetFilters: () => void;
  onRefresh: () => void;
  onSelectAppointment: (id: number) => void;
  onToggleSelection: (id: number, checked: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  onClearSelection: () => void;
  onBatchAction: (input: BookingBatchActionInput) => void;
};

export type BookingWorkspaceProps = {
  lang: BookingWorkspaceLang;
  locale: string;
  filters: BookingWorkspaceFilters;
  options: BookingWorkspaceOptions;
  callbacks: BookingWorkspaceCallbacks;
  items: BookingWorklistItem[];
  activeAppointmentId: number | null;
  selectedAppointmentIds: number[];
  isAllVisibleSelected: boolean;
  isAnyVisibleSelected: boolean;
  isListLoading: boolean;
  listErrorMessage?: string;
  total: number;
  totalPages: number;
  riskSummary: BookingRiskSummary | null;
  batchIsPending: boolean;
  batchResult?: BookingBatchResult[] | null;
  canBatchResendAccessLink: boolean;
  canBatchReinitiatePayment: boolean;
  canBatchUpdateStatus: boolean;
  detailMeta: BookingDetailMeta;
  isDetailLoading: boolean;
  detailErrorMessage?: string;
  detailContent?: ReactNode;
  stickyActions: BookingStickyAction[];
};
