export function formatDate(value: Date | string | null, locale?: string) {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString(locale);
}

export function formatMoneyFromMinorUnit(
  amountMinor: number,
  currency: string,
  locale?: string
) {
  if (!Number.isFinite(amountMinor)) {
    return "-";
  }

  const normalizedCurrency = (currency || "USD").trim().toUpperCase();
  const amountMajor = amountMinor / 100;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountMajor);
  } catch {
    return `${amountMajor.toFixed(2)} ${normalizedCurrency}`;
  }
}

export function stringify(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function toOperatorBadgeClass(operatorType: string) {
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

export function toReasonLabel(reason: string | null | undefined, lang: "zh" | "en") {
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
    return raw.startsWith(`${baseReason}:`)
      ? `${map[baseReason]} (${raw.slice(baseReason.length + 1)})`
      : map[baseReason];
  }
  return raw;
}

export function toWebhookTypeLabel(type: string, lang: "zh" | "en") {
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

export function toWebhookOutcome(type: string): "success" | "warning" | "failure" {
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

export function toWebhookBadgeClass(outcome: "success" | "warning" | "failure") {
  if (outcome === "success") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (outcome === "warning") {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-rose-100 text-rose-700";
}

export function downloadBase64File(base64: string, mimeType: string, filename: string) {
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
