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
import type { UseAdminConsoleResult } from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type UseAdminConsoleParams = {
  isAdmin: boolean;
  lang: "zh" | "en";
  tr: TranslateFn;
};

export function useAdminConsole({
  isAdmin,
  lang,
  tr,
}: UseAdminConsoleParams): UseAdminConsoleResult {
  const [emailQuery, setEmailQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [appointmentIdInput, setAppointmentIdInput] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [manualStatus, setManualStatus] = useState("active");
  const [manualPaymentStatus, setManualPaymentStatus] = useState("paid");
  const [manualStatusReason, setManualStatusReason] = useState("ops_manual_update");
  const [freeRetentionDaysInput, setFreeRetentionDaysInput] = useState("7");
  const [paidRetentionDaysInput, setPaidRetentionDaysInput] = useState("180");
  const [issuedLinks, setIssuedLinks] = useState<{
    patientLink: string;
    doctorLink: string;
  } | null>(null);

  const appointmentStatusOptions = [
    "",
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
  const paymentStatusOptions = [
    "",
    "unpaid",
    "pending",
    "paid",
    "failed",
    "expired",
    "refunded",
    "canceled",
  ] as const;

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

  const appointmentsQuery = trpc.system.adminAppointments.useQuery(
    {
      limit: 50,
      emailQuery: emailQuery.trim() || undefined,
      status: (statusFilter || undefined) as
        | "draft"
        | "pending_payment"
        | "paid"
        | "active"
        | "ended"
        | "completed"
        | "expired"
        | "refunded"
        | "canceled"
        | undefined,
      paymentStatus: (paymentStatusFilter || undefined) as
        | "unpaid"
        | "pending"
        | "paid"
        | "failed"
        | "expired"
        | "refunded"
        | "canceled"
        | undefined,
    },
    { enabled: isAdmin }
  );

  const triageQuery = trpc.system.adminTriageSessions.useQuery(
    {
      limit: 50,
    },
    { enabled: isAdmin }
  );

  const metricsQuery = trpc.system.metrics.useQuery(undefined, { enabled: isAdmin });
  const appointmentDetailQuery = trpc.system.adminAppointmentDetail.useQuery(
    { appointmentId: selectedAppointmentId ?? 0 },
    { enabled: isAdmin && typeof selectedAppointmentId === "number" }
  );
  const visitSummaryQuery = trpc.system.adminGetVisitSummary.useQuery(
    { appointmentId: selectedAppointmentId ?? 0 },
    { enabled: isAdmin && typeof selectedAppointmentId === "number" }
  );
  const retentionPoliciesQuery = trpc.system.adminRetentionPolicies.useQuery(undefined, {
    enabled: isAdmin,
  });
  const hospitalsQuery = trpc.system.adminHospitals.useQuery(undefined, {
    enabled: isAdmin,
  });
  const retentionAuditsQuery = trpc.system.adminRetentionCleanupAudits.useQuery(
    { limit: 20 },
    { enabled: isAdmin }
  );

  useEffect(() => {
    const rows = retentionPoliciesQuery.data;
    if (!rows || rows.length === 0) {
      return;
    }
    const free = rows.find(item => item.tier === "free");
    const paid = rows.find(item => item.tier === "paid");
    if (free) {
      setFreeRetentionDaysInput(String(free.retentionDays));
    }
    if (paid) {
      setPaidRetentionDaysInput(String(paid.retentionDays));
    }
  }, [retentionPoliciesQuery.data]);

  const refreshAdminData = useCallback(async () => {
    await Promise.all([
      appointmentsQuery.refetch(),
      triageQuery.refetch(),
      metricsQuery.refetch(),
      selectedAppointmentId ? appointmentDetailQuery.refetch() : Promise.resolve(),
      selectedAppointmentId ? visitSummaryQuery.refetch() : Promise.resolve(),
      hospitalsQuery.refetch(),
      retentionPoliciesQuery.refetch(),
      retentionAuditsQuery.refetch(),
    ]);
  }, [
    appointmentDetailQuery,
    appointmentsQuery,
    hospitalsQuery,
    metricsQuery,
    retentionAuditsQuery,
    retentionPoliciesQuery,
    selectedAppointmentId,
    triageQuery,
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
  const resendAccessLinkMutation = trpc.system.adminResendAccessLink.useMutation({
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
  const notifyDoctorFollowupMutation = trpc.system.adminNotifyDoctorFollowup.useMutation({
    onSuccess: () => {
      toast.success(tr("已发送医生跟进提醒。", "Doctor follow-up reminder sent."));
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const updateStatusMutation = trpc.system.adminUpdateAppointmentStatus.useMutation({
    onSuccess: async () => {
      toast.success(tr("预约状态已更新。", "Appointment status updated."));
      await refreshAdminData();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const generateSummaryMutation = trpc.system.adminGenerateVisitSummary.useMutation({
    onSuccess: () => {
      toast.success(tr("会后总结已生成。", "Visit summary generated."));
      void visitSummaryQuery.refetch();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const exportSummaryPdfMutation = trpc.system.adminExportVisitSummaryPdf.useMutation({
    onSuccess: result => {
      downloadBase64File(result.base64, result.mimeType, result.filename);
      toast.success(tr("PDF 已导出。", "PDF exported."));
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const updateRetentionPolicyMutation = trpc.system.adminUpsertRetentionPolicy.useMutation({
    onSuccess: async () => {
      toast.success(tr("保留策略已更新。", "Retention policy updated."));
      await retentionPoliciesQuery.refetch();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const runRetentionCleanupMutation = trpc.system.adminRunRetentionCleanup.useMutation({
    onSuccess: async result => {
      toast.success(
        result.dryRun
          ? tr(`演练完成。候选数：${result.totalCandidates}`, `Dry-run done. Candidates: ${result.totalCandidates}`)
          : tr(`清理完成。删除数：${result.deletedMessages}`, `Cleanup done. Deleted: ${result.deletedMessages}`)
      );
      await retentionAuditsQuery.refetch();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const adminUploadHospitalImageMutation = trpc.system.adminUploadHospitalImage.useMutation({
    onSuccess: () => {
      void hospitalsQuery.refetch();
      toast.success(tr("医院封面上传成功。", "Hospital image uploaded."));
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const adminClearHospitalImageMutation = trpc.system.adminClearHospitalImage.useMutation({
    onSuccess: () => {
      void hospitalsQuery.refetch();
      toast.success(tr("医院封面已清除。", "Hospital image removed."));
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });

  const readImageAsDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        const next = String(event.target?.result ?? "");
        if (!next) {
          reject(new Error(tr("文件读取失败，请重试。", "Failed to read file.")));
          return;
        }
        resolve(next);
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error(tr("文件读取失败。", "Failed to read file.")));
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadHospitalImage = async (hospitalId: number, file: File) => {
    if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
      toast.error(tr("无效的医院 ID。", "Invalid hospital ID."));
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(tr("请选择图片文件（支持 jpg/png/webp/gif）。", "Please select an image (jpg/png/webp/gif)."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(tr("图片超过 8MB，请缩小后重试。", "Image is larger than 8MB. Please compress it."));
      return;
    }
    try {
      const imageBase64 = await readImageAsDataUrl(file);
      await adminUploadHospitalImageMutation.mutateAsync({
        hospitalId,
        fileName: file.name,
        contentType: file.type,
        imageBase64,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : tr("上传失败，请稍后重试。", "Upload failed, please try again later.")
      );
    }
  };

  const clearHospitalImage = (hospitalId: number) => {
    if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
      toast.error(tr("无效的医院 ID。", "Invalid hospital ID."));
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(tr("确定要清除该医院的图片？", "Remove this hospital image?"))
    ) {
      return;
    }
    void adminClearHospitalImageMutation.mutateAsync({ hospitalId });
  };

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
      toast.error(tr("请输入有效的预约 ID。", "Please enter a valid appointment ID."));
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

    const reason = manualStatusReason.trim();
    if (reason.length < 3) {
      toast.error(tr("请填写有效原因。", "Please provide a valid reason."));
      return;
    }

    updateStatusMutation.mutate({
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
    });
  };

  const upsertRetentionPolicy = (tier: "free" | "paid") => {
    const raw = tier === "free" ? freeRetentionDaysInput : paidRetentionDaysInput;
    const parsed = Number(raw.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      toast.error(tr("保留天数需在 1 到 3650 之间。", "Retention days must be between 1 and 3650."));
      return;
    }
    const existing = (retentionPoliciesQuery.data ?? []).find(item => item.tier === tier);
    updateRetentionPolicyMutation.mutate({
      tier,
      retentionDays: parsed,
      enabled: existing ? existing.enabled : true,
    });
  };

  const toggleRetentionEnabled = (tier: "free" | "paid", enabled: boolean) => {
    const existing = (retentionPoliciesQuery.data ?? []).find(item => item.tier === tier);
    const retentionDays = existing?.retentionDays ?? (tier === "free" ? 7 : 180);
    updateRetentionPolicyMutation.mutate({
      tier,
      retentionDays,
      enabled,
    });
  };

  const handleCopyDebugSnapshot = async () => {
    if (!appointmentDetailQuery.data) {
      toast.error(tr("没有可复制的预约详情。", "No appointment detail to copy."));
      return;
    }

    const debugPayload = {
      appointmentId: appointmentDetailQuery.data.appointment.id,
      status: appointmentDetailQuery.data.appointment.status,
      paymentStatus: appointmentDetailQuery.data.appointment.paymentStatus,
      stripeSessionId: appointmentDetailQuery.data.appointment.stripeSessionId,
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
      latestWebhookEvents: appointmentDetailQuery.data.webhookEvents.slice(0, 10),
    };
    const textTemplate = [
      `Appointment #${debugPayload.appointmentId}`,
      `Status: ${debugPayload.status}`,
      `Payment: ${debugPayload.paymentStatus}`,
      `Stripe Session: ${debugPayload.stripeSessionId || "-"}`,
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
        error instanceof Error ? error.message : tr("复制调试快照失败。", "Failed to copy debug snapshot.")
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
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        tr(
          "重新发起支付会创建新的结账会话并使旧访问链接失效，是否继续？",
          "Re-initiate payment will create a new checkout session and invalidate old access links. Continue?"
        )
      );
      if (!ok) {
        return false;
      }
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
    if (detail.paymentStatus !== "paid" || !allowedStatuses.has(detail.status)) {
      toast.error(
        tr("仅已支付/进行中的预约支持重发访问链接。", "Access link resend is only available for paid/active appointments.")
      );
      return false;
    }
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        tr(
          "重发访问链接会签发新 token 并给患者发送邮件，是否继续？",
          "Resending access link will issue new token links and send email to patient. Continue?"
        )
      );
      if (!ok) {
        return false;
      }
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
      toast.error(tr("仅支付完成后可签发访问链接。", "Issue link is only available after payment is settled."));
      return false;
    }
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        tr(
          "签发新访问链接会吊销此前有效链接，是否继续？",
          "Issuing new access links will revoke previously active links. Continue?"
        )
      );
      if (!ok) {
        return false;
      }
    }
    return true;
  };

  const runSuggestedAction = (suggestion: AdminSuggestion) => {
    if (!selectedAppointmentId) {
      toast.error(tr("请先加载预约详情。", "Load appointment detail first."));
      return;
    }

    if (suggestion.action === "reinitiate_payment") {
      if (!beforeReinitiatePayment()) return;
      resendPaymentMutation.mutate({ appointmentId: selectedAppointmentId });
      return;
    }
    if (suggestion.action === "resend_access_link") {
      if (!beforeResendAccessLink()) return;
      resendAccessLinkMutation.mutate({ appointmentId: selectedAppointmentId });
      return;
    }
    if (suggestion.action === "issue_access_links") {
      if (!beforeIssueLinks()) return;
      issueLinksMutation.mutate({ appointmentId: selectedAppointmentId });
      return;
    }
    if (suggestion.action === "notify_doctor_followup") {
      notifyDoctorFollowupMutation.mutate({ appointmentId: selectedAppointmentId });
      return;
    }
    if (suggestion.action === "inspect_webhook_timeline") {
      toast.message(tr("请先查看下方 webhook 时间线再执行下一步。", "Review the webhook timeline section below before next action."));
      return;
    }
    toast.message(tr("当前无紧急动作。", "No urgent action required."));
  };

  return {
    emailQuery,
    setEmailQuery,
    statusFilter,
    setStatusFilter,
    paymentStatusFilter,
    setPaymentStatusFilter,
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
    metricsQuery,
    appointmentDetailQuery,
    visitSummaryQuery,
    retentionPoliciesQuery,
    retentionAuditsQuery,
    refreshAdminData,
    resendPaymentMutation,
    resendAccessLinkMutation,
    issueLinksMutation,
    hospitalsQuery,
    adminHospitalImageUploadMutation: {
      isPending: adminUploadHospitalImageMutation.isPending,
      uploadHospitalImage,
    },
    adminHospitalImageClearMutation: {
      isPending: adminClearHospitalImageMutation.isPending,
      clearHospitalImage,
    },
    notifyDoctorFollowupMutation,
    updateStatusMutation,
    generateSummaryMutation,
    exportSummaryPdfMutation,
    updateRetentionPolicyMutation,
    runRetentionCleanupMutation,
    risks,
    suggestions,
    openAppointmentById,
    applyManualStatusUpdate,
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
