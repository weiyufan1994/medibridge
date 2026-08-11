import { getBookingWorkspaceCopy } from "@/features/booking/copy";
import type {
  BookingRiskSummary,
  BookingWorkspaceCallbacks,
  BookingWorkspaceFilters,
  BookingWorkspaceLang,
  BookingWorkspaceOptions,
} from "@/features/booking/types";

export type BookingToolbarCopy = ReturnType<typeof getBookingWorkspaceCopy>;

export type BookingToolbarProps = {
  lang: BookingWorkspaceLang;
  filters: BookingWorkspaceFilters;
  options: BookingWorkspaceOptions;
  callbacks: BookingWorkspaceCallbacks;
  total: number;
  totalPages: number;
  selectedCount: number;
  riskSummary: BookingRiskSummary | null;
  batchIsPending: boolean;
  canBatchResendAccessLink: boolean;
  canBatchReinitiatePayment: boolean;
  canBatchUpdateStatus: boolean;
};
