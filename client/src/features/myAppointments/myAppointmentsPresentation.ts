import type { getDashboardAppointmentCopy } from "@/features/dashboard";

export type MyAppointmentItem = {
  id: number;
  doctorId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date | string | null;
  status:
    | "draft"
    | "pending_payment"
    | "paid"
    | "active"
    | "ended"
    | "completed"
    | "expired"
    | "refunded"
    | "canceled";
  paymentStatus:
    | "unpaid"
    | "pending"
    | "paid"
    | "failed"
    | "expired"
    | "refunded"
    | "canceled";
  createdAt: Date | string;
};

export type MyAppointmentSectionVariant = "upcoming" | "past";
export type MyAppointmentTab = "upcoming" | "past_visits";
export type DashboardAppointmentCopy = ReturnType<
  typeof getDashboardAppointmentCopy
>;

const UPCOMING_STATUSES = new Set<MyAppointmentItem["status"]>([
  "draft",
  "pending_payment",
  "paid",
  "active",
]);

export function getMyAppointmentTypeLabel(
  type: MyAppointmentItem["appointmentType"],
  copy: DashboardAppointmentCopy
) {
  if (type === "online_chat") return copy.typeOnline;
  if (type === "video_call") return copy.typeVideo;
  return copy.typeInPerson;
}

export function getMyAppointmentStatusLabel(
  item: MyAppointmentItem,
  copy: DashboardAppointmentCopy,
  now = new Date()
) {
  if (
    (item.status === "paid" || item.status === "active") &&
    isMyAppointmentScheduledInFuture(item, now)
  ) {
    return copy.statusNotStarted;
  }
  const status = item.status;
  if (status === "draft") return copy.statusDraft;
  if (status === "pending_payment") return copy.statusPendingPayment;
  if (status === "paid") return copy.statusPaid;
  if (status === "active") return copy.statusActive;
  if (status === "ended") return copy.statusEnded;
  if (status === "completed") return copy.statusCompleted;
  if (status === "expired") return copy.statusExpired;
  if (status === "refunded") return copy.statusRefunded;
  return copy.statusCanceled;
}

export function getMyAppointmentHint(
  item: MyAppointmentItem,
  copy: DashboardAppointmentCopy,
  now = new Date()
) {
  if (item.status === "pending_payment") return copy.hintPendingPayment;
  if (item.status === "paid" && isMyAppointmentScheduledInFuture(item, now)) {
    return copy.hintNotStarted;
  }
  if (item.status === "paid") return copy.hintPaid;
  if (item.status === "active" && isMyAppointmentScheduledInFuture(item, now)) {
    return copy.hintNotStarted;
  }
  if (item.status === "active") return copy.hintActive;
  if (item.status === "ended" || item.status === "completed") {
    return copy.hintEnded;
  }
  return copy.hintInactive;
}

export function getMyAppointmentStatusBadgeClass(
  variant: MyAppointmentSectionVariant,
  item: MyAppointmentItem,
  now = new Date()
) {
  if (
    (item.status === "paid" || item.status === "active") &&
    isMyAppointmentScheduledInFuture(item, now)
  ) {
    return "rounded-full border border-sky-100 bg-sky-50 text-sky-700";
  }
  const status = item.status;
  if (status === "paid") {
    return "rounded-full border border-teal-100 bg-teal-50 text-teal-700";
  }
  if (variant === "upcoming") {
    return "rounded-full border border-teal-100 bg-teal-50 text-teal-700";
  }
  if (status === "ended" || status === "completed") {
    return "rounded-full border-0 bg-emerald-100 text-emerald-700";
  }
  return "rounded-full border-0 bg-slate-100 text-slate-600";
}

export function parseMyAppointmentDate(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isMyAppointmentScheduledInFuture(
  item: MyAppointmentItem,
  now = new Date()
) {
  const scheduledAt = parseMyAppointmentDate(item.scheduledAt);
  if (!scheduledAt) {
    return false;
  }
  return scheduledAt.getTime() > now.getTime();
}

export function canEnterMyAppointmentRoomNow(
  item: MyAppointmentItem,
  now = new Date()
) {
  if (item.status !== "paid" && item.status !== "active") {
    return true;
  }
  return !isMyAppointmentScheduledInFuture(item, now);
}

export function getMyAppointmentUpcomingActionLabel(
  item: MyAppointmentItem,
  copy: DashboardAppointmentCopy
) {
  if (item.status === "pending_payment" || item.status === "draft") {
    return copy.payNow;
  }
  return copy.enterVisitRoom;
}

export function mapMyAppointmentActionErrorMessage(
  error: unknown,
  copy: DashboardAppointmentCopy
) {
  const raw = error instanceof Error ? error.message : copy.actionFailed;
  if (raw === "APPOINTMENT_NOT_STARTED") {
    return copy.hintNotStarted;
  }
  if (raw === "APPOINTMENT_NOT_ALLOWED") {
    return copy.hintInactive;
  }
  return raw;
}

export function sortMyAppointmentsByScheduledAtDesc(
  items: MyAppointmentItem[]
) {
  return [...items].sort((left, right) => {
    const leftTime = parseMyAppointmentDate(left.scheduledAt)?.getTime() ?? 0;
    const rightTime = parseMyAppointmentDate(right.scheduledAt)?.getTime() ?? 0;
    if (rightTime !== leftTime) return rightTime - leftTime;
    return right.id - left.id;
  });
}

export function getMyAppointmentSections(data: {
  upcoming: MyAppointmentItem[];
  completed: MyAppointmentItem[];
  past: MyAppointmentItem[];
}) {
  const allItems = [...data.upcoming, ...data.completed, ...data.past];
  return {
    upcomingItems: sortMyAppointmentsByScheduledAtDesc(
      allItems.filter(item => UPCOMING_STATUSES.has(item.status))
    ),
    pastVisitItems: sortMyAppointmentsByScheduledAtDesc(
      allItems.filter(
        item => item.status === "ended" || item.status === "completed"
      )
    ),
  };
}

export function extractMyAppointmentTokenFromJoinUrl(
  joinUrl: string,
  origin = typeof window === "undefined" ? null : window.location.origin
) {
  if (!origin) {
    return "";
  }
  try {
    const parsed = new URL(joinUrl, origin);
    return parsed.searchParams.get("t")?.trim() ?? "";
  } catch {
    return "";
  }
}
