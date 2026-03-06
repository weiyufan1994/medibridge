import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  computeAdminRisks,
  computeAdminSuggestions,
  type AdminSuggestion,
} from "@/features/admin/risk";

function formatDate(value: Date | string | null, locale?: string) {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString(locale);
}

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function toOperatorBadgeClass(operatorType: string) {
  if (operatorType === "admin") {
    return "bg-blue-100 text-blue-700";
  }
  if (operatorType === "webhook") {
    return "bg-amber-100 text-amber-700";
  }
  if (operatorType === "system") {
    return "bg-slate-100 text-slate-700";
  }
  if (operatorType === "patient") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (operatorType === "doctor") {
    return "bg-purple-100 text-purple-700";
  }
  return "bg-slate-100 text-slate-700";
}

function toReasonLabel(reason: string | null | undefined, lang: "zh" | "en") {
  const raw = (reason ?? "").trim();
  if (!raw) {
    return "-";
  }
  const baseReason = raw.includes(":") ? raw.split(":")[0] : raw;

  const map: Record<string, string> = {
    appointment_draft_created: lang === "zh" ? "已创建草稿" : "Draft created",
    checkout_session_created: lang === "zh" ? "已创建支付会话" : "Checkout created",
    stripe_webhook_paid: lang === "zh" ? "Stripe 支付已确认" : "Stripe payment settled",
    payment_reinitiated: lang === "zh" ? "已重启支付" : "Payment re-initiated",
    payment_refunded: lang === "zh" ? "已退款" : "Payment refunded",
    checkout_session_expired: lang === "zh" ? "支付会话已过期" : "Checkout expired",
    payment_failed: lang === "zh" ? "支付失败" : "Payment failed",
    admin_reinitiate_payment: lang === "zh" ? "管理员重启支付" : "Admin re-initiated payment",
    admin_resend_access_link: lang === "zh" ? "管理员重发访问链接" : "Admin resent access link",
    admin_issue_access_links: lang === "zh" ? "管理员签发新访问链接" : "Admin issued new access links",
    admin_status_update: lang === "zh" ? "管理员更新状态" : "Admin updated status",
    appointment_canceled: lang === "zh" ? "预约已取消" : "Appointment canceled",
    payment_link_email_failed: lang === "zh" ? "支付链接邮件发送失败" : "Link email failed",
  };
  if (map[baseReason]) {
    return raw.startsWith(`${baseReason}:`) ? `${map[baseReason]} (${raw.slice(baseReason.length + 1)})` : map[baseReason];
  }
  return raw;
}

function toWebhookTypeLabel(type: string, lang: "zh" | "en") {
  const map: Record<string, string> = {
    "checkout.session.completed": lang === "zh" ? "结账完成" : "Checkout completed",
    "checkout.session.expired": lang === "zh" ? "结账过期" : "Checkout expired",
    "payment_intent.payment_failed": lang === "zh" ? "支付失败" : "Payment failed",
    "charge.refunded": lang === "zh" ? "已退款" : "Charge refunded",
    "refund.updated": lang === "zh" ? "退款更新" : "Refund updated",
    signature_invalid: lang === "zh" ? "签名无效" : "Signature invalid",
    signature_verification_failed:
      lang === "zh" ? "签名校验失败" : "Signature verification failed",
    missing_session_id: lang === "zh" ? "缺少 session id" : "Missing session id",
    malformed_event: lang === "zh" ? "事件格式错误" : "Malformed event",
    db_unavailable: lang === "zh" ? "数据库不可用" : "DB unavailable",
    processing_error: lang === "zh" ? "处理失败" : "Processing error",
    webhook_error_missing_session_id:
      lang === "zh" ? "Webhook 缺少 session id" : "Webhook missing session id",
    webhook_error_processing:
      lang === "zh" ? "Webhook 处理失败" : "Webhook processing error",
  };
  return map[type] ?? type;
}

function toWebhookOutcome(type: string): "success" | "warning" | "failure" {
  const normalized = type.toLowerCase();
  if (
    normalized.includes("failed") ||
    normalized.includes("invalid") ||
    normalized.includes("error") ||
    normalized.includes("malformed") ||
    normalized.includes("unavailable")
  ) {
    return "failure";
  }
  if (normalized.includes("expired") || normalized.includes("refunded")) {
    return "warning";
  }
  return "success";
}

function toWebhookBadgeClass(outcome: "success" | "warning" | "failure") {
  if (outcome === "success") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (outcome === "warning") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-rose-100 text-rose-700";
}

function downloadBase64File(base64: string, mimeType: string, filename: string) {
  if (typeof window === "undefined") {
    return;
  }
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const { resolved } = useLanguage();
  const lang = resolved as "zh" | "en";
  const locale = lang === "zh" ? "zh-CN" : "en-US";
  const tr = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const toUiError = (message?: string) => {
    const raw = (message ?? "").trim();
    if (!raw) {
      return tr("操作失败，请重试。", "Operation failed. Please retry.");
    }
    if (raw === "RETENTION_STORAGE_UNAVAILABLE" || raw.includes("Failed query")) {
      return tr(
        "数据保留策略表不可用。请先执行数据库迁移（含 0020）。",
        "Retention storage is unavailable. Run database migrations (including 0020)."
      );
    }
    return raw;
  };
  const role = (user as { role?: string } | null)?.role;
  const isAdmin = role === "pro" || role === "admin";
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

  const appointmentsQuery = trpc.system.adminAppointments.useQuery({
    limit: 50,
    emailQuery: emailQuery.trim() || undefined,
    status: (statusFilter || undefined) as
      | "draft"
      | "pending_payment"
      | "paid"
      | "active"
      | "ended"
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
  }, { enabled: isAdmin });

  const triageQuery = trpc.system.adminTriageSessions.useQuery({
    limit: 50,
  }, { enabled: isAdmin });

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
      retentionPoliciesQuery.refetch(),
      retentionAuditsQuery.refetch(),
    ]);
  }, [
    appointmentDetailQuery,
    appointmentsQuery,
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
    onSuccess: async () => {
      toast.success(tr("会后总结已生成。", "Visit summary generated."));
      await visitSummaryQuery.refetch();
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

  const risks = useMemo(
    () => computeAdminRisks(appointmentDetailQuery.data),
    [appointmentDetailQuery.data]
  );
  const suggestions = useMemo(
    () => computeAdminSuggestions(appointmentDetailQuery.data, risks),
    [appointmentDetailQuery.data, risks]
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
    const blockedStatuses = new Set(["paid", "active", "ended", "refunded"]);
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

  if (loading) {
    return (
      <AppLayout title={tr("管理后台", "Admin Console")}>
        <div className="mx-auto flex min-h-[40vh] max-w-3xl items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout title={tr("管理后台", "Admin Console")}>
        <div className="mx-auto max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>{tr("无访问权限", "Access denied")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {tr("仅管理员可访问该页面。", "This page is available to admin users only.")}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={tr("管理后台", "Admin Console")}>
      <div className="mx-auto w-full max-w-7xl space-y-6 py-2">
        <Card>
          <CardHeader>
            <CardTitle>{tr("筛选", "Filters")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="w-full max-w-sm space-y-1">
              <p className="text-xs text-muted-foreground">{tr("按邮箱搜索", "Search by email")}</p>
              <Input
                value={emailQuery}
                onChange={event => setEmailQuery(event.target.value)}
                placeholder="patient@example.com"
              />
            </div>
            <div className="w-full max-w-xs space-y-1">
              <p className="text-xs text-muted-foreground">{tr("按 ID 打开预约", "Open appointment by ID")}</p>
              <div className="flex items-center gap-2">
                <Input
                  value={appointmentIdInput}
                  onChange={event => setAppointmentIdInput(event.target.value)}
                  placeholder={tr("例如：123", "e.g. 123")}
                />
                <Button type="button" variant="outline" onClick={openAppointmentById}>
                  {tr("打开", "Open")}
                </Button>
              </div>
            </div>
            <div className="w-full max-w-xs space-y-1">
              <p className="text-xs text-muted-foreground">{tr("预约状态", "Appointment status")}</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
              >
                {appointmentStatusOptions.map(value => (
                  <option key={value} value={value}>
                    {value || tr("全部", "All")}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full max-w-xs space-y-1">
              <p className="text-xs text-muted-foreground">{tr("支付状态", "Payment status")}</p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={paymentStatusFilter}
                onChange={event => setPaymentStatusFilter(event.target.value)}
              >
                {paymentStatusOptions.map(value => (
                  <option key={value} value={value}>
                    {value || tr("全部", "All")}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refreshAdminData();
              }}
            >
              {tr("刷新", "Refresh")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr("预约列表（最新 50 条）", "Appointments (Latest 50)")}</CardTitle>
          </CardHeader>
          <CardContent>
            {appointmentsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在加载预约...", "Loading appointments...")}
              </div>
            ) : appointmentsQuery.error ? (
              <p className="text-sm text-destructive">{appointmentsQuery.error.message}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-2 text-left">ID</th>
                      <th className="px-2 py-2 text-left">Email</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">{tr("支付", "Payment")}</th>
                      <th className="px-2 py-2 text-left">Amount</th>
                      <th className="px-2 py-2 text-left">{tr("医生", "Doctor")}</th>
                      <th className="px-2 py-2 text-left">{tr("分诊会话", "Triage Session")}</th>
                      <th className="px-2 py-2 text-left">{tr("创建时间", "Created")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(appointmentsQuery.data ?? []).map(item => (
                      <tr
                        key={item.id}
                        className="cursor-pointer border-b hover:bg-slate-50"
                        onClick={() => {
                          setSelectedAppointmentId(item.id);
                          setIssuedLinks(null);
                        }}
                      >
                        <td className="px-2 py-2">{item.id}</td>
                        <td className="px-2 py-2">{item.email}</td>
                        <td className="px-2 py-2">{item.status}</td>
                        <td className="px-2 py-2">{item.paymentStatus}</td>
                        <td className="px-2 py-2">
                          {item.amount} {item.currency.toUpperCase()}
                        </td>
                        <td className="px-2 py-2">{item.doctorId}</td>
                        <td className="px-2 py-2">{item.triageSessionId}</td>
                        <td className="px-2 py-2">{formatDate(item.createdAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Appointment Detail
              {selectedAppointmentId ? ` #${selectedAppointmentId}` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedAppointmentId ? (
              <p className="text-sm text-muted-foreground">
                {tr("点击一条预约记录查看详情与可执行动作。", "Click an appointment row to view details and admin actions.")}
              </p>
            ) : appointmentDetailQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在加载预约详情...", "Loading appointment detail...")}
              </div>
            ) : appointmentDetailQuery.error ? (
              <p className="text-sm text-destructive">{appointmentDetailQuery.error.message}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <p>
                    <span className="font-medium">Email: </span>
                    {appointmentDetailQuery.data?.appointment.email}
                  </p>
                  <p>
                    <span className="font-medium">Status: </span>
                    {appointmentDetailQuery.data?.appointment.status}
                  </p>
                  <p>
                    <span className="font-medium">Payment: </span>
                    {appointmentDetailQuery.data?.appointment.paymentStatus}
                  </p>
                  <p>
                    <span className="font-medium">Amount: </span>
                    {appointmentDetailQuery.data?.appointment.amount}{" "}
                    {appointmentDetailQuery.data?.appointment.currency.toUpperCase()}
                  </p>
                  <p>
                    <span className="font-medium">Scheduled: </span>
                    {formatDate(appointmentDetailQuery.data?.appointment.scheduledAt ?? null, locale)}
                  </p>
                  <p>
                    <span className="font-medium">Paid at: </span>
                    {formatDate(appointmentDetailQuery.data?.appointment.paidAt ?? null, locale)}
                  </p>
                </div>

                {risks.length > 0 ? (
                  <div className="space-y-2 rounded border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-900">{tr("风险提示", "Risk Alerts")}</p>
                    <div className="space-y-1">
                      {risks.map(risk => (
                        <p
                          key={risk.code}
                          className={
                            risk.level === "critical"
                              ? "text-xs text-rose-700"
                              : "text-xs text-amber-800"
                          }
                        >
                          [{risk.level}] {risk.message}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2 rounded border border-sky-200 bg-sky-50 p-3">
                  <p className="text-sm font-medium text-sky-900">{tr("建议动作", "Recommended Actions")}</p>
                  <div className="space-y-2">
                    {suggestions.map(suggestion => (
                      <div
                        key={suggestion.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-sky-100 bg-white p-2"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-medium text-slate-900">
                            {suggestion.title}
                          </p>
                          <p className="text-xs text-slate-600">{suggestion.detail}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => runSuggestedAction(suggestion)}
                        >
                          {tr("执行", "Run")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">{tr("医生 / 分诊信息", "Doctor / Triage")}</p>
                  <p className="text-sm text-muted-foreground">
                    Doctor:{" "}
                    {appointmentDetailQuery.data?.doctor
                      ? `${appointmentDetailQuery.data.doctor.name} (${appointmentDetailQuery.data.doctor.departmentName})`
                      : tr("未知", "Unknown")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Triage summary:{" "}
                    {appointmentDetailQuery.data?.triageSession?.summary || "-"}
                  </p>
                </div>

                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">{tr("诊前信息", "Intake")}</p>
                  {appointmentDetailQuery.data?.intake ? (
                    <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs">
                      {JSON.stringify(appointmentDetailQuery.data.intake, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tr("暂无诊前信息。", "No intake data.")}</p>
                  )}
                </div>

                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">{tr("有效访问令牌", "Active Tokens")}</p>
                  {appointmentDetailQuery.data?.activeTokens?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="px-2 py-1 text-left">Role</th>
                            <th className="px-2 py-1 text-left">Uses</th>
                            <th className="px-2 py-1 text-left">Last Used</th>
                            <th className="px-2 py-1 text-left">Expires</th>
                            <th className="px-2 py-1 text-left">IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointmentDetailQuery.data.activeTokens.map(token => (
                            <tr key={token.id} className="border-b">
                              <td className="px-2 py-1">{token.role}</td>
                              <td className="px-2 py-1">
                                {token.useCount}/{token.maxUses}
                              </td>
                              <td className="px-2 py-1">{formatDate(token.lastUsedAt, locale)}</td>
                              <td className="px-2 py-1">{formatDate(token.expiresAt, locale)}</td>
                              <td className="px-2 py-1">{token.ipFirstSeen || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tr("暂无有效令牌。", "No active tokens.")}</p>
                  )}
                </div>

                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">{tr("状态时间线", "Status Timeline")}</p>
                  {appointmentDetailQuery.data?.statusEvents?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="px-2 py-1 text-left">Time</th>
                            <th className="px-2 py-1 text-left">From</th>
                            <th className="px-2 py-1 text-left">To</th>
                            <th className="px-2 py-1 text-left">Operator</th>
                            <th className="px-2 py-1 text-left">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointmentDetailQuery.data.statusEvents.map(event => (
                            <tr key={event.id} className="border-b">
                              <td className="px-2 py-1">{formatDate(event.createdAt, locale)}</td>
                              <td className="px-2 py-1">{event.fromStatus || "-"}</td>
                              <td className="px-2 py-1">{event.toStatus}</td>
                              <td className="px-2 py-1">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toOperatorBadgeClass(event.operatorType)}`}
                                >
                                  {event.operatorType}
                                  {typeof event.operatorId === "number"
                                    ? `:${event.operatorId}`
                                    : ""}
                                </span>
                              </td>
                              <td className="px-2 py-1">{toReasonLabel(event.reason, lang)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tr("暂无状态事件。", "No status events.")}</p>
                  )}
                </div>

                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">{tr("Stripe Webhook 事件", "Stripe Webhook Events")}</p>
                  {appointmentDetailQuery.data?.webhookEvents?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-xs">
                        <thead>
                          <tr className="border-b">
                            <th className="px-2 py-1 text-left">Time</th>
                            <th className="px-2 py-1 text-left">Event ID</th>
                            <th className="px-2 py-1 text-left">Type</th>
                            <th className="px-2 py-1 text-left">Outcome</th>
                            <th className="px-2 py-1 text-left">Stripe Session</th>
                            <th className="px-2 py-1 text-left">Appointment</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointmentDetailQuery.data.webhookEvents.map(event => {
                            const outcome = toWebhookOutcome(event.type);
                            return (
                              <tr key={event.eventId} className="border-b">
                                <td className="px-2 py-1">{formatDate(event.createdAt, locale)}</td>
                                <td className="px-2 py-1">{event.eventId}</td>
                                <td className="px-2 py-1">{toWebhookTypeLabel(event.type, lang)}</td>
                                <td className="px-2 py-1">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${toWebhookBadgeClass(outcome)}`}
                                  >
                                    {outcome}
                                  </span>
                                </td>
                                <td className="px-2 py-1">{event.stripeSessionId || "-"}</td>
                                <td className="px-2 py-1">{event.appointmentId ?? "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tr("暂无 webhook 事件。", "No webhook events.")}</p>
                  )}
                </div>

                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">{tr("最近会诊消息", "Recent Visit Messages")}</p>
                  {appointmentDetailQuery.data?.recentMessages?.length ? (
                    <div className="max-h-64 overflow-auto rounded border">
                      <table className="w-full min-w-[980px] text-xs">
                        <thead>
                          <tr className="border-b bg-slate-50">
                            <th className="px-2 py-1 text-left">Time</th>
                            <th className="px-2 py-1 text-left">Sender</th>
                            <th className="px-2 py-1 text-left">Displayed</th>
                            <th className="px-2 py-1 text-left">Original</th>
                            <th className="px-2 py-1 text-left">Lang</th>
                          </tr>
                        </thead>
                        <tbody>
                          {appointmentDetailQuery.data.recentMessages.map(message => (
                            <tr key={message.id} className="border-b align-top">
                              <td className="px-2 py-1 whitespace-nowrap">
                                {formatDate(message.createdAt, locale)}
                              </td>
                              <td className="px-2 py-1">{message.senderType}</td>
                              <td className="px-2 py-1 max-w-[320px] break-words">
                                {message.translatedContent || message.content || "-"}
                              </td>
                              <td className="px-2 py-1 max-w-[320px] break-words">
                                {message.originalContent || "-"}
                              </td>
                              <td className="px-2 py-1 whitespace-nowrap">
                                {(message.sourceLanguage || "auto") +
                                  " -> " +
                                  (message.targetLanguage || "auto")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tr("暂无会诊消息。", "No visit messages yet.")}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      selectedAppointmentId &&
                      beforeReinitiatePayment() &&
                      resendPaymentMutation.mutate({
                        appointmentId: selectedAppointmentId,
                      })
                    }
                    disabled={resendPaymentMutation.isPending}
                  >
                    {resendPaymentMutation.isPending
                      ? tr("正在打开支付页...", "Opening checkout...")
                      : tr("重新发起支付", "Re-initiate Payment")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      selectedAppointmentId &&
                      beforeResendAccessLink() &&
                      resendAccessLinkMutation.mutate({
                        appointmentId: selectedAppointmentId,
                      })
                    }
                    disabled={resendAccessLinkMutation.isPending}
                  >
                    {resendAccessLinkMutation.isPending
                      ? tr("发送中...", "Sending...")
                      : tr("重发访问链接邮件", "Resend Access Link Email")}
                  </Button>
                  <Button
                    type="button"
                    onClick={() =>
                      selectedAppointmentId &&
                      beforeIssueLinks() &&
                      issueLinksMutation.mutate({
                        appointmentId: selectedAppointmentId,
                      })
                    }
                    disabled={issueLinksMutation.isPending}
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

                <div className="space-y-2 rounded border p-3">
                  <p className="text-sm font-medium">{tr("手动状态更新", "Manual Status Update")}</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={manualStatus}
                      onChange={event => setManualStatus(event.target.value)}
                    >
                      {appointmentStatusOptions
                        .filter(option => option)
                        .map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                    </select>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={manualPaymentStatus}
                      onChange={event => setManualPaymentStatus(event.target.value)}
                    >
                      {paymentStatusOptions
                        .filter(option => option)
                        .map(option => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                    </select>
                    <Input
                      value={manualStatusReason}
                      onChange={event => setManualStatusReason(event.target.value)}
                      placeholder={tr("原因", "reason")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={applyManualStatusUpdate}
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending
                        ? tr("更新中...", "Updating...")
                        : tr("应用状态", "Apply Status")}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 rounded border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{tr("会后总结（中/英）", "Post-Visit Summary (ZH/EN)")}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          selectedAppointmentId &&
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
                          selectedAppointmentId &&
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
                          selectedAppointmentId &&
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
                    <p className="text-sm text-muted-foreground">{tr("正在加载总结...", "Loading summary...")}</p>
                  ) : visitSummaryQuery.data ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="rounded bg-slate-50 p-2">
                        <p className="mb-1 text-xs font-medium text-slate-700">中文</p>
                        <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs">
                          {visitSummaryQuery.data.summaryZh}
                        </pre>
                      </div>
                      <div className="rounded bg-slate-50 p-2">
                        <p className="mb-1 text-xs font-medium text-slate-700">English</p>
                        <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs">
                          {visitSummaryQuery.data.summaryEn}
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
                  <div className="rounded border bg-slate-50 p-3 text-xs">
                    <p className="font-medium">Issued Links</p>
                    <p className="mt-1 break-all">Patient: {issuedLinks.patientLink}</p>
                    <p className="mt-1 break-all">Doctor: {issuedLinks.doctorLink}</p>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr("AI 分诊会话（最新 50 条）", "AI Triage Sessions (Latest 50)")}</CardTitle>
          </CardHeader>
          <CardContent>
            {triageQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在加载分诊会话...", "Loading triage sessions...")}
              </div>
            ) : triageQuery.error ? (
              <p className="text-sm text-destructive">{triageQuery.error.message}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-2 py-2 text-left">ID</th>
                      <th className="px-2 py-2 text-left">User ID</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Created</th>
                      <th className="px-2 py-2 text-left">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(triageQuery.data ?? []).map(item => (
                      <tr key={item.id} className="border-b">
                        <td className="px-2 py-2">{item.id}</td>
                        <td className="px-2 py-2">{item.userId ?? "-"}</td>
                        <td className="px-2 py-2">{item.status}</td>
                        <td className="px-2 py-2">{formatDate(item.createdAt, locale)}</td>
                        <td className="px-2 py-2">{formatDate(item.updatedAt, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr("风险指标", "Risk Metrics")}</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在加载指标...", "Loading metrics...")}
              </div>
            ) : metricsQuery.error ? (
              <p className="text-sm text-destructive">{metricsQuery.error.message}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {tr("生成时间", "Generated at")}: {metricsQuery.data?.generatedAt}
                </p>
                <div className="max-h-64 overflow-auto rounded border p-2">
                  <pre className="text-xs">
                    {JSON.stringify(metricsQuery.data?.counters ?? [], null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{tr("数据保留策略与清理", "Retention Strategy & Cleanup")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {retentionPoliciesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在加载保留策略...", "Loading retention policies...")}
              </div>
            ) : retentionPoliciesQuery.error ? (
              <p className="text-sm text-destructive">
                {toUiError(retentionPoliciesQuery.error.message)}
              </p>
            ) : (
              <div className="space-y-3 rounded border p-3">
                {(retentionPoliciesQuery.data ?? []).map(policy => (
                  <div
                    key={policy.tier}
                    className="grid grid-cols-1 gap-2 rounded border bg-slate-50 p-2 md:grid-cols-5 md:items-center"
                  >
                    <p className="text-sm font-medium">
                      {policy.tier === "free"
                        ? tr("免费用户（短期）", "Free (short-term)")
                        : tr("付费用户（长期）", "Paid (long-term)")}
                    </p>
                    <Input
                      value={
                        policy.tier === "free"
                          ? freeRetentionDaysInput
                          : paidRetentionDaysInput
                      }
                      onChange={event =>
                        policy.tier === "free"
                          ? setFreeRetentionDaysInput(event.target.value)
                          : setPaidRetentionDaysInput(event.target.value)
                      }
                      placeholder={tr("保留天数", "Retention days")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => upsertRetentionPolicy(policy.tier)}
                      disabled={updateRetentionPolicyMutation.isPending}
                    >
                      {tr("保存天数", "Save Days")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggleRetentionEnabled(policy.tier, !policy.enabled)}
                      disabled={updateRetentionPolicyMutation.isPending}
                    >
                      {policy.enabled ? tr("禁用", "Disable") : tr("启用", "Enable")}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {tr("更新时间", "Updated")}: {formatDate(policy.updatedAt, locale)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => runRetentionCleanupMutation.mutate({ dryRun: true })}
                disabled={runRetentionCleanupMutation.isPending}
              >
                {runRetentionCleanupMutation.isPending
                  ? tr("运行中...", "Running...")
                  : tr("执行演练清理", "Run Dry-Run Cleanup")}
              </Button>
              <Button
                type="button"
                onClick={() => runRetentionCleanupMutation.mutate({ dryRun: false })}
                disabled={runRetentionCleanupMutation.isPending}
              >
                {runRetentionCleanupMutation.isPending
                  ? tr("运行中...", "Running...")
                  : tr("执行真实清理", "Run Real Cleanup")}
              </Button>
            </div>

            <div className="space-y-2 rounded border p-3">
              <p className="text-sm font-medium">{tr("清理审计日志", "Cleanup Audit Log")}</p>
              {retentionAuditsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">
                  {tr("正在加载清理审计日志...", "Loading cleanup audits...")}
                </p>
              ) : retentionAuditsQuery.error ? (
                <p className="text-sm text-destructive">
                  {toUiError(retentionAuditsQuery.error.message)}
                </p>
              ) : (retentionAuditsQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {tr("暂无清理审计日志。", "No cleanup audits yet.")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="px-2 py-1 text-left">Time</th>
                        <th className="px-2 py-1 text-left">Mode</th>
                        <th className="px-2 py-1 text-left">Candidates</th>
                        <th className="px-2 py-1 text-left">Deleted</th>
                        <th className="px-2 py-1 text-left">Policy</th>
                        <th className="px-2 py-1 text-left">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(retentionAuditsQuery.data ?? []).map(item => (
                        <tr key={item.id} className="border-b align-top">
                          <td className="px-2 py-1 whitespace-nowrap">
                            {formatDate(item.createdAt, locale)}
                          </td>
                          <td className="px-2 py-1">{item.dryRun ? "dry-run" : "real"}</td>
                          <td className="px-2 py-1">
                            {String((item.detailsJson as { totalCandidates?: number })?.totalCandidates ?? "-")}
                          </td>
                          <td className="px-2 py-1">{item.deletedMessages}</td>
                          <td className="px-2 py-1">
                            free={item.freeRetentionDays}d, paid={item.paidRetentionDays}d
                          </td>
                          <td className="px-2 py-1">
                            <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-[11px]">
                              {JSON.stringify(item.detailsJson ?? {}, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
