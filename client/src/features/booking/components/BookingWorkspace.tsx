import { BookingDetailPanel } from "@/features/booking/components/BookingDetailPanel";
import { BookingList } from "@/features/booking/components/BookingList";
import { BookingToolbar } from "@/features/booking/components/BookingToolbar";
import type { BookingWorkspaceProps } from "@/features/booking/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getBookingWorkspaceCopy } from "@/features/booking/copy";

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
  const copy = getBookingWorkspaceCopy(lang);

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

      <div className="min-h-0 flex-1">
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
      </div>

      <Sheet
        open={activeAppointmentId !== null}
        onOpenChange={open => {
          if (!open) {
            callbacks.onCloseDetail();
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-admin-border bg-admin-surface p-0 sm:max-w-[760px] xl:max-w-[880px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>
              {copy.detail.title}
              {detailMeta.id ? ` #${detailMeta.id}` : ""}
            </SheetTitle>
            <SheetDescription>{copy.detail.empty}</SheetDescription>
          </SheetHeader>
          <BookingDetailPanel
            lang={lang}
            locale={locale}
            detailMeta={detailMeta}
            isLoading={isDetailLoading}
            errorMessage={detailErrorMessage}
            detailContent={detailContent}
            stickyActions={stickyActions}
            embedded
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
