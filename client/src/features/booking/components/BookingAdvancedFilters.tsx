import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { BookingFieldShell } from "@/features/booking/components/BookingToolbarParts";
import type { BookingToolbarCopy } from "@/features/booking/bookingToolbarTypes";
import type {
  BookingSortField,
  BookingWorkspaceCallbacks,
  BookingWorkspaceFilters,
  BookingWorkspaceOptions,
} from "@/features/booking/types";

type Props = {
  callbacks: BookingWorkspaceCallbacks;
  copy: BookingToolbarCopy["toolbar"];
  filters: BookingWorkspaceFilters;
  options: BookingWorkspaceOptions;
  pageSizeOptions: number[];
  visible: boolean;
};

export function BookingAdvancedFilters({
  callbacks,
  copy,
  filters,
  options,
  pageSizeOptions,
  visible,
}: Props) {
  if (!visible) return null;

  return (
    <div className="mt-3 grid gap-2 rounded-xl border border-admin-border bg-admin-surface-muted px-3 py-3 md:grid-cols-2 xl:grid-cols-5">
      <BookingFieldShell label={copy.appointmentId}>
        <div className="flex items-center gap-2">
          <Input
            className="h-9"
            value={filters.appointmentIdInput}
            onChange={event =>
              callbacks.onAppointmentIdInputChange(event.target.value)
            }
            placeholder={copy.appointmentIdPlaceholder}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={callbacks.onOpenAppointmentById}
          >
            {copy.open}
          </Button>
        </div>
      </BookingFieldShell>

      <BookingFieldShell label={copy.paymentStatus}>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={filters.paymentStatusFilter}
          onChange={event =>
            callbacks.onPaymentStatusFilterChange(event.target.value)
          }
        >
          <option value="">{copy.all}</option>
          {options.paymentStatusOptions
            .filter(option => option)
            .map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
        </select>
      </BookingFieldShell>

      <BookingFieldShell label={copy.doctorId}>
        <Input
          className="h-9"
          value={filters.doctorIdInput}
          onChange={event =>
            callbacks.onDoctorIdInputChange(event.target.value)
          }
          placeholder={copy.appointmentIdPlaceholder}
        />
      </BookingFieldShell>

      <BookingFieldShell label={copy.amountRange}>
        <div className="flex items-center gap-2">
          <Input
            className="h-9"
            value={filters.amountMinInput}
            onChange={event => callbacks.onAmountMinChange(event.target.value)}
            inputMode="numeric"
            placeholder={copy.minPlaceholder}
          />
          <Input
            className="h-9"
            value={filters.amountMaxInput}
            onChange={event => callbacks.onAmountMaxChange(event.target.value)}
            inputMode="numeric"
            placeholder={copy.maxPlaceholder}
          />
        </div>
      </BookingFieldShell>

      <BookingFieldShell label={copy.pageSize}>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={String(filters.pageSize)}
          onChange={event =>
            callbacks.onPageSizeChange(Number(event.target.value))
          }
        >
          {pageSizeOptions.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </BookingFieldShell>

      <BookingFieldShell label={copy.createdFrom}>
        <Input
          className="h-9"
          type="datetime-local"
          value={filters.createdAtFrom}
          onChange={event =>
            callbacks.onCreatedAtFromChange(event.target.value)
          }
        />
      </BookingFieldShell>

      <BookingFieldShell label={copy.createdTo}>
        <Input
          className="h-9"
          type="datetime-local"
          value={filters.createdAtTo}
          onChange={event => callbacks.onCreatedAtToChange(event.target.value)}
        />
      </BookingFieldShell>

      <BookingFieldShell label={copy.sortBy}>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={filters.sortBy}
          onChange={event =>
            callbacks.onSortByChange(event.target.value as BookingSortField)
          }
        >
          <option value="createdAt">{copy.sortLabels.createdAt}</option>
          <option value="scheduledAt">{copy.sortLabels.scheduledAt}</option>
          <option value="amount">{copy.sortLabels.amount}</option>
          <option value="status">{copy.sortLabels.status}</option>
          <option value="paymentStatus">{copy.sortLabels.paymentStatus}</option>
          <option value="id">{copy.sortLabels.id}</option>
        </select>
      </BookingFieldShell>

      <BookingFieldShell label={copy.sortDirection}>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={filters.sortDirection}
          onChange={event =>
            callbacks.onSortDirectionChange(
              event.target.value as "asc" | "desc"
            )
          }
        >
          <option value="desc">{copy.desc}</option>
          <option value="asc">{copy.asc}</option>
        </select>
      </BookingFieldShell>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {copy.riskOnly}
        </span>
        <span className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
          <Checkbox
            checked={filters.hasRiskFilter}
            onCheckedChange={checked =>
              callbacks.onHasRiskFilterChange(checked === true)
            }
          />
          {copy.riskOnly}
        </span>
      </label>
    </div>
  );
}
