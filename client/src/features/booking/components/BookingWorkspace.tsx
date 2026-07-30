import { BookingDetailPanel } from "@/features/booking/components/BookingDetailPanel";
import { BookingList } from "@/features/booking/components/BookingList";
import { BookingToolbar } from "@/features/booking/components/BookingToolbar";
import type { BookingWorkspaceProps } from "@/features/booking/types";

export function BookingWorkspace({
  lang,
  locale,
  filters,
  options,
  callbacks,
  items,
  activeAppointmentId,
  selectedAppointmentIds,
  isAllVisibleSelected,
  isAnyVisibleSelected,
  isListLoading,
  listErrorMessage,
  total,
  totalPages,
  riskSummary,
  batchIsPending,
  batchResult,
  canBatchResendAccessLink,
  canBatchReinitiatePayment,
  canBatchUpdateStatus,
  detailMeta,
  isDetailLoading,
  detailErrorMessage,
  detailContent,
  stickyActions,
}: BookingWorkspaceProps) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <BookingToolbar
        lang={lang}
        filters={filters}
        options={options}
        callbacks={callbacks}
        total={total}
        totalPages={totalPages}
        selectedCount={selectedAppointmentIds.length}
        riskSummary={riskSummary}
        batchIsPending={batchIsPending}
        canBatchResendAccessLink={canBatchResendAccessLink}
        canBatchReinitiatePayment={canBatchReinitiatePayment}
        canBatchUpdateStatus={canBatchUpdateStatus}
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(340px,0.95fr)_minmax(0,1.65fr)]">
        <BookingList
          lang={lang}
          locale={locale}
          items={items}
          activeAppointmentId={activeAppointmentId}
          selectedAppointmentIds={selectedAppointmentIds}
          isAllVisibleSelected={isAllVisibleSelected}
          isAnyVisibleSelected={isAnyVisibleSelected}
          isLoading={isListLoading}
          errorMessage={listErrorMessage}
          total={total}
          onSelectAppointment={callbacks.onSelectAppointment}
          onToggleSelection={callbacks.onToggleSelection}
          onToggleAllVisible={callbacks.onToggleAllVisible}
          batchResult={batchResult}
        />

        <BookingDetailPanel
          lang={lang}
          locale={locale}
          detailMeta={detailMeta}
          isLoading={isDetailLoading}
          errorMessage={detailErrorMessage}
          detailContent={detailContent}
          stickyActions={stickyActions}
        />
      </div>
    </div>
  );
}
