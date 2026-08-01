import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ExportSummaryPdfMutation,
  GenerateSummaryMutation,
  IssueLinksMutation,
  ReinitiatePaymentMutation,
  ResendAccessLinkMutation,
  UpdateScheduleMutation,
  UpdateStatusMutation,
  VisitSummaryQuery,
} from "@/features/admin/types";
import { useAdminActionConfirmation } from "@/features/admin/adminActionConfirmationContext";
import {
  getAdminAppointmentStatusLabel,
  getAdminConfirmationCopy,
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
import { cn } from "@/lib/utils";

type TranslateFn = (zh: string, en: string) => string;

type ActionsSectionProps = {
  tr: TranslateFn;
  lang: AdminLang;
  selectedAppointmentId: number;
  hideQuickActions?: boolean;
  beforeReinitiatePayment: () => boolean;
  beforeResendAccessLink: () => boolean;
  beforeIssueLinks: () => boolean;
  resendPaymentMutation: ReinitiatePaymentMutation;
  resendAccessLinkMutation: ResendAccessLinkMutation;
  issueLinksMutation: IssueLinksMutation;
  canMutateAdmin: boolean;
  canReinitiatePayment: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  handleCopyDebugSnapshot: () => Promise<void>;
  currentStatus: string;
  currentPaymentStatus: string;
  manualStatus: string;
  setManualStatus: (value: string) => void;
  manualPaymentStatus: string;
  setManualPaymentStatus: (value: string) => void;
  manualStatusReason: string;
  setManualStatusReason: (value: string) => void;
  manualScheduledAt: string;
  setManualScheduledAt: (value: string) => void;
  setScheduleToNow: () => void;
  applyManualStatusUpdate: () => void;
  applyManualScheduleUpdate: () => void;
  updateStatusMutation: UpdateStatusMutation;
  updateScheduleMutation: UpdateScheduleMutation;
  generateSummaryMutation: GenerateSummaryMutation;
  exportSummaryPdfMutation: ExportSummaryPdfMutation;
  visitSummaryQuery: VisitSummaryQuery;
  issuedLinks: { patientLink: string; doctorLink: string } | null;
};

export function ActionsSection({
  tr,
  lang,
  selectedAppointmentId,
  hideQuickActions = false,
  beforeReinitiatePayment,
  beforeResendAccessLink,
  beforeIssueLinks,
  resendPaymentMutation,
  resendAccessLinkMutation,
  issueLinksMutation,
  canMutateAdmin,
  canReinitiatePayment,
  canResendAccessLink,
  canIssueAccessLinks,
  handleCopyDebugSnapshot,
  currentStatus,
  currentPaymentStatus,
  manualStatus,
  setManualStatus,
  manualPaymentStatus,
  setManualPaymentStatus,
  manualStatusReason,
  setManualStatusReason,
  manualScheduledAt,
  setManualScheduledAt,
  setScheduleToNow,
  applyManualStatusUpdate,
  applyManualScheduleUpdate,
  updateStatusMutation,
  updateScheduleMutation,
  generateSummaryMutation,
  exportSummaryPdfMutation,
  visitSummaryQuery,
  issuedLinks,
}: ActionsSectionProps) {
  const { requestConfirmation } = useAdminActionConfirmation();
  const statusCopy = getAdminStatusGuidanceCopy(lang);
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
  const reasonHintId = `appointment-${selectedAppointmentId}-status-reason-hint`;

  useEffect(() => {
    const nextStatus = nextStatusOptions[0] ?? "";
    if (
      nextStatusOptions.length === 0 ||
      !isAdminAppointmentStatus(manualStatus) ||
      !nextStatusOptions.includes(manualStatus)
    ) {
      if (manualStatus !== nextStatus) {
        setManualStatus(nextStatus);
      }
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
  const reinitiateDisabledReason = !canReinitiatePayment
    ? tr("仅管理员可重新发起支付。", "Only admin can re-initiate payment.")
    : "";
  const resendLinkDisabledReason = !canResendAccessLink
    ? tr(
        "仅管理员与 ops 可重发访问链接。",
        "Only admin/ops can resend access links."
      )
    : "";
  const issueLinksDisabledReason = !canIssueAccessLinks
    ? tr(
        "仅管理员与 ops 可签发新访问链接。",
        "Only admin/ops can issue new access links."
      )
    : "";
  const manualUpdateDisabledReason = !canMutateAdmin
    ? tr(
        "仅管理员可执行预约状态/财务更新。",
        "Only admin can update appointment status/payment."
      )
    : "";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {!hideQuickActions ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!beforeReinitiatePayment()) return;
              const confirmation = getAdminConfirmationCopy(
                lang,
                "reinitiatePayment"
              );
              requestConfirmation({
                title: confirmation.title,
                description: confirmation.description,
                confirmLabel: confirmation.continueLabel,
                cancelLabel: confirmation.cancelLabel,
                tone: "danger",
                onConfirm: () =>
                  resendPaymentMutation.mutateAsync({
                    appointmentId: selectedAppointmentId,
                  }),
              });
            }}
            disabled={!canReinitiatePayment || resendPaymentMutation.isPending}
            title={reinitiateDisabledReason || undefined}
          >
            {resendPaymentMutation.isPending
              ? tr("正在打开支付页...", "Opening checkout...")
              : tr("重新发起支付", "Re-initiate Payment")}
          </Button>
        ) : null}
        {!hideQuickActions ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!beforeResendAccessLink()) return;
              const confirmation = getAdminConfirmationCopy(
                lang,
                "resendAccessLink"
              );
              requestConfirmation({
                title: confirmation.title,
                description: confirmation.description,
                confirmLabel: confirmation.continueLabel,
                cancelLabel: confirmation.cancelLabel,
                onConfirm: () =>
                  resendAccessLinkMutation.mutateAsync({
                    appointmentId: selectedAppointmentId,
                  }),
              });
            }}
            disabled={
              !canResendAccessLink || resendAccessLinkMutation.isPending
            }
            title={resendLinkDisabledReason || undefined}
          >
            {resendAccessLinkMutation.isPending
              ? tr("发送中...", "Sending...")
              : tr("重发访问链接邮件", "Resend Access Link Email")}
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => {
            if (!beforeIssueLinks()) return;
            const confirmation = getAdminConfirmationCopy(
              lang,
              "issueAccessLinks"
            );
            requestConfirmation({
              title: confirmation.title,
              description: confirmation.description,
              confirmLabel: confirmation.continueLabel,
              cancelLabel: confirmation.cancelLabel,
              tone: "danger",
              onConfirm: () =>
                issueLinksMutation.mutateAsync({
                  appointmentId: selectedAppointmentId,
                }),
            });
          }}
          disabled={!canIssueAccessLinks || issueLinksMutation.isPending}
          title={issueLinksDisabledReason || undefined}
        >
          {issueLinksMutation.isPending
            ? tr("签发中...", "Issuing...")
            : tr("签发新访问链接", "Issue New Access Links")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleCopyDebugSnapshot()}
        >
          {tr("复制调试快照", "Copy Debug Snapshot")}
        </Button>
      </div>

      <div className="space-y-3 rounded-xl border border-admin-border bg-admin-surface p-3">
        <div className="rounded-lg border border-admin-border bg-admin-surface-muted p-3">
          <p className="text-sm font-semibold text-admin-foreground">
            {statusCopy.appointment.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-admin-muted-foreground">
            {statusCopy.appointment.description}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-admin-muted-foreground">
              {statusCopy.appointment.currentCombination}
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
              {nextStatusOptions.length}{" "}
              {statusCopy.appointment.availableTargets}
            </span>
          </div>
        </div>

        {!canMutateAdmin ? (
          <p className="text-xs text-muted-foreground">
            {manualUpdateDisabledReason}
          </p>
        ) : null}
        {nextStatusOptions.length === 0 ? (
          <p className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-2 text-sm text-admin-muted-foreground">
            {statusCopy.appointment.noTransitions}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-admin-foreground">
                <span>{statusCopy.appointment.targetStatus}</span>
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
                <span>{statusCopy.appointment.targetPaymentStatus}</span>
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
              {statusCopy.reasonRequirement}
            </p>
          </>
        )}
      </div>

      <div className="space-y-2 rounded border p-3">
        <p className="text-sm font-medium">
          {tr("测试预约时间", "Test Appointment Time")}
        </p>
        {!canMutateAdmin ? (
          <p className="text-xs text-muted-foreground">
            {manualUpdateDisabledReason}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <Input
            type="datetime-local"
            value={manualScheduledAt}
            onChange={event => setManualScheduledAt(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={setScheduleToNow}
            disabled={!canMutateAdmin || updateScheduleMutation.isPending}
          >
            {tr("设为当前时间", "Set to now")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={applyManualScheduleUpdate}
            disabled={!canMutateAdmin || updateScheduleMutation.isPending}
          >
            {updateScheduleMutation.isPending
              ? tr("保存中...", "Saving...")
              : tr("保存预约时间", "Save schedule")}
          </Button>
        </div>
      </div>

      <div className="space-y-2 rounded border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {tr("会后总结（中/英）", "Post-Visit Summary (ZH/EN)")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                generateSummaryMutation.mutate({
                  appointmentId: selectedAppointmentId,
                  forceRegenerate: true,
                })
              }
              disabled={generateSummaryMutation.isPending}
            >
              {generateSummaryMutation.isPending
                ? tr("生成中...", "Generating...")
                : tr("生成总结", "Generate Summary")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportSummaryPdfMutation.mutate({
                  appointmentId: selectedAppointmentId,
                  lang: "zh",
                })
              }
              disabled={exportSummaryPdfMutation.isPending}
            >
              {tr("导出中文 PDF", "Export ZH PDF")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                exportSummaryPdfMutation.mutate({
                  appointmentId: selectedAppointmentId,
                  lang: "en",
                })
              }
              disabled={exportSummaryPdfMutation.isPending}
            >
              {tr("导出英文 PDF", "Export EN PDF")}
            </Button>
          </div>
        </div>
        {visitSummaryQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">
            {tr("正在加载总结...", "Loading summary...")}
          </p>
        ) : visitSummaryQuery.data ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded bg-admin-surface-muted p-2">
              <p className="mb-1 text-xs font-medium text-foreground">
                {tr("中文", "Chinese")}
              </p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs">
                {visitSummaryQuery.data.summary.zh}
              </pre>
            </div>
            <div className="rounded bg-admin-surface-muted p-2">
              <p className="mb-1 text-xs font-medium text-foreground">
                {tr("English", "English")}
              </p>
              <pre className="overflow-auto whitespace-pre-wrap text-xs">
                {visitSummaryQuery.data.summary.en}
              </pre>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {tr("尚未生成总结。", "No summary generated yet.")}
          </p>
        )}
      </div>

      {issuedLinks ? (
        <div className="rounded border bg-admin-surface-muted p-3 text-xs">
          <p className="font-medium">{tr("签发链接", "Issued Links")}</p>
          <p className="mt-1 break-all">
            {tr("患者：", "Patient: ")} {issuedLinks.patientLink}
          </p>
          <p className="mt-1 break-all">
            {tr("医生：", "Doctor: ")} {issuedLinks.doctorLink}
          </p>
        </div>
      ) : null}
    </>
  );
}
