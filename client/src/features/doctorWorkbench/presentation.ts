import { getLocalizedText } from "@/lib/i18n";
import type { LocalizedText } from "@shared/types";

export type DoctorWorkbenchLanguage = "zh" | "en";

export function formatDoctorWorkbenchDateTime(
  value: Date | string | null,
  locale: string
) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function maskDoctorWorkbenchEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) {
    return email;
  }
  if (name.length <= 2) {
    return `${name[0] ?? "*"}*@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export function getDoctorWorkbenchStatusLabel(
  status: string,
  lang: DoctorWorkbenchLanguage
) {
  const labels: Record<string, { zh: string; en: string }> = {
    pending_payment: { zh: "待支付", en: "Pending Payment" },
    paid: { zh: "待接诊", en: "Ready" },
    active: { zh: "进行中", en: "In Progress" },
    ended: { zh: "已结束", en: "Ended" },
    completed: { zh: "已完成", en: "Completed" },
    canceled: { zh: "已取消", en: "Canceled" },
    expired: { zh: "已过期", en: "Expired" },
  };
  return labels[status]?.[lang] ?? status;
}

export function getDoctorWorkbenchAppointmentTypeLabel(
  type: string,
  lang: DoctorWorkbenchLanguage
) {
  const labels: Record<string, { zh: string; en: string }> = {
    online_chat: { zh: "图文问诊", en: "Online Chat" },
    video_call: { zh: "视频问诊", en: "Video Call" },
    in_person: { zh: "线下面诊", en: "In Person" },
  };
  return labels[type]?.[lang] ?? type;
}

export function parseDoctorWorkbenchToken(doctorLink: string) {
  try {
    const url = new URL(doctorLink);
    return (
      url.searchParams.get("t")?.trim() ||
      url.searchParams.get("token")?.trim() ||
      null
    );
  } catch {
    return null;
  }
}

export function normalizeDoctorWorkbenchError(
  error: unknown,
  fallback: string
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function getDoctorWorkbenchHeading(input: {
  lang: DoctorWorkbenchLanguage;
  doctorName?: LocalizedText | null;
  tr: (zh: string, en: string) => string;
}) {
  return getLocalizedText({
    lang: input.lang,
    value: input.doctorName,
    placeholder: input.tr("医生工作台", "Doctor Workbench"),
  });
}
