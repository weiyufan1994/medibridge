import type { AppointmentType } from "@/features/appointment/hooks/useAppointmentForm";

export type AppointmentSlot = {
  id: number;
  doctorId: number;
  appointmentType: AppointmentType;
  slotDurationMinutes: number;
  timezone: string;
  localDate: string;
  startAt: Date;
  endAt: Date;
  status: "open" | "held" | "booked" | "blocked" | "expired";
  source: "rule" | "manual";
};

export function formatAppointmentDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatSlotLabel(date: Date, locale: "en" | "zh") {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatAppointmentSlotRange(
  slot: Pick<AppointmentSlot, "startAt" | "endAt">,
  locale: "en" | "zh"
) {
  return `${formatSlotLabel(slot.startAt, locale)} - ${formatSlotLabel(slot.endAt, locale)}`;
}
