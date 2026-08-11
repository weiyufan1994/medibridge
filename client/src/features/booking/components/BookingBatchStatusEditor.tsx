import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookingFieldShell } from "@/features/booking/components/BookingToolbarParts";
import type { BookingToolbarCopy } from "@/features/booking/bookingToolbarTypes";
import type {
  BookingWorkspaceCallbacks,
  BookingWorkspaceOptions,
} from "@/features/booking/types";

type Props = {
  batchIsPending: boolean;
  callbacks: BookingWorkspaceCallbacks;
  canBatchUpdateStatus: boolean;
  copy: BookingToolbarCopy["toolbar"];
  onClose: () => void;
  options: BookingWorkspaceOptions;
  selectedCount: number;
  visible: boolean;
};

export function BookingBatchStatusEditor({
  batchIsPending,
  callbacks,
  canBatchUpdateStatus,
  copy,
  onClose,
  options,
  selectedCount,
  visible,
}: Props) {
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

  if (!visible || selectedCount <= 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-admin-border bg-admin-surface-muted px-3 py-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto_auto]">
        <BookingFieldShell label={copy.targetStatus}>
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
        </BookingFieldShell>

        <BookingFieldShell label={copy.targetPayment}>
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
        </BookingFieldShell>

        <BookingFieldShell label={copy.reason}>
          <Input
            className="h-9"
            value={batchReason}
            onChange={event => setBatchReason(event.target.value)}
            placeholder={copy.reason}
          />
        </BookingFieldShell>

        <div className="flex items-end">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              callbacks.onBatchAction({
                action: "update_status",
                toStatus: batchStatus,
                toPaymentStatus: batchPaymentStatus,
                reason: batchReason,
              });
              onClose();
            }}
            disabled={
              selectedCount <= 0 || !canBatchUpdateStatus || batchIsPending
            }
          >
            {copy.apply}
          </Button>
        </div>

        <div className="flex items-end">
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            {copy.cancel}
          </Button>
        </div>
      </div>
    </div>
  );
}
