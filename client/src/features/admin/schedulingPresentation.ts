import { getDisplayLocale, getLocalizedText } from "@/lib/i18n";
import type { LocalizedText } from "@shared/types";

type TranslateFn = (zh: string, en: string) => string;

export function formatSchedulingDateTime(
  value: Date | string,
  lang: "zh" | "en"
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getDisplayLocale(lang), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatSchedulingStatus(status: string, tr: TranslateFn) {
  switch (status) {
    case "open":
      return tr("可售", "Open");
    case "held":
      return tr("预占中", "Held");
    case "booked":
      return tr("已售", "Booked");
    case "blocked":
      return tr("已封盘", "Blocked");
    case "expired":
      return tr("已过期", "Expired");
    default:
      return status;
  }
}

type SchedulingDoctorLabelInput = {
  lang: "zh" | "en";
  doctorId: number;
  doctor?: {
    id: number;
    name?: LocalizedText | null;
  } | null;
  tr: TranslateFn;
};

export function getSchedulingDoctorLabel(input: SchedulingDoctorLabelInput) {
  const fallback = input.tr(
    `医生 #${input.doctorId}`,
    `Doctor #${input.doctorId}`
  );
  if (!input.doctor) return fallback;

  return `${getLocalizedText({
    lang: input.lang,
    value: input.doctor.name,
    placeholder: fallback,
  })} (#${input.doctor.id})`;
}
