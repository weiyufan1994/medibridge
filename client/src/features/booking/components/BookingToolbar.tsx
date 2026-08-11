import { useState } from "react";
import { BookingAdvancedFilters } from "@/features/booking/components/BookingAdvancedFilters";
import { BookingBatchStatusEditor } from "@/features/booking/components/BookingBatchStatusEditor";
import { BookingToolbarPrimaryFilters } from "@/features/booking/components/BookingToolbarPrimaryFilters";
import { BookingToolbarSummary } from "@/features/booking/components/BookingToolbarSummary";
import { getBookingWorkspaceCopy } from "@/features/booking/copy";
import {
  getBookingBatchHint,
  getBookingPageSizeOptions,
  getBookingRiskCount,
} from "@/features/booking/bookingToolbarPresentation";
import type { BookingToolbarProps } from "@/features/booking/bookingToolbarTypes";

export function BookingToolbar({
  lang,
  filters,
  options,
  callbacks,
  total,
  totalPages,
  selectedCount,
  riskSummary,
  batchIsPending,
  canBatchResendAccessLink,
  canBatchReinitiatePayment,
  canBatchUpdateStatus,
}: BookingToolbarProps) {
  const copy = getBookingWorkspaceCopy(lang);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showBatchStatusEditor, setShowBatchStatusEditor] = useState(false);
  const pageSizeOptions = getBookingPageSizeOptions(
    options.pageSizeOptions,
    filters.pageSize
  );
  const batchHint = getBookingBatchHint({
    selectedCount,
    canBatchResendAccessLink,
    canBatchReinitiatePayment,
    canBatchUpdateStatus,
    copy: copy.toolbar,
  });

  return (
    <section className="rounded-xl border border-admin-border bg-admin-surface px-4 py-3">
      <BookingToolbarSummary
        callbacks={callbacks}
        copy={copy}
        filters={filters}
        riskCount={getBookingRiskCount(riskSummary)}
        selectedCount={selectedCount}
        total={total}
        totalPages={totalPages}
      />
      <BookingToolbarPrimaryFilters
        batchHint={batchHint}
        batchIsPending={batchIsPending}
        callbacks={callbacks}
        canBatchReinitiatePayment={canBatchReinitiatePayment}
        canBatchResendAccessLink={canBatchResendAccessLink}
        canBatchUpdateStatus={canBatchUpdateStatus}
        copy={copy.toolbar}
        filters={filters}
        onShowBatchStatusEditor={() => setShowBatchStatusEditor(true)}
        onToggleAdvancedFilters={() =>
          setShowAdvancedFilters(current => !current)
        }
        options={options}
        selectedCount={selectedCount}
        showAdvancedFilters={showAdvancedFilters}
      />
      <BookingBatchStatusEditor
        batchIsPending={batchIsPending}
        callbacks={callbacks}
        canBatchUpdateStatus={canBatchUpdateStatus}
        copy={copy.toolbar}
        onClose={() => setShowBatchStatusEditor(false)}
        options={options}
        selectedCount={selectedCount}
        visible={showBatchStatusEditor}
      />
      <BookingAdvancedFilters
        callbacks={callbacks}
        copy={copy.toolbar}
        filters={filters}
        options={options}
        pageSizeOptions={pageSizeOptions}
        visible={showAdvancedFilters}
      />
    </section>
  );
}
