import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingMetricChip } from "@/features/booking/components/BookingToolbarParts";
import type { BookingToolbarCopy } from "@/features/booking/bookingToolbarTypes";
import type {
  BookingWorkspaceCallbacks,
  BookingWorkspaceFilters,
} from "@/features/booking/types";

type Props = {
  callbacks: BookingWorkspaceCallbacks;
  copy: BookingToolbarCopy;
  filters: BookingWorkspaceFilters;
  riskCount: number;
  selectedCount: number;
  total: number;
  totalPages: number;
};

export function BookingToolbarSummary({
  callbacks,
  copy,
  filters,
  riskCount,
  selectedCount,
  total,
  totalPages,
}: Props) {
  const activeFilters = [
    filters.emailQuery
      ? {
          key: "email",
          label: copy.toolbar.email,
          value: filters.emailQuery,
          onRemove: () => callbacks.onEmailQueryChange(""),
        }
      : null,
    filters.statusFilter
      ? {
          key: "status",
          label: copy.toolbar.status,
          value: filters.statusFilter,
          onRemove: () => callbacks.onStatusFilterChange(""),
        }
      : null,
    filters.paymentStatusFilter
      ? {
          key: "payment",
          label: copy.toolbar.paymentStatus,
          value: filters.paymentStatusFilter,
          onRemove: () => callbacks.onPaymentStatusFilterChange(""),
        }
      : null,
    filters.scheduledAtFrom
      ? {
          key: "scheduled-from",
          label: copy.toolbar.scheduledFrom,
          value: filters.scheduledAtFrom,
          onRemove: () => callbacks.onScheduledAtFromChange(""),
        }
      : null,
    filters.scheduledAtTo
      ? {
          key: "scheduled-to",
          label: copy.toolbar.scheduledTo,
          value: filters.scheduledAtTo,
          onRemove: () => callbacks.onScheduledAtToChange(""),
        }
      : null,
    filters.doctorIdInput
      ? {
          key: "doctor",
          label: copy.toolbar.doctorId,
          value: filters.doctorIdInput,
          onRemove: () => callbacks.onDoctorIdInputChange(""),
        }
      : null,
    filters.hasRiskFilter
      ? {
          key: "risk",
          label: copy.toolbar.riskOnly,
          value: copy.toolbar.riskOnly,
          onRemove: () => callbacks.onHasRiskFilterChange(false),
        }
      : null,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== null);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <BookingMetricChip
            label={copy.stats.total}
            value={Intl.NumberFormat().format(total)}
          />
          {selectedCount > 0 ? (
            <BookingMetricChip
              label={copy.stats.selected}
              value={Intl.NumberFormat().format(selectedCount)}
            />
          ) : null}
          <BookingMetricChip
            label={copy.stats.risk}
            value={Intl.NumberFormat().format(riskCount)}
            tone={riskCount > 0 ? "danger" : "neutral"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-admin-border px-2.5 py-1 text-xs text-muted-foreground">
            <span>{copy.toolbar.page}</span>
            <span className="font-medium text-foreground">
              {filters.page} / {Math.max(1, totalPages)}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              callbacks.onPageChange(Math.max(1, filters.page - 1))
            }
            disabled={filters.page <= 1}
          >
            {copy.toolbar.prev}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              callbacks.onPageChange(Math.min(totalPages, filters.page + 1))
            }
            disabled={filters.page >= totalPages}
          >
            {copy.toolbar.next}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={callbacks.onRefresh}
          >
            <RefreshCw className="size-4" />
            {copy.toolbar.refresh}
          </Button>
        </div>
      </div>

      {activeFilters.length > 0 ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          aria-label={copy.toolbar.moreFilters}
        >
          {activeFilters.map(filter => (
            <span
              key={filter.key}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-admin-border bg-admin-surface-muted px-2 py-1 text-xs text-admin-muted-foreground"
            >
              <span className="font-medium text-admin-foreground">
                {filter.label}:
              </span>
              <span className="max-w-44 truncate">{filter.value}</span>
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${copy.toolbar.reset}: ${filter.label}`}
                onClick={filter.onRemove}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}
