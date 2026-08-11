import { ChevronDown, Filter, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { BookingFieldShell } from "@/features/booking/components/BookingToolbarParts";
import type { BookingToolbarCopy } from "@/features/booking/bookingToolbarTypes";
import type {
  BookingWorkspaceCallbacks,
  BookingWorkspaceFilters,
  BookingWorkspaceOptions,
} from "@/features/booking/types";

type Props = {
  batchHint: string;
  batchIsPending: boolean;
  callbacks: BookingWorkspaceCallbacks;
  canBatchReinitiatePayment: boolean;
  canBatchResendAccessLink: boolean;
  canBatchUpdateStatus: boolean;
  copy: BookingToolbarCopy["toolbar"];
  filters: BookingWorkspaceFilters;
  onShowBatchStatusEditor: () => void;
  onToggleAdvancedFilters: () => void;
  options: BookingWorkspaceOptions;
  selectedCount: number;
  showAdvancedFilters: boolean;
};

export function BookingToolbarPrimaryFilters({
  batchHint,
  batchIsPending,
  callbacks,
  canBatchReinitiatePayment,
  canBatchResendAccessLink,
  canBatchUpdateStatus,
  copy,
  filters,
  onShowBatchStatusEditor,
  onToggleAdvancedFilters,
  options,
  selectedCount,
  showAdvancedFilters,
}: Props) {
  const canRunSelectionAction = selectedCount > 0;

  return (
    <>
      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_180px_190px_190px_auto]">
        <BookingFieldShell label={copy.email}>
          <Input
            className="h-9"
            value={filters.emailQuery}
            onChange={event => callbacks.onEmailQueryChange(event.target.value)}
            placeholder={copy.emailPlaceholder}
          />
        </BookingFieldShell>

        <BookingFieldShell label={copy.status}>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={filters.statusFilter}
            onChange={event =>
              callbacks.onStatusFilterChange(event.target.value)
            }
          >
            <option value="">{copy.all}</option>
            {options.appointmentStatusOptions
              .filter(option => option)
              .map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </select>
        </BookingFieldShell>

        <BookingFieldShell label={copy.scheduledFrom}>
          <Input
            className="h-9"
            type="datetime-local"
            value={filters.scheduledAtFrom}
            onChange={event =>
              callbacks.onScheduledAtFromChange(event.target.value)
            }
          />
        </BookingFieldShell>

        <BookingFieldShell label={copy.scheduledTo}>
          <Input
            className="h-9"
            type="datetime-local"
            value={filters.scheduledAtTo}
            onChange={event =>
              callbacks.onScheduledAtToChange(event.target.value)
            }
          />
        </BookingFieldShell>

        <div className="flex flex-wrap items-end gap-2">
          {selectedCount > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-w-[148px]"
                >
                  <SlidersHorizontal className="size-4" />
                  {copy.batchActions}
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>{copy.batchActions}</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={
                    !canRunSelectionAction ||
                    !canBatchResendAccessLink ||
                    batchIsPending
                  }
                  onSelect={event => {
                    event.preventDefault();
                    callbacks.onBatchAction({ action: "resend_access_link" });
                  }}
                >
                  {copy.resendLinks}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={
                    !canRunSelectionAction ||
                    !canBatchReinitiatePayment ||
                    batchIsPending
                  }
                  onSelect={event => {
                    event.preventDefault();
                    callbacks.onBatchAction({ action: "reinitiate_payment" });
                  }}
                >
                  {copy.reinitiatePayment}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={
                    !canRunSelectionAction ||
                    !canBatchUpdateStatus ||
                    batchIsPending
                  }
                  onSelect={event => {
                    event.preventDefault();
                    onShowBatchStatusEditor();
                  }}
                >
                  {copy.bulkStatus}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onToggleAdvancedFilters}
          >
            <Filter className="size-4" />
            {showAdvancedFilters ? copy.lessFilters : copy.moreFilters}
          </Button>

          {selectedCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={callbacks.onClearSelection}
            >
              {copy.clearSelection}
            </Button>
          ) : null}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={callbacks.onResetFilters}
          >
            {copy.reset}
          </Button>
        </div>
      </div>

      {batchHint ? (
        <p className="mt-2 text-xs text-muted-foreground">{batchHint}</p>
      ) : null}
    </>
  );
}
