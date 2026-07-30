import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Filter,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getBookingWorkspaceCopy } from "@/features/booking/copy";
import type {
  BookingBatchActionInput,
  BookingSortField,
  BookingWorkspaceCallbacks,
  BookingWorkspaceFilters,
  BookingWorkspaceLang,
  BookingWorkspaceOptions,
  BookingRiskSummary,
} from "@/features/booking/types";

type BookingToolbarProps = {
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

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

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
  const defaultStatus =
    options.appointmentStatusOptions.find(Boolean) ?? "active";
  const defaultPaymentStatus =
    options.paymentStatusOptions.find(Boolean) ?? "paid";
  const [batchStatus, setBatchStatus] = useState(defaultStatus);
  const [batchPaymentStatus, setBatchPaymentStatus] =
    useState(defaultPaymentStatus);
  const [batchReason, setBatchReason] = useState("admin_batch_status_update");

  useEffect(() => {
    if (!options.appointmentStatusOptions.includes(batchStatus)) {
      setBatchStatus(defaultStatus);
    }
  }, [batchStatus, defaultStatus, options.appointmentStatusOptions]);

  useEffect(() => {
    if (!options.paymentStatusOptions.includes(batchPaymentStatus)) {
      setBatchPaymentStatus(defaultPaymentStatus);
    }
  }, [batchPaymentStatus, defaultPaymentStatus, options.paymentStatusOptions]);

  const pageSizeOptions = Array.from(
    new Set([
      ...(options.pageSizeOptions ?? DEFAULT_PAGE_SIZE_OPTIONS),
      filters.pageSize,
    ])
  ).sort((left, right) => left - right);
  const riskCount = riskSummary?.total ?? 0;
  const canRunSelectionAction = selectedCount > 0;

  const batchHint = useMemo(() => {
    if (!canRunSelectionAction) {
      return copy.toolbar.noSelection;
    }
    if (
      !canBatchResendAccessLink ||
      !canBatchReinitiatePayment ||
      !canBatchUpdateStatus
    ) {
      return [
        !canBatchResendAccessLink ? copy.toolbar.linkPermissionHint : null,
        !canBatchReinitiatePayment ? copy.toolbar.paymentPermissionHint : null,
        !canBatchUpdateStatus ? copy.toolbar.statusPermissionHint : null,
      ]
        .filter(Boolean)
        .join(" ");
    }
    return "";
  }, [
    canBatchReinitiatePayment,
    canBatchResendAccessLink,
    canBatchUpdateStatus,
    canRunSelectionAction,
    copy.toolbar.linkPermissionHint,
    copy.toolbar.noSelection,
    copy.toolbar.paymentPermissionHint,
    copy.toolbar.statusPermissionHint,
  ]);

  const submitBatchAction = (input: BookingBatchActionInput) => {
    callbacks.onBatchAction(input);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MetricChip
            label={copy.stats.total}
            value={Intl.NumberFormat().format(total)}
          />
          <MetricChip
            label={copy.stats.selected}
            value={Intl.NumberFormat().format(selectedCount)}
          />
          <MetricChip
            label={copy.stats.risk}
            value={Intl.NumberFormat().format(riskCount)}
            tone={riskCount > 0 ? "danger" : "neutral"}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-muted-foreground">
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

      <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1.2fr)_180px_190px_190px_auto]">
        <FieldShell label={copy.toolbar.email}>
          <Input
            className="h-9"
            value={filters.emailQuery}
            onChange={event => callbacks.onEmailQueryChange(event.target.value)}
            placeholder={copy.toolbar.emailPlaceholder}
          />
        </FieldShell>

        <FieldShell label={copy.toolbar.status}>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={filters.statusFilter}
            onChange={event =>
              callbacks.onStatusFilterChange(event.target.value)
            }
          >
            <option value="">{copy.toolbar.all}</option>
            {options.appointmentStatusOptions
              .filter(option => option)
              .map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
          </select>
        </FieldShell>

        <FieldShell label={copy.toolbar.scheduledFrom}>
          <Input
            className="h-9"
            type="datetime-local"
            value={filters.scheduledAtFrom}
            onChange={event =>
              callbacks.onScheduledAtFromChange(event.target.value)
            }
          />
        </FieldShell>

        <FieldShell label={copy.toolbar.scheduledTo}>
          <Input
            className="h-9"
            type="datetime-local"
            value={filters.scheduledAtTo}
            onChange={event =>
              callbacks.onScheduledAtToChange(event.target.value)
            }
          />
        </FieldShell>

        <div className="flex flex-wrap items-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-w-[148px]"
              >
                <SlidersHorizontal className="size-4" />
                {copy.toolbar.batchActions}
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>{copy.toolbar.batchActions}</DropdownMenuLabel>
              <DropdownMenuItem
                disabled={
                  !canRunSelectionAction ||
                  !canBatchResendAccessLink ||
                  batchIsPending
                }
                onSelect={event => {
                  event.preventDefault();
                  submitBatchAction({ action: "resend_access_link" });
                }}
              >
                {copy.toolbar.resendLinks}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={
                  !canRunSelectionAction ||
                  !canBatchReinitiatePayment ||
                  batchIsPending
                }
                onSelect={event => {
                  event.preventDefault();
                  submitBatchAction({ action: "reinitiate_payment" });
                }}
              >
                {copy.toolbar.reinitiatePayment}
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
                  setShowBatchStatusEditor(true);
                }}
              >
                {copy.toolbar.bulkStatus}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAdvancedFilters(current => !current)}
          >
            <Filter className="size-4" />
            {showAdvancedFilters
              ? copy.toolbar.lessFilters
              : copy.toolbar.moreFilters}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={callbacks.onClearSelection}
            disabled={selectedCount === 0}
          >
            {copy.toolbar.clearSelection}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={callbacks.onResetFilters}
          >
            {copy.toolbar.reset}
          </Button>
        </div>
      </div>

      {batchHint ? (
        <p className="mt-2 text-xs text-muted-foreground">{batchHint}</p>
      ) : null}

      {showBatchStatusEditor ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto_auto]">
            <FieldShell label={copy.toolbar.targetStatus}>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={batchStatus}
                onChange={event => setBatchStatus(event.target.value)}
              >
                {options.appointmentStatusOptions
                  .filter(option => option)
                  .map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </FieldShell>

            <FieldShell label={copy.toolbar.targetPayment}>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={batchPaymentStatus}
                onChange={event => setBatchPaymentStatus(event.target.value)}
              >
                {options.paymentStatusOptions
                  .filter(option => option)
                  .map(option => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </FieldShell>

            <FieldShell label={copy.toolbar.reason}>
              <Input
                className="h-9"
                value={batchReason}
                onChange={event => setBatchReason(event.target.value)}
                placeholder={copy.toolbar.reason}
              />
            </FieldShell>

            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  submitBatchAction({
                    action: "update_status",
                    toStatus: batchStatus,
                    toPaymentStatus: batchPaymentStatus,
                    reason: batchReason,
                  });
                  setShowBatchStatusEditor(false);
                }}
                disabled={
                  !canRunSelectionAction ||
                  !canBatchUpdateStatus ||
                  batchIsPending
                }
              >
                {copy.toolbar.apply}
              </Button>
            </div>

            <div className="flex items-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowBatchStatusEditor(false)}
              >
                {copy.toolbar.cancel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showAdvancedFilters ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 md:grid-cols-2 xl:grid-cols-5">
          <FieldShell label={copy.toolbar.appointmentId}>
            <div className="flex items-center gap-2">
              <Input
                className="h-9"
                value={filters.appointmentIdInput}
                onChange={event =>
                  callbacks.onAppointmentIdInputChange(event.target.value)
                }
                placeholder={copy.toolbar.appointmentIdPlaceholder}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={callbacks.onOpenAppointmentById}
              >
                {copy.toolbar.open}
              </Button>
            </div>
          </FieldShell>

          <FieldShell label={copy.toolbar.paymentStatus}>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.paymentStatusFilter}
              onChange={event =>
                callbacks.onPaymentStatusFilterChange(event.target.value)
              }
            >
              <option value="">{copy.toolbar.all}</option>
              {options.paymentStatusOptions
                .filter(option => option)
                .map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
            </select>
          </FieldShell>

          <FieldShell label={copy.toolbar.doctorId}>
            <Input
              className="h-9"
              value={filters.doctorIdInput}
              onChange={event =>
                callbacks.onDoctorIdInputChange(event.target.value)
              }
              placeholder={copy.toolbar.appointmentIdPlaceholder}
            />
          </FieldShell>

          <FieldShell label={copy.toolbar.amountRange}>
            <div className="flex items-center gap-2">
              <Input
                className="h-9"
                value={filters.amountMinInput}
                onChange={event =>
                  callbacks.onAmountMinChange(event.target.value)
                }
                inputMode="numeric"
                placeholder={copy.toolbar.minPlaceholder}
              />
              <Input
                className="h-9"
                value={filters.amountMaxInput}
                onChange={event =>
                  callbacks.onAmountMaxChange(event.target.value)
                }
                inputMode="numeric"
                placeholder={copy.toolbar.maxPlaceholder}
              />
            </div>
          </FieldShell>

          <FieldShell label={copy.toolbar.pageSize}>
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
          </FieldShell>

          <FieldShell label={copy.toolbar.createdFrom}>
            <Input
              className="h-9"
              type="datetime-local"
              value={filters.createdAtFrom}
              onChange={event =>
                callbacks.onCreatedAtFromChange(event.target.value)
              }
            />
          </FieldShell>

          <FieldShell label={copy.toolbar.createdTo}>
            <Input
              className="h-9"
              type="datetime-local"
              value={filters.createdAtTo}
              onChange={event =>
                callbacks.onCreatedAtToChange(event.target.value)
              }
            />
          </FieldShell>

          <FieldShell label={copy.toolbar.sortBy}>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.sortBy}
              onChange={event =>
                callbacks.onSortByChange(event.target.value as BookingSortField)
              }
            >
              <option value="createdAt">
                {copy.toolbar.sortLabels.createdAt}
              </option>
              <option value="scheduledAt">
                {copy.toolbar.sortLabels.scheduledAt}
              </option>
              <option value="amount">{copy.toolbar.sortLabels.amount}</option>
              <option value="status">{copy.toolbar.sortLabels.status}</option>
              <option value="paymentStatus">
                {copy.toolbar.sortLabels.paymentStatus}
              </option>
              <option value="id">{copy.toolbar.sortLabels.id}</option>
            </select>
          </FieldShell>

          <FieldShell label={copy.toolbar.sortDirection}>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={filters.sortDirection}
              onChange={event =>
                callbacks.onSortDirectionChange(
                  event.target.value as "asc" | "desc"
                )
              }
            >
              <option value="desc">{copy.toolbar.desc}</option>
              <option value="asc">{copy.toolbar.asc}</option>
            </select>
          </FieldShell>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {copy.toolbar.riskOnly}
            </span>
            <span className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
              <Checkbox
                checked={filters.hasRiskFilter}
                onCheckedChange={checked =>
                  callbacks.onHasRiskFilterChange(checked === true)
                }
              />
              {copy.toolbar.riskOnly}
            </span>
          </label>
        </div>
      ) : null}
    </section>
  );
}

function MetricChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs",
        tone === "danger"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-700"
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
