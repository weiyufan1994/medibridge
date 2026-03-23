import type { LocalizedText } from "@shared/types";

export type AdminLang = "zh" | "en";

type LocalizedOption<TValue extends string> = {
  value: TValue;
  label: LocalizedText;
};

const REASON_LABELS: Record<string, LocalizedText> = {
  appointment_draft_created: { zh: "已创建草稿", en: "Draft created" },
  checkout_session_created: { zh: "已创建支付会话", en: "Checkout created" },
  stripe_webhook_paid: { zh: "Stripe 支付已确认", en: "Stripe payment settled" },
  payment_reinitiated: { zh: "已重启支付", en: "Payment re-initiated" },
  payment_refunded: { zh: "已退款", en: "Payment refunded" },
  checkout_session_expired: { zh: "支付会话已过期", en: "Checkout expired" },
  payment_failed: { zh: "支付失败", en: "Payment failed" },
  admin_reinitiate_payment: { zh: "管理员重启支付", en: "Admin re-initiated payment" },
  admin_resend_access_link: { zh: "管理员重发访问链接", en: "Admin resent access link" },
  admin_issue_access_links: { zh: "管理员签发新访问链接", en: "Admin issued new access links" },
  admin_status_update: { zh: "管理员更新状态", en: "Admin updated status" },
  appointment_canceled: { zh: "预约已取消", en: "Appointment canceled" },
  payment_link_email_failed: { zh: "支付链接邮件发送失败", en: "Link email failed" },
};

const WEBHOOK_TYPE_LABELS: Record<string, LocalizedText> = {
  "checkout.session.completed": { zh: "结账完成", en: "Checkout completed" },
  "checkout.session.expired": { zh: "结账过期", en: "Checkout expired" },
  "payment_intent.payment_failed": { zh: "支付失败", en: "Payment failed" },
  "charge.refunded": { zh: "已退款", en: "Charge refunded" },
  "refund.updated": { zh: "退款更新", en: "Refund updated" },
  signature_invalid: { zh: "签名无效", en: "Signature invalid" },
  signature_verification_failed: { zh: "签名校验失败", en: "Signature verification failed" },
  missing_session_id: { zh: "缺少 session id", en: "Missing session id" },
  malformed_event: { zh: "事件格式错误", en: "Malformed event" },
  db_unavailable: { zh: "数据库不可用", en: "DB unavailable" },
  processing_error: { zh: "处理失败", en: "Processing error" },
  webhook_error_missing_session_id: {
    zh: "Webhook 缺少 session id",
    en: "Webhook missing session id",
  },
  webhook_error_processing: {
    zh: "Webhook 处理失败",
    en: "Webhook processing error",
  },
};

const APPOINTMENT_TYPE_OPTIONS: ReadonlyArray<
  LocalizedOption<"online_chat" | "video_call" | "in_person">
> = [
  { value: "online_chat", label: { zh: "图文问诊", en: "Online Chat" } },
  { value: "video_call", label: { zh: "视频问诊", en: "Video Call" } },
  { value: "in_person", label: { zh: "线下面诊", en: "In Person" } },
];

const WEEKDAY_OPTIONS: ReadonlyArray<LocalizedOption<"0" | "1" | "2" | "3" | "4" | "5" | "6">> =
  [
    { value: "0", label: { zh: "周日", en: "Sunday" } },
    { value: "1", label: { zh: "周一", en: "Monday" } },
    { value: "2", label: { zh: "周二", en: "Tuesday" } },
    { value: "3", label: { zh: "周三", en: "Wednesday" } },
    { value: "4", label: { zh: "周四", en: "Thursday" } },
    { value: "5", label: { zh: "周五", en: "Friday" } },
    { value: "6", label: { zh: "周六", en: "Saturday" } },
  ];

const EXCEPTION_ACTION_OPTIONS: ReadonlyArray<
  LocalizedOption<"block" | "extend" | "replace">
> = [
  { value: "block", label: { zh: "停诊/封盘", en: "Block" } },
  { value: "extend", label: { zh: "加班扩容", en: "Extend" } },
  { value: "replace", label: { zh: "替换时段", en: "Replace" } },
];

export function getAdminText(lang: AdminLang, text: LocalizedText) {
  return lang === "zh" ? text.zh : text.en;
}

export function getAdminReasonLabel(reason: string | null | undefined, lang: AdminLang) {
  const raw = (reason ?? "").trim();
  if (!raw) {
    return "-";
  }
  const baseReason = raw.includes(":") ? raw.split(":")[0] : raw;
  const localized = REASON_LABELS[baseReason];
  if (!localized) {
    return raw;
  }
  const label = getAdminText(lang, localized);
  return raw.startsWith(`${baseReason}:`) ? `${label} (${raw.slice(baseReason.length + 1)})` : label;
}

export function getAdminWebhookTypeLabel(type: string, lang: AdminLang) {
  const localized = WEBHOOK_TYPE_LABELS[type];
  return localized ? getAdminText(lang, localized) : type;
}

export function getAppointmentTypeOptions(lang: AdminLang) {
  return APPOINTMENT_TYPE_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

export function getWeekdayOptions(lang: AdminLang) {
  return WEEKDAY_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

export function getWeekdayLabel(value: string, lang: AdminLang) {
  const option = WEEKDAY_OPTIONS.find(item => item.value === value);
  return option ? getAdminText(lang, option.label) : value;
}

export function getExceptionActionOptions(lang: AdminLang) {
  return EXCEPTION_ACTION_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

const RISK_MESSAGES: Record<string, LocalizedText> = {
  PENDING_PAYMENT_TIMEOUT: {
    zh: "支付待处理超过 30 分钟。",
    en: "Payment has been pending for over 30 minutes.",
  },
  TOKEN_EXPIRING_SOON: {
    zh: "至少有一个有效访问令牌将在 2 小时内过期。",
    en: "At least one active access token expires within 2 hours.",
  },
  TOKEN_USAGE_EXHAUSTED: {
    zh: "有一个活跃令牌已达最大使用次数，可能会阻止进入会诊室。",
    en: "An active token reached max uses and may block room access.",
  },
  WEBHOOK_FAILURE: {
    zh: "支付时间线中检测到 Webhook 失败事件。",
    en: "Webhook failure events detected in payment timeline.",
  },
  PAID_BUT_NOT_ACTIVE: {
    zh: "在未激活状态下已产生会诊消息。",
    en: "Messages exist while appointment is not active yet.",
  },
};

export function getAdminRiskMessage(
  code: keyof typeof RISK_MESSAGES | "DOCTOR_REPLY_SLA_OVERDUE",
  lang: AdminLang,
  params?: { waitingMinutes?: number }
) {
  if (code === "PENDING_PAYMENT_TIMEOUT") return getAdminText(lang, RISK_MESSAGES.PENDING_PAYMENT_TIMEOUT);
  if (code === "TOKEN_EXPIRING_SOON") return getAdminText(lang, RISK_MESSAGES.TOKEN_EXPIRING_SOON);
  if (code === "TOKEN_USAGE_EXHAUSTED") return getAdminText(lang, RISK_MESSAGES.TOKEN_USAGE_EXHAUSTED);
  if (code === "WEBHOOK_FAILURE") return getAdminText(lang, RISK_MESSAGES.WEBHOOK_FAILURE);
  if (code === "PAID_BUT_NOT_ACTIVE") return getAdminText(lang, RISK_MESSAGES.PAID_BUT_NOT_ACTIVE);
  const waitingMinutes = params?.waitingMinutes ?? 0;
  return lang === "zh"
    ? `医生回复超时：患者已等待 ${waitingMinutes} 分钟。`
    : `Doctor reply SLA overdue: patient has waited ${waitingMinutes} minutes.`;
}

const SUGGESTION_COPY = {
  suggest_reinitiate_payment: {
    title: { zh: "重发起支付流程", en: "Re-initiate checkout" },
    detail: {
      zh: "支付待处理时间过长。创建新的支付会话。",
      en: "Pending payment timed out. Create a fresh checkout session.",
    },
  },
  suggest_inspect_webhook: {
    title: { zh: "检查 webhook 时间线", en: "Inspect webhook timeline" },
    detail: {
      zh: "检测到 webhook 失败。请先检查事件顺序，再重试支付。",
      en: "Webhook failures detected. Check event sequence before retrying payment.",
    },
  },
  suggest_notify_doctor_followup: {
    title: { zh: "提醒医生跟进", en: "Notify doctor follow-up" },
    detail: {
      zh: "患者消息尚未被处理。立即触发医生跟进提醒。",
      en: "Patient message is waiting. Trigger doctor follow-up reminder now.",
    },
  },
  suggest_resend_access_link: {
    title: { zh: "重发患者入室链接", en: "Resend patient access link" },
    detail: {
      zh: "支付已完成。若患者无法进入会诊室，请重新发送入室链接。",
      en: "Payment is settled. Resend entry link if patient cannot enter room.",
    },
  },
  suggest_issue_access_links: {
    title: { zh: "签发新的患者/医生访问链接", en: "Issue new access links" },
    detail: {
      zh: "作废旧链接并重新签发一对新的患者/医生链接。",
      en: "Revoke old links and issue a fresh patient/doctor pair.",
    },
  },
  suggest_monitor_only: {
    title: { zh: "无紧急动作", en: "No urgent action" },
    detail: {
      zh: "当前状态看起来稳定，持续监测时间线更新。",
      en: "Current state looks stable. Continue monitoring timeline updates.",
    },
  },
} as const;

export function getAdminSuggestionCopy(
  key: keyof typeof SUGGESTION_COPY,
  lang: AdminLang
) {
  return {
    title: getAdminText(lang, SUGGESTION_COPY[key].title),
    detail: getAdminText(lang, SUGGESTION_COPY[key].detail),
  };
}
