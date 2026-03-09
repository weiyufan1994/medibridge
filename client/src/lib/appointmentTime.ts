const DOCTOR_TIME_ZONE = "Asia/Shanghai";
const APPOINTMENT_DISPLAY_LOCALE = "en-US";

export type AppointmentDualTimezone = {
  localTime: string;
  doctorTime: string;
  isValid: boolean;
};

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

export function formatAppointmentTimes(
  value: Date | string | null,
  fallback = "-",
  locale: string = APPOINTMENT_DISPLAY_LOCALE
): AppointmentDualTimezone {
  const date = toDate(value);
  if (!date) {
    return {
      localTime: fallback,
      doctorTime: fallback,
      isValid: false,
    };
  }

  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  };

  const localTime = new Intl.DateTimeFormat(locale, options).format(date);
  const doctorTime = new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: DOCTOR_TIME_ZONE,
  }).format(date);

  return {
    localTime,
    doctorTime,
    isValid: true,
  };
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
