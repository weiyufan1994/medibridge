import { getLocalizedText } from "@/lib/i18n";
import type { BookingWorkspaceLang } from "@/features/booking/types";

const BOOKING_WORKSPACE_COPY = {
  header: {
    title: {
      zh: "预约工作台",
      en: "Booking Workspace",
    },
    description: {
      zh: "把筛选、批量处理、详情诊断和高频动作收拢到一个高密度的运营界面里。",
      en: "Bring filters, batch processing, diagnostics, and high-frequency actions into one dense operating workspace.",
    },
  },
  stats: {
    total: { zh: "总预约", en: "Total" },
    selected: { zh: "已选", en: "Selected" },
    risk: { zh: "风险预约", en: "At risk" },
  },
  toolbar: {
    email: { zh: "邮箱搜索", en: "Email search" },
    emailPlaceholder: { zh: "patient@example.com", en: "patient@example.com" },
    appointmentIdPlaceholder: { zh: "例如：123", en: "e.g. 123" },
    status: { zh: "预约状态", en: "Booking status" },
    all: { zh: "全部", en: "All" },
    scheduledFrom: { zh: "预约时间从", en: "Scheduled from" },
    scheduledTo: { zh: "预约时间到", en: "Scheduled to" },
    moreFilters: { zh: "更多筛选", en: "More filters" },
    lessFilters: { zh: "收起筛选", en: "Hide filters" },
    riskOnly: { zh: "仅风险预约", en: "Risk only" },
    paymentStatus: { zh: "支付状态", en: "Payment status" },
    appointmentId: { zh: "预约 ID", en: "Appointment ID" },
    open: { zh: "打开", en: "Open" },
    doctorId: { zh: "医生 ID", en: "Doctor ID" },
    amountRange: { zh: "金额区间（分）", en: "Amount range (minor unit)" },
    minPlaceholder: { zh: "最低", en: "Min" },
    maxPlaceholder: { zh: "最高", en: "Max" },
    createdFrom: { zh: "创建时间从", en: "Created from" },
    createdTo: { zh: "创建时间到", en: "Created to" },
    sortBy: { zh: "排序字段", en: "Sort by" },
    sortDirection: { zh: "排序方向", en: "Direction" },
    pageSize: { zh: "每页条数", en: "Page size" },
    refresh: { zh: "刷新", en: "Refresh" },
    reset: { zh: "重置", en: "Reset" },
    batchActions: { zh: "批量操作", en: "Batch actions" },
    bulkStatus: { zh: "批量状态更新", en: "Batch status update" },
    targetStatus: { zh: "目标状态", en: "Target status" },
    targetPayment: { zh: "目标支付", en: "Target payment" },
    reason: { zh: "原因", en: "Reason" },
    apply: { zh: "应用", en: "Apply" },
    cancel: { zh: "取消", en: "Cancel" },
    clearSelection: { zh: "清空选择", en: "Clear selection" },
    prev: { zh: "上一页", en: "Prev" },
    next: { zh: "下一页", en: "Next" },
    page: { zh: "页码", en: "Page" },
    noSelection: {
      zh: "请先选择预约。",
      en: "Select at least one booking first.",
    },
    linkPermissionHint: {
      zh: "仅管理员与 ops 可重发访问链接。",
      en: "Only admin/ops can resend access links.",
    },
    paymentPermissionHint: {
      zh: "仅管理员可重新发起支付。",
      en: "Only admin can re-initiate payment.",
    },
    statusPermissionHint: {
      zh: "仅管理员可执行批量状态更新。",
      en: "Only admin can run batch status updates.",
    },
    resendLinks: { zh: "批量重发链接", en: "Batch resend links" },
    reinitiatePayment: {
      zh: "批量重新发起支付",
      en: "Batch re-initiate payment",
    },
    desc: { zh: "倒序", en: "Desc" },
    asc: { zh: "正序", en: "Asc" },
    sortLabels: {
      createdAt: { zh: "创建时间", en: "Created time" },
      scheduledAt: { zh: "预约时间", en: "Scheduled time" },
      amount: { zh: "金额", en: "Amount" },
      status: { zh: "状态", en: "Status" },
      paymentStatus: { zh: "支付状态", en: "Payment status" },
      id: { zh: "ID", en: "ID" },
    },
  },
  list: {
    title: { zh: "预约列表", en: "Booking queue" },
    loading: { zh: "正在加载预约列表...", en: "Loading bookings..." },
    empty: {
      zh: "当前筛选条件下没有预约。",
      en: "No bookings found for the current filters.",
    },
    created: { zh: "创建", en: "Created" },
    scheduled: { zh: "预约", en: "Scheduled" },
    doctor: { zh: "医生", en: "Doctor" },
    noDoctor: { zh: "未分配", en: "Unassigned" },
    riskFlag: { zh: "风险", en: "Risk" },
    selectedCount: { zh: "当前页选择", en: "Selected on page" },
    latestBatchResult: { zh: "最近批量结果", en: "Latest batch result" },
  },
  detail: {
    title: { zh: "预约详情", en: "Booking detail" },
    tabs: {
      summary: { zh: "预约摘要", en: "Summary" },
      diagnostics: { zh: "诊断与日志", en: "Diagnostics & logs" },
      actions: { zh: "处理操作", en: "Actions" },
    },
    empty: {
      zh: "从左侧选择一条预约，查看详细诊断与操作。",
      en: "Select a booking on the left to inspect diagnostics and actions.",
    },
    loading: { zh: "正在加载预约详情...", en: "Loading booking detail..." },
    metaEmail: { zh: "邮箱", en: "Email" },
    metaStatus: { zh: "状态", en: "Status" },
    metaPayment: { zh: "支付", en: "Payment" },
    metaTime: { zh: "预约时间", en: "Scheduled" },
    metaAmount: { zh: "金额", en: "Amount" },
    footerHint: {
      zh: "高频操作固定在底部，便于在长诊断页面中快速执行。",
      en: "High-frequency actions stay pinned so operators can act quickly during long reviews.",
    },
  },
  footer: {
    generateSummaryEn: { zh: "生成英文总结", en: "Generate EN summary" },
    generateSummaryEnPending: { zh: "生成中...", en: "Generating..." },
    resendLink: { zh: "重发链接", en: "Resend link" },
    resendLinkPending: { zh: "发送中...", en: "Sending..." },
    resendLinkDisabled: {
      zh: "仅管理员与 ops 可重发访问链接。",
      en: "Only admin/ops can resend access links.",
    },
    reinitiatePayment: { zh: "重新发起支付", en: "Re-initiate payment" },
    reinitiatePaymentPending: { zh: "处理中...", en: "Processing..." },
    reinitiatePaymentDisabled: {
      zh: "仅管理员可重新发起支付。",
      en: "Only admin can re-initiate payment.",
    },
  },
  status: {
    unknown: { zh: "未知", en: "Unknown" },
    riskOnly: { zh: "风险预约", en: "Risk booking" },
  },
} as const;

type BookingWorkspaceCopyShape = typeof BOOKING_WORKSPACE_COPY;
type LocalizedLeaf = { zh: string; en: string };
type DeepLocalized<TValue> = TValue extends LocalizedLeaf
  ? string
  : TValue extends Record<string, unknown>
    ? { [TKey in keyof TValue]: DeepLocalized<TValue[TKey]> }
    : TValue;

function localizeObject<TValue extends Record<string, unknown>>(
  lang: BookingWorkspaceLang,
  value: TValue
): TValue {
  const output = {} as TValue;

  for (const key of Object.keys(value) as Array<keyof TValue>) {
    const entry = value[key];
    if (
      entry &&
      typeof entry === "object" &&
      "zh" in (entry as Record<string, unknown>) &&
      "en" in (entry as Record<string, unknown>)
    ) {
      output[key] = getLocalizedText({
        lang,
        value: entry as unknown as { zh: string; en: string },
      }) as TValue[keyof TValue];
      continue;
    }

    if (entry && typeof entry === "object") {
      output[key] = localizeObject(
        lang,
        entry as Record<string, unknown>
      ) as TValue[keyof TValue];
      continue;
    }

    output[key] = entry;
  }

  return output;
}

export function getBookingWorkspaceCopy(lang: BookingWorkspaceLang) {
  return localizeObject(
    lang,
    BOOKING_WORKSPACE_COPY
  ) as unknown as DeepLocalized<BookingWorkspaceCopyShape>;
}
