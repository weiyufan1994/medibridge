import { getAdminReasonLabel, getAdminWebhookTypeLabel } from "@/features/admin/copy";

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
  return getAdminReasonLabel(reason, lang);
}

export function toWebhookTypeLabel(type: string, lang: "zh" | "en") {
  return getAdminWebhookTypeLabel(type, lang);
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

export function downloadTextFile(
  content: string,
  mimeType: string,
  filename: string
) {
  if (typeof window === "undefined") {
    return;
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
