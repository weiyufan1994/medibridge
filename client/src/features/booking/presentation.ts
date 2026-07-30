import type {
  BookingBatchResult,
  BookingWorklistItem,
} from "@/features/booking/types";

export function formatBookingDate(
  value: Date | string | null | undefined,
  locale: string
) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBookingAmount(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
  locale: string
) {
  if (!Number.isFinite(amountMinor)) {
    return "-";
  }

  const normalizedCurrency = (currency || "USD").trim().toUpperCase();
  const amountMajor = (amountMinor ?? 0) / 100;

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

export function getBookingStatusDotClass(status: string) {
  switch (status) {
    case "completed":
    case "active":
    case "paid":
      return "bg-emerald-500";
    case "pending_payment":
    case "draft":
      return "bg-amber-500";
    case "canceled":
    case "expired":
    case "refunded":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

export function getBookingPaymentPillClass(paymentStatus: string) {
  switch (paymentStatus) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
    case "expired":
    case "refunded":
    case "canceled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function getBookingRiskAccent(item: Pick<BookingWorklistItem, "riskFlag" | "riskCodes">) {
  if (!item.riskFlag) {
    return null;
  }

  const hasCriticalCode = item.riskCodes.some(code =>
    ["WEBHOOK_FAILURE", "PAID_BUT_NOT_ACTIVE"].includes(code)
  );

  return hasCriticalCode
    ? {
        iconClassName: "text-rose-600",
        dotClassName: "bg-rose-500",
      }
    : {
        iconClassName: "text-amber-600",
        dotClassName: "bg-amber-500",
      };
}

export function getBookingEmailSummary(email: string) {
  const [localPart, domain] = email.split("@");
  if (!domain) {
    return email;
  }
  if (localPart.length <= 10) {
    return email;
  }
  return `${localPart.slice(0, 10)}...@${domain}`;
}

export function getBatchResultTone(result: BookingBatchResult["status"]) {
  switch (result) {
    case "success":
      return "text-emerald-700";
    case "failed":
      return "text-rose-700";
    default:
      return "text-amber-700";
  }
}
