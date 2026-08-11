import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAdminAppointmentStatusLabel,
  getAdminPaymentStatusLabel,
  getAdminStatusGuidanceCopy,
  type AdminLang,
} from "@/features/admin/copy";
import {
  getAdminAppointmentNextStatuses,
  getAdminAppointmentPaymentStatuses,
  isAdminAppointmentStatus,
  isAdminPaymentStatus,
} from "@/features/admin/adminStatusTransitions";
import type { UpdateStatusMutation } from "@/features/admin/types";
import { cn } from "@/lib/utils";

type AppointmentStatusPanelProps = {
  tr: (zh: string, en: string) => string;
  lang: AdminLang;
  appointmentId: number;
  canMutateAdmin: boolean;
  currentStatus: string;
  currentPaymentStatus: string;
  manualStatus: string;
  setManualStatus: (value: string) => void;
  manualPaymentStatus: string;
  setManualPaymentStatus: (value: string) => void;
  manualStatusReason: string;
  setManualStatusReason: (value: string) => void;
  applyManualStatusUpdate: () => void;
  updateStatusMutation: UpdateStatusMutation;
};

export function AppointmentStatusPanel({
  tr,
  lang,
  appointmentId,
  canMutateAdmin,
  currentStatus,
  currentPaymentStatus,
  manualStatus,
  setManualStatus,
  manualPaymentStatus,
  setManualPaymentStatus,
  manualStatusReason,
  setManualStatusReason,
  applyManualStatusUpdate,
  updateStatusMutation,
}: AppointmentStatusPanelProps) {
  const copy = getAdminStatusGuidanceCopy(lang);
  const parsedCurrentStatus = isAdminAppointmentStatus(currentStatus)
    ? currentStatus
    : null;
  const parsedCurrentPaymentStatus = isAdminPaymentStatus(currentPaymentStatus)
    ? currentPaymentStatus
    : null;
  const nextStatusOptions = parsedCurrentStatus
    ? getAdminAppointmentNextStatuses(parsedCurrentStatus)
    : [];
  const hasValidStatusTarget =
    isAdminAppointmentStatus(manualStatus) &&
    nextStatusOptions.includes(manualStatus);
  const selectedTargetStatus = hasValidStatusTarget
    ? manualStatus
    : (nextStatusOptions[0] ?? null);
  const allowedPaymentStatusOptions = selectedTargetStatus
    ? getAdminAppointmentPaymentStatuses(selectedTargetStatus)
    : [];
  const hasValidPaymentTarget =
    isAdminPaymentStatus(manualPaymentStatus) &&
    allowedPaymentStatusOptions.includes(manualPaymentStatus);
  const statusReasonIsValid = manualStatusReason.trim().length >= 3;
  const reasonHintId = `appointment-${appointmentId}-status-reason-hint`;

  useEffect(() => {
    const nextStatus = nextStatusOptions[0] ?? "";
    if (
      nextStatusOptions.length === 0 ||
      !isAdminAppointmentStatus(manualStatus) ||
      !nextStatusOptions.includes(manualStatus)
    ) {
      if (manualStatus !== nextStatus) setManualStatus(nextStatus);
      return;
    }

    const allowedPayments = getAdminAppointmentPaymentStatuses(manualStatus);
    const nextPaymentStatus = allowedPayments[0] ?? "";
    if (
      !isAdminPaymentStatus(manualPaymentStatus) ||
      !allowedPayments.includes(manualPaymentStatus)
    ) {
      setManualPaymentStatus(nextPaymentStatus);
    }
  }, [
    manualPaymentStatus,
    manualStatus,
    nextStatusOptions,
    setManualPaymentStatus,
    setManualStatus,
  ]);

  return (
    <div className="space-y-3 rounded-xl border border-admin-border bg-admin-surface p-3">
      <div className="rounded-lg border border-admin-border bg-admin-surface-muted p-3">
        <p className="text-sm font-semibold text-admin-foreground">
          {copy.appointment.title}
        </p>
        <p className="mt-1 text-xs leading-5 text-admin-muted-foreground">
          {copy.appointment.description}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-admin-muted-foreground">
            {copy.appointment.currentCombination}
          </span>
          <span className="rounded-md border border-admin-border bg-admin-surface px-2 py-1 font-medium text-admin-foreground">
            {parsedCurrentStatus
              ? getAdminAppointmentStatusLabel(parsedCurrentStatus, lang)
              : currentStatus}
            {" · "}
            {parsedCurrentPaymentStatus
              ? getAdminPaymentStatusLabel(parsedCurrentPaymentStatus, lang)
              : currentPaymentStatus}
          </span>
          <ArrowRight
            aria-hidden="true"
            className="size-3.5 text-admin-muted-foreground"
          />
          <span className="text-admin-muted-foreground">
            {nextStatusOptions.length} {copy.appointment.availableTargets}
          </span>
        </div>
      </div>

      {!canMutateAdmin ? (
        <p className="text-xs text-muted-foreground">
          {tr(
            "仅管理员可执行预约状态/财务更新。",
            "Only admin can update appointment status/payment."
          )}
        </p>
      ) : null}
      {nextStatusOptions.length === 0 ? (
        <p className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-2 text-sm text-admin-muted-foreground">
          {copy.appointment.noTransitions}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-admin-foreground">
              <span>{copy.appointment.targetStatus}</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedTargetStatus ?? ""}
                onChange={event => setManualStatus(event.target.value)}
              >
                {nextStatusOptions.map(option => (
                  <option key={option} value={option}>
                    {getAdminAppointmentStatusLabel(option, lang)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-admin-foreground">
              <span>{copy.appointment.targetPaymentStatus}</span>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={hasValidPaymentTarget ? manualPaymentStatus : ""}
                onChange={event => setManualPaymentStatus(event.target.value)}
              >
                {allowedPaymentStatusOptions.map(option => (
                  <option key={option} value={option}>
                    {getAdminPaymentStatusLabel(option, lang)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
            <Input
              value={manualStatusReason}
              onChange={event => setManualStatusReason(event.target.value)}
              placeholder={tr("原因", "reason")}
              aria-describedby={reasonHintId}
            />
            <Button
              type="button"
              variant="outline"
              onClick={applyManualStatusUpdate}
              disabled={
                !canMutateAdmin ||
                updateStatusMutation.isPending ||
                !selectedTargetStatus ||
                !hasValidStatusTarget ||
                !hasValidPaymentTarget ||
                !statusReasonIsValid
              }
            >
              {updateStatusMutation.isPending
                ? tr("更新中...", "Updating...")
                : tr("应用状态", "Apply Status")}
            </Button>
          </div>
          <p
            id={reasonHintId}
            className={cn(
              "text-xs leading-5",
              statusReasonIsValid
                ? "text-admin-muted-foreground"
                : "text-amber-700 dark:text-amber-300"
            )}
          >
            {copy.reasonRequirement}
          </p>
        </>
      )}
    </div>
  );
}
