import { AlertTriangle, ShieldAlert } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { getBookingWorkspaceCopy } from "@/features/booking/copy";
import {
  formatBookingAmount,
  formatBookingDate,
  getBatchResultTone,
  getBookingEmailSummary,
  getBookingRiskAccent,
  getBookingStatusDotClass,
} from "@/features/booking/presentation";
import type {
  BookingBatchResult,
  BookingWorklistItem,
  BookingWorkspaceLang,
} from "@/features/booking/types";
import { cn } from "@/lib/utils";

type BookingListProps = {
  lang: BookingWorkspaceLang;
  locale: string;
  items: BookingWorklistItem[];
  activeAppointmentId: number | null;
  selectedAppointmentIds: number[];
  isAllVisibleSelected: boolean;
  isAnyVisibleSelected: boolean;
  isLoading: boolean;
  errorMessage?: string;
  total: number;
  onSelectAppointment: (id: number) => void;
  onToggleSelection: (id: number, checked: boolean) => void;
  onToggleAllVisible: (checked: boolean) => void;
  batchResult?: BookingBatchResult[] | null;
};

export function BookingList({
  lang,
  locale,
  items,
  activeAppointmentId,
  selectedAppointmentIds,
  isAllVisibleSelected,
  isAnyVisibleSelected,
  isLoading,
  errorMessage,
  total,
  onSelectAppointment,
  onToggleSelection,
  onToggleAllVisible,
  batchResult,
}: BookingListProps) {
  const copy = getBookingWorkspaceCopy(lang);
  const selectedIdSet = new Set(selectedAppointmentIds);

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-admin-border bg-admin-surface">
      <div className="flex items-center justify-between gap-3 border-b border-admin-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-admin-foreground">
            {copy.list.title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {copy.list.selectedCount}: {selectedAppointmentIds.length} /{" "}
            {items.length}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={
              isAllVisibleSelected
                ? true
                : isAnyVisibleSelected
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={checked => onToggleAllVisible(checked === true)}
            aria-label={copy.list.selectedCount}
          />
          <span>{total}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
            {copy.list.loading}
          </div>
        ) : errorMessage ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
            {copy.list.empty}
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="divide-y divide-admin-border">
              {items.map(item => {
                const isActive = activeAppointmentId === item.id;
                const isChecked = selectedIdSet.has(item.id);
                const riskAccent = getBookingRiskAccent(item);

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2 text-sm leading-tight transition-colors",
                      isActive
                        ? "bg-admin-accent"
                        : "hover:bg-admin-surface-muted"
                    )}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={checked =>
                        onToggleSelection(item.id, checked === true)
                      }
                      aria-label={`${item.email}-${item.id}`}
                    />

                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() => onSelectAppointment(item.id)}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          getBookingStatusDotClass(item.status)
                        )}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-admin-foreground">
                            {getBookingEmailSummary(item.email)}
                          </span>
                          {riskAccent ? (
                            <AlertTriangle
                              className={cn(
                                "size-3.5 shrink-0",
                                riskAccent.iconClassName
                              )}
                            />
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="truncate">
                            {copy.list.scheduled}{" "}
                            {formatBookingDate(item.scheduledAt, locale)}
                          </span>
                          <span className="truncate">{item.status}</span>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-admin-foreground">
                          {formatBookingAmount(
                            item.amount,
                            item.currency,
                            locale
                          )}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {copy.list.created}{" "}
                          {formatBookingDate(item.createdAt, locale)}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {batchResult && batchResult.length > 0 ? (
        <div className="border-t border-admin-border px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-foreground">
            <ShieldAlert className="size-3.5" />
            {copy.list.latestBatchResult}
          </div>
          <div className="mt-2 space-y-1 text-xs">
            {batchResult.slice(0, 4).map(result => (
              <p
                key={`${result.appointmentId}-${result.status}`}
                className={getBatchResultTone(result.status)}
              >
                #{result.appointmentId} · {result.status}
                {result.reason ? ` · ${result.reason}` : ""}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
