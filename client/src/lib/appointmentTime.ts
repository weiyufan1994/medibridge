const DOCTOR_TIME_ZONE = "Asia/Shanghai";

export function toDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function formatLocalDateTime(
  value: Date | string | null,
  locale?: string
): string {
  const date = toDate(value);
  if (!date) {
    return "-";
  }
  return date.toLocaleString(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatChinaDateTime(
  value: Date | string | null,
  locale?: string
): string {
  const date = toDate(value);
  if (!date) {
    return "-";
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DOCTOR_TIME_ZONE,
  }).format(date);
}

export function toLocalDateTimeInputValue(value: Date | string | null): string {
  const date = toDate(value);
  if (!date) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
