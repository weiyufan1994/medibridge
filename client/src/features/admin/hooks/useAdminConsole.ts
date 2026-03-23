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
  downloadTextFile,
  formatDate,
  stringify,
} from "@/features/admin/utils/adminFormatting";
import type {
  AdminBatchActionResult,
  AdminExportScope,
  UseAdminConsoleResult,
} from "@/features/admin/types";

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

const toStatusValue = (value: string | undefined): AdminAppointmentStatus | undefined => {
  if (!value) {
    return undefined;
  }
  if ((VALID_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as AdminAppointmentStatus;
  }
  return undefined;
};
const toPaymentStatusValue = (value: string | undefined): AdminPaymentStatus | undefined => {
  if (!value) {
    return undefined;
  }
  if ((VALID_PAYMENT_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as AdminPaymentStatus;
  }
  return undefined;
};
const toArray = (values: number[]): number[] => Array.from(new Set(values));

export const parseOptionalNonNegativeInteger = (value: string): number | undefined => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
};

export function useAdminConsole({
  canReadAdmin,
  canMutateAdmin,
  canReplayWebhook,
  canResendAccessLink,
  canIssueAccessLinks,
  canNotifyFollowup,
  lang,
  tr,
}: UseAdminConsoleParams): UseAdminConsoleResult {
  const [emailQuery, setEmailQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<
    "createdAt" | "scheduledAt" | "amount" | "status" | "paymentStatus" | "id"
  >("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [doctorIdInput, setDoctorIdInput] = useState("");
  const [amountMinInput, setAmountMinInput] = useState("");
  const [amountMaxInput, setAmountMaxInput] = useState("");
  const [createdAtFrom, setCreatedAtFrom] = useState("");
  const [createdAtTo, setCreatedAtTo] = useState("");
  const [scheduledAtFrom, setScheduledAtFrom] = useState("");
  const [scheduledAtTo, setScheduledAtTo] = useState("");
  const [hasRiskFilter, setHasRiskFilter] = useState(false);
  const [appointmentIdInput, setAppointmentIdInput] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<number[]>([]);
  const [manualStatus, setManualStatus] = useState("active");
  const [manualPaymentStatus, setManualPaymentStatus] = useState("paid");
  const [manualStatusReason, setManualStatusReason] = useState("ops_manual_update");
  const [manualScheduledAt, setManualScheduledAt] = useState("");
  const [operationAuditPage, setOperationAuditPage] = useState(1);
  const [operationAuditOperatorIdInput, setOperationAuditOperatorIdInput] =
    useState("");
  const [operationAuditActionTypeInput, setOperationAuditActionTypeInput] =
    useState("");
  const [operationAuditFrom, setOperationAuditFrom] = useState("");
  const [operationAuditTo, setOperationAuditTo] = useState("");
  const [freeRetentionDaysInput, setFreeRetentionDaysInput] = useState("7");
  const [paidRetentionDaysInput, setPaidRetentionDaysInput] = useState("180");
  const [issuedLinks, setIssuedLinks] = useState<{
    patientLink: string;
    doctorLink: string;
  } | null>(null);
  const [batchLastResult, setBatchLastResult] =
    useState<AdminBatchActionResult[] | null>(DEFAULT_BATCH_RESULT);

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

  const toNumber = (value: string) => parseOptionalNonNegativeInteger(value);

  const toPositiveNumber = (value: string) => {
    const parsed = toNumber(value);
    if (typeof parsed !== "number" || parsed <= 0) {
      return undefined;
    }
    return parsed;
  };

  const toDate = (value: string) => {
    if (!value.trim()) {
      return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  };

  const parseFilters = useMemo(
    () => ({
      page,
      pageSize,
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
      doctorId: toPositiveNumber(doctorIdInput),
      amountMin: toNumber(amountMinInput),
      amountMax: toNumber(amountMaxInput),
      createdAtFrom: toDate(createdAtFrom),
      createdAtTo: toDate(createdAtTo),
      scheduledAtFrom: toDate(scheduledAtFrom),
      scheduledAtTo: toDate(scheduledAtTo),
      hasRisk: hasRiskFilter || undefined,
      sortBy,
      sortDirection,
      emailQuery: emailQuery.trim() || undefined,
    }),
    [
      amountMaxInput,
      amountMinInput,
      createdAtFrom,
      createdAtTo,
      doctorIdInput,
      emailQuery,
      hasRiskFilter,
      page,
      pageSize,
      paymentStatusFilter,
      scheduledAtFrom,
      scheduledAtTo,
      sortBy,
      sortDirection,
      statusFilter,
    ]
  );

  const appointmentsQuery = trpc.system.adminAppointments.useQuery(parseFilters, {
    enabled: canReadAdmin,
  });

  useEffect(() => {
    setPage(current => (current === 1 ? current : 1));
  }, [
    amountMaxInput,
    amountMinInput,
    createdAtFrom,
    createdAtTo,
    doctorIdInput,
    emailQuery,
    hasRiskFilter,
    paymentStatusFilter,
    scheduledAtFrom,
    scheduledAtTo,
    statusFilter,
  ]);

  const resetAppointmentFilters = useCallback(() => {
    setEmailQuery("");
    setStatusFilter("");
    setPaymentStatusFilter("");
    setDoctorIdInput("");
    setAmountMinInput("");
    setAmountMaxInput("");
    setCreatedAtFrom("");
    setCreatedAtTo("");
    setScheduledAtFrom("");
    setScheduledAtTo("");
    setHasRiskFilter(false);
    setSortBy("createdAt");
    setSortDirection("desc");
    setPage(1);
  }, []);
  const rawOperationAuditOperatorId = toNumber(operationAuditOperatorIdInput);
  const operationAuditOperatorId =
    rawOperationAuditOperatorId !== undefined && rawOperationAuditOperatorId > 0
      ? rawOperationAuditOperatorId
      : undefined;
  const operationAuditQuery = trpc.system.adminOperationAudit.useQuery(
    {
      page: operationAuditPage,
      pageSize: 20,
      operatorId: operationAuditOperatorId,
      actionType: operationAuditActionTypeInput.trim() || undefined,
      from: toDate(operationAuditFrom),
      to: toDate(operationAuditTo),
    },
    { enabled: canReadAdmin }
  );
  const triageQuery = trpc.system.adminTriageSessions.useQuery(
    {
      limit: 50,
    },
    { enabled: canReadAdmin }
  );
  const triageRiskEventsQuery = trpc.system.adminTriageRiskEvents.useQuery(
    {
      limit: 50,
    },
    { enabled: canReadAdmin }
  );
  const metricsQuery = trpc.system.metrics.useQuery(undefined, { enabled: canReadAdmin });
  const appointmentDetailQuery = trpc.system.adminAppointmentDetail.useQuery(
    { appointmentId: selectedAppointmentId ?? 0 },
    { enabled: canReadAdmin && typeof selectedAppointmentId === "number" }
  );
  const visitSummaryQuery = trpc.system.adminGetVisitSummary.useQuery(
    { appointmentId: selectedAppointmentId ?? 0 },
    { enabled: canReadAdmin && typeof selectedAppointmentId === "number" }
  );
  const retentionPoliciesQuery = trpc.system.adminRetentionPolicies.useQuery(undefined, {
    enabled: canReadAdmin,
  });
  const hospitalsQuery = trpc.system.adminHospitals.useQuery(undefined, {
    enabled: canReadAdmin,
  });
  const adminUsersQuery = trpc.system.adminUsers.useQuery(
    {
      emailQuery: userSearchQuery.trim() || undefined,
      limit: 50,
    },
    { enabled: canReadAdmin && canMutateAdmin }
  );
  const retentionAuditsQuery = trpc.system.adminRetentionCleanupAudits.useQuery(
    { limit: 20 },
    { enabled: canReadAdmin }
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

  useEffect(() => {
    const scheduledAt = appointmentDetailQuery.data?.appointment.scheduledAt;
    setManualScheduledAt(toDateTimeLocalValue(scheduledAt));
  }, [appointmentDetailQuery.data?.appointment.scheduledAt]);

  const visibleIds = useMemo(
    () => (appointmentsQuery.data?.items ?? []).map(item => item.id),
    [appointmentsQuery.data?.items]
  );
  const selectedAppointmentSet = useMemo(
    () => new Set(selectedAppointmentIds),
    [selectedAppointmentIds]
  );
  const isAllVisibleSelected =
    visibleIds.length > 0 && visibleIds.every(itemId => selectedAppointmentSet.has(itemId));
  const isAnyVisibleSelected = visibleIds.some(itemId => selectedAppointmentSet.has(itemId));

  const isSelected = useCallback(
    (id: number) => selectedAppointmentSet.has(id),
    [selectedAppointmentSet]
  );

  const toggleAppointmentSelection = useCallback(
    (appointmentId: number, checked: boolean) => {
    setSelectedAppointmentIds(prev => {
        const normalized = new Set(prev);
        if (checked) {
          normalized.add(appointmentId);
        } else {
          normalized.delete(appointmentId);
        }
        return Array.from(normalized);
      });
    },
    []
  );

  const toggleSelectAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedAppointmentIds(prev => {
        const normalized = new Set(prev);
        if (checked) {
          visibleIds.forEach(itemId => normalized.add(itemId));
        } else {
          visibleIds.forEach(itemId => normalized.delete(itemId));
        }
        return Array.from(normalized);
      });
    },
    [visibleIds]
  );

  const clearSelection = useCallback(() => {
    setSelectedAppointmentIds([]);
  }, []);

  const refreshAdminData = useCallback(async () => {
    await Promise.all([
      appointmentsQuery.refetch(),
      operationAuditQuery.refetch(),
      triageQuery.refetch(),
      triageRiskEventsQuery.refetch(),
      metricsQuery.refetch(),
      selectedAppointmentId ? appointmentDetailQuery.refetch() : Promise.resolve(),
      selectedAppointmentId ? visitSummaryQuery.refetch() : Promise.resolve(),
      hospitalsQuery.refetch(),
      adminUsersQuery.refetch(),
      retentionPoliciesQuery.refetch(),
      retentionAuditsQuery.refetch(),
    ]);
  }, [
    adminUsersQuery,
    appointmentDetailQuery,
    appointmentsQuery,
    hospitalsQuery,
    metricsQuery,
    operationAuditQuery,
    retentionAuditsQuery,
    retentionPoliciesQuery,
    selectedAppointmentId,
    triageQuery,
    triageRiskEventsQuery,
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
  const updateScheduleMutation = trpc.system.adminUpdateAppointmentSchedule.useMutation({
    onSuccess: async () => {
      toast.success(tr("预约时间已更新。", "Appointment schedule updated."));
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
  const updateUserRoleMutation = trpc.system.adminUpdateUserRole.useMutation({
    onSuccess: async () => {
      toast.success(tr("用户权限已更新。", "User role updated."));
      await adminUsersQuery.refetch();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const runRetentionCleanupMutation = trpc.system.adminRunRetentionCleanup.useMutation({
    onSuccess: async result => {
      const failureReason = (result as { failureReason?: string }).failureReason;
      const toIds = (input: unknown) =>
        Array.isArray(input)
          ? input
              .map(item => (typeof item === "number" ? item : Number(item)))
              .filter(item => Number.isFinite(item))
          : [];
      const freeSamples = toIds((result as { freeSampleIds?: unknown }).freeSampleIds);
      const paidSamples = toIds((result as { paidSampleIds?: unknown }).paidSampleIds);
      if (failureReason) {
        toast.error(
          tr(
            `清理失败：${failureReason}`,
            `Cleanup failed: ${failureReason}`
          )
        );
      } else {
        toast.success(
          result.dryRun
            ? tr(
                `演练完成。候选数：${result.totalCandidates}，样例ID：${freeSamples
                  .concat(paidSamples)
                  .slice(0, 5)
                  .join(", ")}`,
                `Dry-run done. Candidates: ${result.totalCandidates}, sample IDs: ${freeSamples
                  .concat(paidSamples)
                  .slice(0, 5)
                  .join(", ")}`
              )
            : tr(
                `清理完成。删除数：${result.deletedMessages}，样例ID：${freeSamples
                  .concat(paidSamples)
                  .slice(0, 5)
                  .join(", ")}`,
                `Cleanup done. Deleted: ${result.deletedMessages}, sample IDs: ${freeSamples
                  .concat(paidSamples)
                  .slice(0, 5)
                  .join(", ")}`
              )
        );
      }
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
  const adminBatchMutation = trpc.system.adminBatchAppointmentsAction.useMutation({
    onSuccess: result => {
      setBatchLastResult(result.results);
      const msg = tr(
        `批量处理完成：成功 ${result.summary.success}，跳过 ${result.summary.skipped}，失败 ${result.summary.failed}`,
        `Batch done: ${result.summary.success} success, ${result.summary.skipped} skipped, ${result.summary.failed} failed`
      );
      toast.success(msg);
      refreshAdminData().catch(() => {
        toast.error(tr("刷新列表失败，请重试。", "Failed to refresh list. Please retry."));
      });
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const webhookReplayMutation = trpc.system.adminWebhookReplay.useMutation({
    onSuccess: result => {
      if (result.ok) {
        toast.success(
          tr("Webhook 重试成功。", "Webhook replay completed.")
        );
      } else {
        toast.success(tr("Webhook 重试已去重。", "Webhook replay skipped by idempotency."));
      }
      void refreshAdminData();
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const exportMutation = trpc.system.adminExport.useMutation({
    onSuccess: result => {
      downloadTextFile(result.content, result.mimeType, result.filename);
      toast.success(tr("导出完成。", "Export completed."));
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
      latestWebhookEvents: appointmentDetailQuery.data.webhookEvents.slice(0, 10),
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
        tr(
          "仅已支付/进行中的预约支持重发访问链接。",
          "Access link resend is only available for paid/active appointments."
        )
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
      if (!canMutateAdmin) {
        toast.message(tr("当前角色无权执行该动作。", "Current role cannot execute this action."));
        return;
      }
    } else if (suggestion.action === "resend_access_link") {
      if (!canResendAccessLink) {
        toast.message(tr("当前角色无权执行该动作。", "Current role cannot execute this action."));
        return;
      }
    } else if (suggestion.action === "issue_access_links") {
      if (!canIssueAccessLinks) {
        toast.message(tr("当前角色无权执行该动作。", "Current role cannot execute this action."));
        return;
      }
    }

    if (suggestion.action === "notify_doctor_followup" && !canNotifyFollowup) {
      toast.message(tr("当前角色无权执行该动作。", "Current role cannot execute this action."));
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

  const exportScope = (input: {
    scope: AdminExportScope;
    format?: "csv" | "json";
    webhookAppointmentId?: number;
    auditOperatorId?: number;
    auditActionType?: string;
    auditFrom?: string;
    auditTo?: string;
  }) => {
    exportMutation.mutate({
      scope: input.scope,
      format: input.format ?? "csv",
      pageSize,
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
      doctorId: toPositiveNumber(doctorIdInput),
      amountMin: toNumber(amountMinInput),
      amountMax: toNumber(amountMaxInput),
      createdAtFrom: toDate(createdAtFrom),
      createdAtTo: toDate(createdAtTo),
      scheduledAtFrom: toDate(scheduledAtFrom),
      scheduledAtTo: toDate(scheduledAtTo),
      hasRisk: hasRiskFilter || undefined,
      sortBy,
      sortDirection,
      webhookAppointmentId: input.webhookAppointmentId,
      auditOperatorId: input.auditOperatorId,
      auditActionType: input.auditActionType,
      auditFrom: input.auditFrom,
      auditTo: input.auditTo,
    });
  };

  const executeBatch = (input: {
    action: "resend_access_link" | "reinitiate_payment" | "update_status";
    toStatus?: string;
    toPaymentStatus?: string;
    reason?: string;
    idempotencyKey?: string;
  }) => {
    if (selectedAppointmentIds.length === 0) {
      toast.error(tr("请先选择至少一条预约。", "Select at least one appointment."));
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
        toast.message(tr("当前角色无权执行该批量动作。", "Current role cannot execute this batch action."));
        return;
      }
    }

    if (
      validatedInput.action === "reinitiate_payment" ||
      validatedInput.action === "update_status"
    ) {
      if (!canMutateAdmin) {
        toast.message(tr("当前角色无权执行该批量动作。", "Current role cannot execute this batch action."));
        return;
      }
    }

    const normalizedReason =
      typeof validatedInput.reason === "string" && validatedInput.reason.trim().length
        ? validatedInput.reason.trim()
        : "admin_batch_action";
    adminBatchMutation.mutate({
      appointmentIds: toArray(selectedAppointmentIds),
      action: validatedInput.action,
      toStatus: validatedInput.toStatus,
      toPaymentStatus: validatedInput.toPaymentStatus,
      reason: normalizedReason,
      idempotencyKey: validatedInput.idempotencyKey ?? randomUUID(),
    });
  };

  const replayWebhookByEvent = (params: { eventId?: string; appointmentId?: number }) => {
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
    metricsQuery,
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
    exportAppointmentsMutation: {
      isPending: exportMutation.isPending,
      exportScope,
    },
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
