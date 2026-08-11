import type {
  BookingRiskSummary,
  BookingWorkspaceFilters,
} from "@/features/booking/types";
import type { BookingToolbarCopy } from "@/features/booking/bookingToolbarTypes";

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export function getBookingRiskCount(summary: BookingRiskSummary | null) {
  return summary
    ? summary.pendingPaymentTimeout +
        summary.webhookFailure +
        summary.tokenExpiringSoon +
        summary.tokenUsageExhausted
    : 0;
}

export function getBookingPageSizeOptions(
  configuredOptions: readonly number[] | undefined,
  currentPageSize: BookingWorkspaceFilters["pageSize"]
) {
  return Array.from(
    new Set([
      ...(configuredOptions ?? DEFAULT_PAGE_SIZE_OPTIONS),
      currentPageSize,
    ])
  ).sort((left, right) => left - right);
}

type BookingBatchHintInput = {
  selectedCount: number;
  canBatchResendAccessLink: boolean;
  canBatchReinitiatePayment: boolean;
  canBatchUpdateStatus: boolean;
  copy: BookingToolbarCopy["toolbar"];
};

export function getBookingBatchHint({
  selectedCount,
  canBatchResendAccessLink,
  canBatchReinitiatePayment,
  canBatchUpdateStatus,
  copy,
}: BookingBatchHintInput) {
  if (selectedCount <= 0) return "";
  if (
    canBatchResendAccessLink &&
    canBatchReinitiatePayment &&
    canBatchUpdateStatus
  ) {
    return "";
  }

  return [
    !canBatchResendAccessLink ? copy.linkPermissionHint : null,
    !canBatchReinitiatePayment ? copy.paymentPermissionHint : null,
    !canBatchUpdateStatus ? copy.statusPermissionHint : null,
  ]
    .filter(Boolean)
    .join(" ");
}
