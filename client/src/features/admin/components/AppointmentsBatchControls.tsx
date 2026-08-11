import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BatchAction = {
  action: "resend_access_link" | "reinitiate_payment" | "update_status";
  toStatus?: string;
  toPaymentStatus?: string;
  reason?: string;
};

type AppointmentsBatchControlsProps = {
  tr: (zh: string, en: string) => string;
  selectedCount: number;
  visibleItemCount: number;
  batchIsPending: boolean;
  canBatchResendAccessLink: boolean;
  canBatchReinitiatePayment: boolean;
  canBatchUpdateStatus: boolean;
  onRefresh: () => void;
  onClearSelection: () => void;
  onBatchAction: (action: BatchAction) => void;
};

export function AppointmentsBatchControls({
  tr,
  selectedCount,
  visibleItemCount,
  batchIsPending,
  canBatchResendAccessLink,
  canBatchReinitiatePayment,
  canBatchUpdateStatus,
  onRefresh,
  onClearSelection,
  onBatchAction,
}: AppointmentsBatchControlsProps) {
  const [toStatus, setToStatus] = useState("active");
  const [toPaymentStatus, setToPaymentStatus] = useState("paid");
  const [statusReason, setStatusReason] = useState("admin_batch_status_update");
  const selectedText = useMemo(
    () => `${tr("已选", "Selected")} ${selectedCount} / ${visibleItemCount}`,
    [selectedCount, tr, visibleItemCount]
  );
  const noSelection = selectedCount === 0;
  const batchResendDisabledReason = noSelection
    ? tr(
        "请先选择预约再执行批量重发。",
        "Select at least one appointment first."
      )
    : !canBatchResendAccessLink
      ? tr(
          "仅管理员与 ops 可重发访问链接。",
          "Only admin/ops can resend access links."
        )
      : "";
  const batchPaymentDisabledReason = noSelection
    ? tr(
        "请先选择预约再执行批量重启。",
        "Select at least one appointment first."
      )
    : !canBatchReinitiatePayment
      ? tr("仅管理员可执行重启支付。", "Only admin can re-initiate payment.")
      : "";
  const batchStatusDisabledReason = noSelection
    ? tr(
        "请先选择预约再执行批量状态更新。",
        "Select at least one appointment first."
      )
    : !canBatchUpdateStatus
      ? tr(
          "仅管理员可执行批量状态更新。",
          "Only admin can do batch status updates."
        )
      : "";
  const batchDisabledHints = [
    batchResendDisabledReason,
    batchPaymentDisabledReason,
    batchStatusDisabledReason,
  ].filter(Boolean);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onRefresh}>
          {tr("刷新", "Refresh")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={
            batchIsPending || selectedCount === 0 || !canBatchResendAccessLink
          }
          title={batchResendDisabledReason || undefined}
          onClick={() => onBatchAction({ action: "resend_access_link" })}
        >
          {tr("批量重发链接", "Batch resend link")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={
            batchIsPending || selectedCount === 0 || !canBatchReinitiatePayment
          }
          title={batchPaymentDisabledReason || undefined}
          onClick={() => onBatchAction({ action: "reinitiate_payment" })}
        >
          {tr("批量重启支付", "Batch re-initiate payment")}
        </Button>
        <label className="text-xs text-muted-foreground">{selectedText}</label>
        <Button type="button" variant="outline" onClick={onClearSelection}>
          {tr("清空选择", "Clear selection")}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full max-w-xs space-y-1">
          <p className="text-xs text-muted-foreground">
            {tr("目标状态", "Target Status")}
          </p>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={toStatus}
            onChange={event => setToStatus(event.target.value)}
          >
            <option value="draft">draft</option>
            <option value="pending_payment">pending_payment</option>
            <option value="paid">paid</option>
            <option value="active">active</option>
            <option value="ended">ended</option>
            <option value="completed">completed</option>
            <option value="expired">expired</option>
            <option value="refunded">refunded</option>
            <option value="canceled">canceled</option>
          </select>
        </div>
        <div className="w-full max-w-xs space-y-1">
          <p className="text-xs text-muted-foreground">
            {tr("目标支付状态", "Target Payment")}
          </p>
          <select
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={toPaymentStatus}
            onChange={event => setToPaymentStatus(event.target.value)}
          >
            <option value="unpaid">unpaid</option>
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="failed">failed</option>
            <option value="expired">expired</option>
            <option value="refunded">refunded</option>
            <option value="canceled">canceled</option>
          </select>
        </div>
        <Input
          className="w-full max-w-xs"
          value={statusReason}
          onChange={event => setStatusReason(event.target.value)}
          placeholder={tr("批量状态更新原因", "Batch status reason")}
        />
        <Button
          type="button"
          variant="outline"
          disabled={
            batchIsPending || selectedCount === 0 || !canBatchUpdateStatus
          }
          title={batchStatusDisabledReason || undefined}
          onClick={() =>
            onBatchAction({
              action: "update_status",
              toStatus,
              toPaymentStatus,
              reason: statusReason,
            })
          }
        >
          {tr("批量状态更新", "Batch status update")}
        </Button>
      </div>
      {batchDisabledHints.length > 0 ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{tr("说明：", "Hint:")}</p>
          {batchDisabledHints.map(reason => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      ) : null}
    </>
  );
}
