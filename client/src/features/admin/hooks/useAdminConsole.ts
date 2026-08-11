import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  computeAdminRisks,
  computeAdminSuggestions,
  type AdminSuggestion,
} from "@/features/admin/risk";
import {
  downloadBase64File,
  formatDate,
  stringify,
} from "@/features/admin/utils/adminFormatting";
import type {
  AdminBatchActionResult,
  UseAdminConsoleResult,
} from "@/features/admin/types";
import type {
  AdminConsoleSectionKey,
  AdminOperationsTabKey,
} from "@/features/admin/adminConsoleLayout";
import {
  getAdminConfirmationCopy,
  getAdminStatusGuidanceCopy,
  type AdminLang,
} from "@/features/admin/copy";
import {
  getAdminAppointmentNextStatuses,
  getAdminAppointmentPaymentStatuses,
  isAdminAppointmentStatus,
  isAdminPaymentStatus,
} from "@/features/admin/adminStatusTransitions";
import type { AdminConfirmationRequest } from "@/features/admin/adminActionConfirmationContext";
import { useAdminAppointmentFilters } from "@/features/admin/hooks/useAdminAppointmentFilters";
import { useAdminOperations } from "@/features/admin/hooks/useAdminOperations";
import { useAdminDirectory } from "@/features/admin/hooks/useAdminDirectory";
import { useAdminUsers } from "@/features/admin/hooks/useAdminUsers";

type TranslateFn = (zh: string, en: string) => string;

type UseAdminConsoleParams = {
  canReadAdmin: boolean;
  canMutateAdmin: boolean;
  canReplayWebhook: boolean;
  canResendAccessLink: boolean;
  canIssueAccessLinks: boolean;
  canNotifyFollowup: boolean;
  lang: "zh" | "en";
  tr: TranslateFn;
  activeSection: AdminConsoleSectionKey;
  activeOperationsTab: AdminOperationsTabKey;
  activeDirectoryTab: "catalog" | "media";
  activeUsersTab: "users" | "doctors";
  requestConfirmation: (request: AdminConfirmationRequest) => void;
};

const DEFAULT_BATCH_RESULT: AdminBatchActionResult[] = [];
const VALID_STATUS_VALUES = [
  "draft",
  "pending_payment",
  "paid",
  "active",
  "ended",
  "completed",
  "expired",
  "refunded",
  "canceled",
] as const;
const VALID_PAYMENT_STATUS_VALUES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
  "canceled",
] as const;
type AdminAppointmentStatus = (typeof VALID_STATUS_VALUES)[number];
type AdminPaymentStatus = (typeof VALID_PAYMENT_STATUS_VALUES)[number];
type ValidatedBatchInput = {
  action: "resend_access_link" | "reinitiate_payment" | "update_status";
  toStatus?: AdminAppointmentStatus;
  toPaymentStatus?: AdminPaymentStatus;
  reason?: string;
  idempotencyKey?: string;
};

const toStatusValue = (
  value: string | undefined
): AdminAppointmentStatus | undefined => {
  if (!value) {
    return undefined;
  }
  if ((VALID_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as AdminAppointmentStatus;
  }
  return undefined;
};
const toPaymentStatusValue = (
  value: string | undefined
): AdminPaymentStatus | undefined => {
  if (!value) {
    return undefined;
  }
  if ((VALID_PAYMENT_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as AdminPaymentStatus;
  }
  return undefined;
};
const toArray = (values: number[]): number[] => Array.from(new Set(values));

export function useAdminConsole({
  canReadAdmin,
  canMutateAdmin,
  canReplayWebhook,
  canResendAccessLink,
  canIssueAccessLinks,
  canNotifyFollowup,
  lang,
  tr,
  activeSection,
  activeOperationsTab,
  activeDirectoryTab,
  activeUsersTab,
  requestConfirmation,
}: UseAdminConsoleParams): UseAdminConsoleResult {
  const [appointmentIdInput, setAppointmentIdInput] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    number | null
  >(null);
  const [manualStatus, setManualStatus] = useState("active");
  const [manualPaymentStatus, setManualPaymentStatus] = useState("paid");
  const [manualStatusReason, setManualStatusReason] = useState("");
  const [manualScheduledAt, setManualScheduledAt] = useState("");
  const [issuedLinks, setIssuedLinks] = useState<{
    patientLink: string;
    doctorLink: string;
  } | null>(null);
  const [batchLastResult, setBatchLastResult] = useState<
    AdminBatchActionResult[] | null
  >(DEFAULT_BATCH_RESULT);
  const {
    emailQuery,
    setEmailQuery,
    statusFilter,
    setStatusFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    doctorIdInput,
    setDoctorIdInput,
    amountMinInput,
    setAmountMinInput,
    amountMaxInput,
    setAmountMaxInput,
    createdAtFrom,
    setCreatedAtFrom,
    createdAtTo,
    setCreatedAtTo,
    scheduledAtFrom,
    setScheduledAtFrom,
    scheduledAtTo,
    setScheduledAtTo,
    hasRiskFilter,
    setHasRiskFilter,
    selectedAppointmentIds,
    appointmentStatusOptions,
    paymentStatusOptions,
    appointmentsQuery,
    exportFilters,
    isAllVisibleSelected,
    isAnyVisibleSelected,
    resetAppointmentFilters,
    toggleAppointmentSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useAdminAppointmentFilters({
    canReadAdmin,
    isAppointmentsActive: activeSection === "appointments",
  });

  useEffect(() => {
    setManualStatusReason("");
  }, [selectedAppointmentId]);

  const toUiError = (message?: string) => {
    const raw = (message ?? "").trim();
    if (!raw) {
      return tr("操作失败，请重试。", "Operation failed. Please retry.");
    }
    if (raw === "RETENTION_STORAGE_UNAVAILABLE") {
      return tr(
        "数据保留策略表不可用。请先执行数据库迁移（含 0020）。",
        "Retention storage is unavailable. Run database migrations (including 0020)."
      );
    }
    if (raw.includes("Unknown column") && raw.includes("imageUrl")) {
      return tr(
        "医院封面字段不可用。请执行最新数据库迁移（含 0023）并重启服务。",
        "Hospital cover field is unavailable. Run latest DB migrations (including 0023) and restart the server."
      );
    }
    if (raw.includes("Failed query")) {
      return tr(
        "数据库结构与当前代码不一致。请执行最新数据库迁移并重启服务。",
        "Database schema is out of sync with current code. Run latest migrations and restart the server."
      );
    }
    return raw;
  };

  const toDateTimeLocalValue = (value: Date | string | null | undefined) => {
    if (!value) {
      return "";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const appointmentDetailQuery = trpc.system.adminAppointmentDetail.useQuery(
    { appointmentId: selectedAppointmentId ?? 0 },
    {
      enabled:
        canReadAdmin &&
        activeSection === "appointments" &&
        typeof selectedAppointmentId === "number",
    }
  );
  const visitSummaryQuery = trpc.system.adminGetVisitSummary.useQuery(
    { appointmentId: selectedAppointmentId ?? 0 },
    {
      enabled:
        canReadAdmin &&
        activeSection === "appointments" &&
        typeof selectedAppointmentId === "number",
    }
  );
  const {
    operationAuditPage,
    setOperationAuditPage,
    operationAuditOperatorIdInput,
    setOperationAuditOperatorIdInput,
    operationAuditActionTypeInput,
    setOperationAuditActionTypeInput,
    operationAuditFrom,
    setOperationAuditFrom,
    operationAuditTo,
    setOperationAuditTo,
    freeRetentionDaysInput,
    setFreeRetentionDaysInput,
    paidRetentionDaysInput,
    setPaidRetentionDaysInput,
    operationAuditQuery,
    triageQuery,
    triageRiskEventsQuery,
    retentionPoliciesQuery,
    retentionAuditsQuery,
    updateRetentionPolicyMutation,
    runRetentionCleanupMutation,
    exportAppointmentsMutation,
    upsertRetentionPolicy,
    toggleRetentionEnabled,
    refreshOperationsData,
  } = useAdminOperations({
    canReadAdmin,
    activeSection,
    activeOperationsTab,
    exportFilters,
    tr,
    toUiError,
  });

  const {
    hospitalsQuery,
    refreshDirectoryData,
    adminHospitalImageUploadMutation,
    adminHospitalImageClearMutation,
  } = useAdminDirectory({
    activeSection,
    activeDirectoryTab,
    canReadAdmin,
    canMutateAdmin,
    lang,
    tr,
    toUiError,
    requestConfirmation,
  });

  const {
    userSearchQuery,
    setUserSearchQuery,
    adminUsersQuery,
    updateUserRoleMutation,
    refreshUsersData,
  } = useAdminUsers({
    activeSection,
    activeUsersTab,
    canReadAdmin,
    canMutateAdmin,
    tr,
    toUiError,
  });

  useEffect(() => {
    const scheduledAt = appointmentDetailQuery.data?.appointment.scheduledAt;
    setManualScheduledAt(toDateTimeLocalValue(scheduledAt));
  }, [appointmentDetailQuery.data?.appointment.scheduledAt]);

  const refreshAdminData = useCallback(async () => {
    if (activeSection === "appointments") {
      await Promise.all([
        appointmentsQuery.refetch(),
        selectedAppointmentId
          ? appointmentDetailQuery.refetch()
          : Promise.resolve(),
        selectedAppointmentId ? visitSummaryQuery.refetch() : Promise.resolve(),
      ]);
      return;
    }
    if (activeSection === "directory") {
      await refreshDirectoryData();
      return;
    }
    if (activeSection === "users") {
      await refreshUsersData();
      return;
    }
    if (activeSection === "operations") {
      await refreshOperationsData();
    }
  }, [
    activeSection,
    appointmentDetailQuery,
    appointmentsQuery,
    refreshDirectoryData,
    refreshOperationsData,
    refreshUsersData,
    selectedAppointmentId,
    visitSummaryQuery,
  ]);

  const resendPaymentMutation = trpc.system.adminReinitiatePayment.useMutation({
    onError: error => {
      toast.error(toUiError(error.message));
    },
    onSuccess: async result => {
      toast.success(tr("正在跳转到支付页...", "Redirecting to checkout..."));
      await refreshAdminData();
      if (typeof window !== "undefined") {
        window.location.href = result.checkoutUrl;
      }
    },
  });
  const resendAccessLinkMutation =
    trpc.system.adminResendAccessLink.useMutation({
      onSuccess: async () => {
        toast.success(tr("访问链接邮件已重发。", "Access link email resent."));
        await refreshAdminData();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const issueLinksMutation = trpc.system.adminIssueAccessLinks.useMutation({
    onSuccess: async result => {
      setIssuedLinks({
        patientLink: result.patientLink,
        doctorLink: result.doctorLink,
      });
      toast.success(tr("新链接已签发。", "New links issued."));
      await refreshAdminData();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const notifyDoctorFollowupMutation =
    trpc.system.adminNotifyDoctorFollowup.useMutation({
      onSuccess: () => {
        toast.success(
          tr("已发送医生跟进提醒。", "Doctor follow-up reminder sent.")
        );
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const updateStatusMutation =
    trpc.system.adminUpdateAppointmentStatus.useMutation({
      onSuccess: async () => {
        toast.success(tr("预约状态已更新。", "Appointment status updated."));
        await refreshAdminData();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const updateScheduleMutation =
    trpc.system.adminUpdateAppointmentSchedule.useMutation({
      onSuccess: async () => {
        toast.success(tr("预约时间已更新。", "Appointment schedule updated."));
        await refreshAdminData();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const generateSummaryMutation =
    trpc.system.adminGenerateVisitSummary.useMutation({
      onSuccess: () => {
        toast.success(tr("会后总结已生成。", "Visit summary generated."));
        void visitSummaryQuery.refetch();
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const exportSummaryPdfMutation =
    trpc.system.adminExportVisitSummaryPdf.useMutation({
      onSuccess: result => {
        downloadBase64File(result.base64, result.mimeType, result.filename);
        toast.success(tr("PDF 已导出。", "PDF exported."));
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const adminBatchMutation =
    trpc.system.adminBatchAppointmentsAction.useMutation({
      onSuccess: result => {
        setBatchLastResult(result.results);
        const msg = tr(
          `批量处理完成：成功 ${result.summary.success}，跳过 ${result.summary.skipped}，失败 ${result.summary.failed}`,
          `Batch done: ${result.summary.success} success, ${result.summary.skipped} skipped, ${result.summary.failed} failed`
        );
        toast.success(msg);
        refreshAdminData().catch(() => {
          toast.error(
            tr(
              "刷新列表失败，请重试。",
              "Failed to refresh list. Please retry."
            )
          );
        });
      },
      onError: error => {
        toast.error(toUiError(error.message));
      },
    });
  const webhookReplayMutation = trpc.system.adminWebhookReplay.useMutation({
    onSuccess: result => {
      if (result.ok) {
        toast.success(tr("Webhook 重试成功。", "Webhook replay completed."));
      } else {
        toast.success(
          tr("Webhook 重试已去重。", "Webhook replay skipped by idempotency.")
        );
      }
      void refreshAdminData();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const risks = useMemo(
    () => computeAdminRisks(appointmentDetailQuery.data, new Date(), lang),
    [appointmentDetailQuery.data, lang]
  );
  const suggestions = useMemo(
    () => computeAdminSuggestions(appointmentDetailQuery.data, risks, lang),
    [appointmentDetailQuery.data, risks, lang]
  );

  const openAppointmentById = () => {
    const parsed = Number(appointmentIdInput.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      toast.error(
        tr("请输入有效的预约 ID。", "Please enter a valid appointment ID.")
      );
      return;
    }
    setSelectedAppointmentId(parsed);
    setIssuedLinks(null);
  };

  const applyManualStatusUpdate = () => {
    if (!selectedAppointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }

    const statusCopy = getAdminStatusGuidanceCopy(lang);
    const currentStatus = appointmentDetailQuery.data?.appointment.status ?? "";
    if (
      !isAdminAppointmentStatus(currentStatus) ||
      !isAdminAppointmentStatus(manualStatus) ||
      !isAdminPaymentStatus(manualPaymentStatus) ||
      !getAdminAppointmentNextStatuses(currentStatus).includes(manualStatus) ||
      !getAdminAppointmentPaymentStatuses(manualStatus).includes(
        manualPaymentStatus
      )
    ) {
      toast.error(statusCopy.appointment.invalidSelection);
      return;
    }

    const reason = manualStatusReason.trim();
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
        manualStatus === "canceled" ||
        manualStatus === "refunded" ||
        manualPaymentStatus === "refunded" ||
        manualPaymentStatus === "canceled"
          ? "danger"
          : "default",
      onConfirm: () =>
        updateStatusMutation.mutateAsync({
          appointmentId: selectedAppointmentId,
          toStatus: manualStatus as
            | "draft"
            | "pending_payment"
            | "paid"
            | "active"
            | "ended"
            | "completed"
            | "expired"
            | "refunded"
            | "canceled",
          toPaymentStatus: manualPaymentStatus as
            | "unpaid"
            | "pending"
            | "paid"
            | "failed"
            | "expired"
            | "refunded"
            | "canceled",
          reason,
        }),
    });
  };

  const applyManualScheduleUpdate = () => {
    if (!selectedAppointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }
    const raw = manualScheduledAt.trim();
    if (!raw) {
      toast.error(tr("请选择预约时间。", "Please select a scheduled time."));
      return;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      toast.error(tr("预约时间格式无效。", "Invalid scheduled time format."));
      return;
    }
    updateScheduleMutation.mutate({
      appointmentId: selectedAppointmentId,
      scheduledAt: parsed,
      reason: "ops_manual_schedule",
    });
  };

  const setScheduleToNow = () => {
    if (!selectedAppointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }
    const now = new Date();
    setManualScheduledAt(toDateTimeLocalValue(now));
    updateScheduleMutation.mutate({
      appointmentId: selectedAppointmentId,
      scheduledAt: now,
      reason: "ops_set_schedule_now",
    });
  };

  const handleCopyDebugSnapshot = async () => {
    if (!appointmentDetailQuery.data) {
      toast.error(
        tr("没有可复制的预约详情。", "No appointment detail to copy.")
      );
      return;
    }

    const debugPayload = {
      appointmentId: appointmentDetailQuery.data.appointment.id,
      status: appointmentDetailQuery.data.appointment.status,
      paymentStatus: appointmentDetailQuery.data.appointment.paymentStatus,
      stripeSessionId: null,
      scheduledAt: appointmentDetailQuery.data.appointment.scheduledAt,
      paidAt: appointmentDetailQuery.data.appointment.paidAt,
      tokenSummary: appointmentDetailQuery.data.activeTokens.map(token => ({
        id: token.id,
        role: token.role,
        useCount: token.useCount,
        maxUses: token.maxUses,
        expiresAt: token.expiresAt,
        lastUsedAt: token.lastUsedAt,
      })),
      latestStatusEvents: appointmentDetailQuery.data.statusEvents.slice(0, 10),
      latestWebhookEvents: appointmentDetailQuery.data.webhookEvents.slice(
        0,
        10
      ),
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
    const detail = appointmentDetailQuery.data?.appointment;
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
    const detail = appointmentDetailQuery.data?.appointment;
    if (!detail) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return false;
    }
    const allowedStatuses = new Set(["paid", "active"]);
    if (
      detail.paymentStatus !== "paid" ||
      !allowedStatuses.has(detail.status)
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
    const detail = appointmentDetailQuery.data?.appointment;
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
    if (!selectedAppointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }

    if (suggestion.action === "reinitiate_payment") {
      if (!canMutateAdmin) {
        toast.message(
          tr(
            "当前角色无权执行该动作。",
            "Current role cannot execute this action."
          )
        );
        return;
      }
    } else if (suggestion.action === "resend_access_link") {
      if (!canResendAccessLink) {
        toast.message(
          tr(
            "当前角色无权执行该动作。",
            "Current role cannot execute this action."
          )
        );
        return;
      }
    } else if (suggestion.action === "issue_access_links") {
      if (!canIssueAccessLinks) {
        toast.message(
          tr(
            "当前角色无权执行该动作。",
            "Current role cannot execute this action."
          )
        );
        return;
      }
    }

    if (suggestion.action === "notify_doctor_followup" && !canNotifyFollowup) {
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
          resendPaymentMutation.mutateAsync({
            appointmentId: selectedAppointmentId,
          }),
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
          resendAccessLinkMutation.mutateAsync({
            appointmentId: selectedAppointmentId,
          }),
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
          issueLinksMutation.mutateAsync({
            appointmentId: selectedAppointmentId,
          }),
      });
      return;
    }
    if (suggestion.action === "notify_doctor_followup") {
      notifyDoctorFollowupMutation.mutate({
        appointmentId: selectedAppointmentId,
      });
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

  const executeBatch = (input: {
    action: "resend_access_link" | "reinitiate_payment" | "update_status";
    toStatus?: string;
    toPaymentStatus?: string;
    reason?: string;
    idempotencyKey?: string;
  }) => {
    if (selectedAppointmentIds.length === 0) {
      toast.error(
        tr("请先选择至少一条预约。", "Select at least one appointment.")
      );
      return;
    }
    const validatedInput: ValidatedBatchInput = {
      action: input.action,
      toStatus: toStatusValue(input.toStatus),
      toPaymentStatus: toPaymentStatusValue(input.toPaymentStatus),
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    };
    if (validatedInput.action === "resend_access_link") {
      if (!canResendAccessLink) {
        toast.message(
          tr(
            "当前角色无权执行该批量动作。",
            "Current role cannot execute this batch action."
          )
        );
        return;
      }
    }

    if (
      validatedInput.action === "reinitiate_payment" ||
      validatedInput.action === "update_status"
    ) {
      if (!canMutateAdmin) {
        toast.message(
          tr(
            "当前角色无权执行该批量动作。",
            "Current role cannot execute this batch action."
          )
        );
        return;
      }
    }

    const normalizedReason =
      typeof validatedInput.reason === "string" &&
      validatedInput.reason.trim().length
        ? validatedInput.reason.trim()
        : "admin_batch_action";
    return adminBatchMutation.mutateAsync({
      appointmentIds: toArray(selectedAppointmentIds),
      action: validatedInput.action,
      toStatus: validatedInput.toStatus,
      toPaymentStatus: validatedInput.toPaymentStatus,
      reason: normalizedReason,
      idempotencyKey: validatedInput.idempotencyKey ?? randomUUID(),
    });
  };

  const replayWebhookByEvent = (params: {
    eventId?: string;
    appointmentId?: number;
  }) => {
    webhookReplayMutation.mutate({
      eventId: params.eventId,
      appointmentId: params.appointmentId,
      replayKey: randomUUID(),
    });
  };

  return {
    userSearchQuery,
    setUserSearchQuery,
    emailQuery,
    setEmailQuery,
    page,
    setPage,
    pageSize,
    setPageSize,
    statusFilter,
    setStatusFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
    resetAppointmentFilters,
    doctorIdInput,
    setDoctorIdInput,
    amountMinInput,
    setAmountMinInput,
    amountMaxInput,
    setAmountMaxInput,
    createdAtFrom,
    setCreatedAtFrom,
    createdAtTo,
    setCreatedAtTo,
    scheduledAtFrom,
    setScheduledAtFrom,
    scheduledAtTo,
    setScheduledAtTo,
    hasRiskFilter,
    setHasRiskFilter,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    appointmentIdInput,
    setAppointmentIdInput,
    selectedAppointmentId,
    setSelectedAppointmentId,
    manualStatus,
    setManualStatus,
    manualPaymentStatus,
    setManualPaymentStatus,
    manualStatusReason,
    setManualStatusReason,
    manualScheduledAt,
    setManualScheduledAt,
    freeRetentionDaysInput,
    setFreeRetentionDaysInput,
    paidRetentionDaysInput,
    setPaidRetentionDaysInput,
    issuedLinks,
    setIssuedLinks,
    appointmentStatusOptions,
    paymentStatusOptions,
    appointmentsQuery,
    triageQuery,
    triageRiskEventsQuery,
    appointmentDetailQuery,
    visitSummaryQuery,
    operationAuditQuery,
    operationAuditPage,
    setOperationAuditPage,
    operationAuditOperatorIdInput,
    setOperationAuditOperatorIdInput,
    operationAuditActionTypeInput,
    setOperationAuditActionTypeInput,
    operationAuditFrom,
    setOperationAuditFrom,
    operationAuditTo,
    setOperationAuditTo,
    retentionPoliciesQuery,
    retentionAuditsQuery,
    canReadAdmin,
    canMutateAdmin,
    canReplayWebhook,
    canResendAccessLink,
    canIssueAccessLinks,
    canNotifyFollowup,
    hospitalsQuery,
    adminUsersQuery,
    refreshAdminData,
    resendPaymentMutation,
    resendAccessLinkMutation,
    issueLinksMutation,
    adminHospitalImageUploadMutation,
    adminHospitalImageClearMutation,
    notifyDoctorFollowupMutation,
    updateStatusMutation,
    updateScheduleMutation,
    generateSummaryMutation,
    exportSummaryPdfMutation,
    updateRetentionPolicyMutation,
    updateUserRoleMutation,
    runRetentionCleanupMutation,
    batchAppointmentsMutation: {
      isPending: adminBatchMutation.isPending,
      executeBatch,
      lastResult: batchLastResult,
    },
    webhookReplayMutation: {
      isPending: webhookReplayMutation.isPending,
      replayByEvent: replayWebhookByEvent,
    },
    exportAppointmentsMutation,
    selectedAppointmentIds,
    selectedCount: selectedAppointmentIds.length,
    isAllVisibleSelected,
    isAnyVisibleSelected,
    toggleAppointmentSelection,
    toggleSelectAllVisible,
    clearSelection,
    risks,
    suggestions,
    openAppointmentById,
    applyManualStatusUpdate,
    applyManualScheduleUpdate,
    setScheduleToNow,
    upsertRetentionPolicy,
    toggleRetentionEnabled,
    handleCopyDebugSnapshot,
    beforeReinitiatePayment,
    beforeResendAccessLink,
    beforeIssueLinks,
    runSuggestedAction,
    toUiError,
  };
}

function randomUUID() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
