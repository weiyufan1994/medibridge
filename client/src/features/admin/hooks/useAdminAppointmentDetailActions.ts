import { toast } from "sonner";
import type { AdminConfirmationRequest } from "../adminActionConfirmationContext";
import {
  getAdminAppointmentNextStatuses,
  getAdminAppointmentPaymentStatuses,
  isAdminAppointmentStatus,
  isAdminPaymentStatus,
} from "../adminStatusTransitions";
import {
  getAdminConfirmationCopy,
  getAdminStatusGuidanceCopy,
  type AdminLang,
} from "../copy";
import type { AdminSuggestion } from "../risk";
import { formatDate, stringify } from "../utils/adminFormatting";
import type { useAdminAppointmentDetailState } from "./useAdminAppointmentDetailState";
import { toDateTimeLocalValue } from "./useAdminAppointmentDetailState";
import type { useAdminAppointmentMutations } from "./useAdminAppointmentMutations";

type DetailState = ReturnType<typeof useAdminAppointmentDetailState>;
type DetailMutations = ReturnType<typeof useAdminAppointmentMutations>;
type TranslateFn = (zh: string, en: string) => string;

export function useAdminAppointmentDetailActions({
  canMutateAdmin,
  canResendAccessLink,
  canIssueAccessLinks,
  canNotifyFollowup,
  lang,
  tr,
  requestConfirmation,
  detailState,
  mutations,
}: {
  canMutateAdmin: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  canNotifyFollowup: boolean;
  lang: "zh" | "en";
  tr: TranslateFn;
  requestConfirmation: (request: AdminConfirmationRequest) => void;
  detailState: DetailState;
  mutations: DetailMutations;
}) {
  const openAppointmentById = () => {
    const parsed = Number(detailState.appointmentIdInput.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      toast.error(
        tr("请输入有效的预约 ID。", "Please enter a valid appointment ID.")
      );
      return;
    }
    detailState.setSelectedAppointmentId(parsed);
    detailState.setIssuedLinks(null);
  };

  const applyManualStatusUpdate = () => {
    const appointmentId = detailState.selectedAppointmentId;
    if (!appointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }

    const statusCopy = getAdminStatusGuidanceCopy(lang);
    const currentStatus =
      detailState.appointmentDetailQuery.data?.appointment.status ?? "";
    const nextStatus = detailState.manualStatus;
    const nextPaymentStatus = detailState.manualPaymentStatus;
    if (
      !isAdminAppointmentStatus(currentStatus) ||
      !isAdminAppointmentStatus(nextStatus) ||
      !isAdminPaymentStatus(nextPaymentStatus) ||
      !getAdminAppointmentNextStatuses(currentStatus).includes(nextStatus) ||
      !getAdminAppointmentPaymentStatuses(nextStatus).includes(
        nextPaymentStatus
      )
    ) {
      toast.error(statusCopy.appointment.invalidSelection);
      return;
    }

    const reason = detailState.manualStatusReason.trim();
    if (reason.length < 3) {
      toast.error(tr("请填写有效原因。", "Please provide a valid reason."));
      return;
    }

    const confirmation = getAdminConfirmationCopy(
      lang as AdminLang,
      "updateAppointmentStatus"
    );
    requestConfirmation({
      title: confirmation.title,
      description: confirmation.description,
      confirmLabel: confirmation.confirmLabel,
      cancelLabel: confirmation.cancelLabel,
      tone:
        nextStatus === "canceled" ||
        nextStatus === "refunded" ||
        nextPaymentStatus === "refunded" ||
        nextPaymentStatus === "canceled"
          ? "danger"
          : "default",
      onConfirm: () =>
        mutations.updateStatusMutation.mutateAsync({
          appointmentId,
          toStatus: nextStatus,
          toPaymentStatus: nextPaymentStatus,
          reason,
        }),
    });
  };

  const applyManualScheduleUpdate = () => {
    if (!detailState.selectedAppointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }
    const raw = detailState.manualScheduledAt.trim();
    if (!raw) {
      toast.error(tr("请选择预约时间。", "Please select a scheduled time."));
      return;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      toast.error(tr("预约时间格式无效。", "Invalid scheduled time format."));
      return;
    }
    mutations.updateScheduleMutation.mutate({
      appointmentId: detailState.selectedAppointmentId,
      scheduledAt: parsed,
      reason: "ops_manual_schedule",
    });
  };

  const setScheduleToNow = () => {
    if (!detailState.selectedAppointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }
    const now = new Date();
    detailState.setManualScheduledAt(toDateTimeLocalValue(now));
    mutations.updateScheduleMutation.mutate({
      appointmentId: detailState.selectedAppointmentId,
      scheduledAt: now,
      reason: "ops_set_schedule_now",
    });
  };

  const handleCopyDebugSnapshot = async () => {
    const detail = detailState.appointmentDetailQuery.data;
    if (!detail) {
      toast.error(
        tr("没有可复制的预约详情。", "No appointment detail to copy.")
      );
      return;
    }

    const debugPayload = {
      appointmentId: detail.appointment.id,
      status: detail.appointment.status,
      paymentStatus: detail.appointment.paymentStatus,
      stripeSessionId: null,
      scheduledAt: detail.appointment.scheduledAt,
      paidAt: detail.appointment.paidAt,
      tokenSummary: detail.activeTokens.map(token => ({
        id: token.id,
        role: token.role,
        useCount: token.useCount,
        maxUses: token.maxUses,
        expiresAt: token.expiresAt,
        lastUsedAt: token.lastUsedAt,
      })),
      latestStatusEvents: detail.statusEvents.slice(0, 10),
      latestWebhookEvents: detail.webhookEvents.slice(0, 10),
    };
    const textTemplate = [
      `Appointment #${debugPayload.appointmentId}`,
      `Status: ${debugPayload.status}`,
      `Payment: ${debugPayload.paymentStatus}`,
      `Scheduled At: ${formatDate(debugPayload.scheduledAt as Date | string | null)}`,
      `Paid At: ${formatDate(debugPayload.paidAt as Date | string | null)}`,
      `Token Count: ${debugPayload.tokenSummary.length}`,
      `Recent Status Events: ${debugPayload.latestStatusEvents.length}`,
      `Recent Webhook Events: ${debugPayload.latestWebhookEvents.length}`,
      "",
      "JSON:",
      stringify(debugPayload),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(textTemplate);
      toast.success(tr("调试快照已复制。", "Debug snapshot copied."));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr("复制调试快照失败。", "Failed to copy debug snapshot.")
      );
    }
  };

  const beforeReinitiatePayment = () => {
    const detail = detailState.appointmentDetailQuery.data?.appointment;
    if (!detail) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return false;
    }
    const blockedStatuses = new Set([
      "paid",
      "active",
      "ended",
      "completed",
      "refunded",
    ]);
    if (detail.paymentStatus === "paid" || blockedStatuses.has(detail.status)) {
      toast.error(
        tr(
          "该预约已结算，不可重新发起支付。",
          "This appointment is already settled. Re-initiate payment is not allowed."
        )
      );
      return false;
    }
    return true;
  };

  const beforeResendAccessLink = () => {
    const detail = detailState.appointmentDetailQuery.data?.appointment;
    if (!detail) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return false;
    }
    if (
      detail.paymentStatus !== "paid" ||
      !new Set(["paid", "active"]).has(detail.status)
    ) {
      toast.error(
        tr(
          "仅已支付/进行中的预约支持重发访问链接。",
          "Access link resend is only available for paid/active appointments."
        )
      );
      return false;
    }
    return true;
  };

  const beforeIssueLinks = () => {
    const detail = detailState.appointmentDetailQuery.data?.appointment;
    if (!detail) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return false;
    }
    if (detail.paymentStatus !== "paid") {
      toast.error(
        tr(
          "仅支付完成后可签发访问链接。",
          "Issue link is only available after payment is settled."
        )
      );
      return false;
    }
    return true;
  };

  const runSuggestedAction = (suggestion: AdminSuggestion) => {
    const appointmentId = detailState.selectedAppointmentId;
    if (!appointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }

    const permissionGranted = {
      reinitiate_payment: canMutateAdmin,
      resend_access_link: canResendAccessLink,
      issue_access_links: canIssueAccessLinks,
      notify_doctor_followup: canNotifyFollowup,
      inspect_webhook_timeline: true,
      monitor_only: true,
    }[suggestion.action];
    if (!permissionGranted) {
      toast.message(
        tr(
          "当前角色无权执行该动作。",
          "Current role cannot execute this action."
        )
      );
      return;
    }

    if (suggestion.action === "reinitiate_payment") {
      if (!beforeReinitiatePayment()) return;
      const confirmation = getAdminConfirmationCopy(lang, "reinitiatePayment");
      requestConfirmation({
        title: confirmation.title,
        description: confirmation.description,
        confirmLabel: confirmation.continueLabel,
        cancelLabel: confirmation.cancelLabel,
        tone: "danger",
        onConfirm: () =>
          mutations.resendPaymentMutation.mutateAsync({ appointmentId }),
      });
      return;
    }
    if (suggestion.action === "resend_access_link") {
      if (!beforeResendAccessLink()) return;
      const confirmation = getAdminConfirmationCopy(lang, "resendAccessLink");
      requestConfirmation({
        title: confirmation.title,
        description: confirmation.description,
        confirmLabel: confirmation.continueLabel,
        cancelLabel: confirmation.cancelLabel,
        onConfirm: () =>
          mutations.resendAccessLinkMutation.mutateAsync({ appointmentId }),
      });
      return;
    }
    if (suggestion.action === "issue_access_links") {
      if (!beforeIssueLinks()) return;
      const confirmation = getAdminConfirmationCopy(lang, "issueAccessLinks");
      requestConfirmation({
        title: confirmation.title,
        description: confirmation.description,
        confirmLabel: confirmation.continueLabel,
        cancelLabel: confirmation.cancelLabel,
        tone: "danger",
        onConfirm: () =>
          mutations.issueLinksMutation.mutateAsync({ appointmentId }),
      });
      return;
    }
    if (suggestion.action === "notify_doctor_followup") {
      mutations.notifyDoctorFollowupMutation.mutate({ appointmentId });
      return;
    }
    if (suggestion.action === "inspect_webhook_timeline") {
      toast.message(
        tr(
          "请先查看下方 webhook 时间线再执行下一步。",
          "Review the webhook timeline section below before next action."
        )
      );
      return;
    }
    toast.message(tr("当前无紧急动作。", "No urgent action required."));
  };

  return {
    openAppointmentById,
    applyManualStatusUpdate,
    applyManualScheduleUpdate,
    setScheduleToNow,
    handleCopyDebugSnapshot,
    beforeReinitiatePayment,
    beforeResendAccessLink,
    beforeIssueLinks,
    runSuggestedAction,
  };
}
