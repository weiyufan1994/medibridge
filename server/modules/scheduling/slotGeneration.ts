import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type {
  DoctorScheduleException,
  DoctorScheduleRule,
  InsertDoctorSlot,
} from "../../../drizzle/schema";
import { SLOT_GENERATION_WINDOW_DAYS } from "./constants";

type GenerationInput = {
  rules: DoctorScheduleRule[];
  exceptions: DoctorScheduleException[];
  windowStart?: Date;
  windowDays?: number;
};

type LocalWindow = {
  startLocalTime: string;
  endLocalTime: string;
};

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function overlaps(window: LocalWindow, blocked: LocalWindow) {
  const windowStart = parseMinutes(window.startLocalTime);
  const windowEnd = parseMinutes(window.endLocalTime);
  const blockedStart = parseMinutes(blocked.startLocalTime);
  const blockedEnd = parseMinutes(blocked.endLocalTime);
  return windowStart < blockedEnd && blockedStart < windowEnd;
}

function enumerateDates(windowStart: Date, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(windowStart, index);
    return formatUtcDate(date);
  });
}

function isRuleActiveOnDate(rule: DoctorScheduleRule, dateLocal: string) {
  if (rule.isActive !== 1) {
    return false;
  }
  if (rule.validFrom && dateLocal < rule.validFrom) {
    return false;
  }
  if (rule.validTo && dateLocal > rule.validTo) {
    return false;
  }
  const weekday = new Date(`${dateLocal}T00:00:00.000Z`).getUTCDay();
  return rule.weekday === weekday;
}

function buildWindowsForRule(input: {
  rule: DoctorScheduleRule;
  dateLocal: string;
  exceptions: DoctorScheduleException[];
}) {
  const replaceWindows = input.exceptions
    .filter(item => item.action === "replace" && item.startLocalTime && item.endLocalTime)
    .map(item => ({
      startLocalTime: item.startLocalTime!,
      endLocalTime: item.endLocalTime!,
    }));

  const baseWindows: LocalWindow[] =
    replaceWindows.length > 0
      ? replaceWindows
      : [
          {
            startLocalTime: input.rule.startLocalTime,
            endLocalTime: input.rule.endLocalTime,
          },
        ];

  const extendWindows = input.exceptions
    .filter(item => item.action === "extend" && item.startLocalTime && item.endLocalTime)
    .map(item => ({
      startLocalTime: item.startLocalTime!,
      endLocalTime: item.endLocalTime!,
    }));

  const blockedWindows = input.exceptions
    .filter(item => item.action === "block" && item.startLocalTime && item.endLocalTime)
    .map(item => ({
      startLocalTime: item.startLocalTime!,
      endLocalTime: item.endLocalTime!,
    }));

  return [...baseWindows, ...extendWindows].filter(window =>
    blockedWindows.every(blocked => !overlaps(window, blocked))
  );
}

function buildSlotsForWindow(input: {
  rule: DoctorScheduleRule;
  dateLocal: string;
  window: LocalWindow;
}) {
  const startMinutes = parseMinutes(input.window.startLocalTime);
  const endMinutes = parseMinutes(input.window.endLocalTime);
  if (endMinutes <= startMinutes) {
    return [] as InsertDoctorSlot[];
  }

  const slots: InsertDoctorSlot[] = [];
  for (
    let currentMinutes = startMinutes;
    currentMinutes + input.rule.slotDurationMinutes <= endMinutes;
    currentMinutes += input.rule.slotDurationMinutes
  ) {
    const startLocalTime = `${String(Math.floor(currentMinutes / 60)).padStart(2, "0")}:${String(
      currentMinutes % 60
    ).padStart(2, "0")}`;
    const endLocalMinutes = currentMinutes + input.rule.slotDurationMinutes;
    const endLocalTime = `${String(Math.floor(endLocalMinutes / 60)).padStart(2, "0")}:${String(
      endLocalMinutes % 60
    ).padStart(2, "0")}`;
    const startAt = fromZonedTime(
      `${input.dateLocal}T${startLocalTime}:00`,
      input.rule.timezone
    );
    const endAt = fromZonedTime(`${input.dateLocal}T${endLocalTime}:00`, input.rule.timezone);
    slots.push({
      doctorId: input.rule.doctorId,
      appointmentType: input.rule.appointmentTypeScope,
      slotDurationMinutes: input.rule.slotDurationMinutes,
      timezone: input.rule.timezone,
      localDate: formatInTimeZone(startAt, input.rule.timezone, "yyyy-MM-dd"),
      startAt,
      endAt,
      status: "open",
      source: "rule",
      scheduleRuleId: input.rule.id,
      holdExpiresAt: null,
      heldBySessionId: null,
      appointmentId: null,
    });
  }

  return slots;
}

export function buildGeneratedSlots(input: GenerationInput) {
  const windowStart = input.windowStart ?? new Date();
  const days = input.windowDays ?? SLOT_GENERATION_WINDOW_DAYS;
  const dateLocals = enumerateDates(windowStart, days);
  const exceptionsByDate = new Map<string, DoctorScheduleException[]>();
  for (const exception of input.exceptions) {
    const items = exceptionsByDate.get(exception.dateLocal) ?? [];
    items.push(exception);
    exceptionsByDate.set(exception.dateLocal, items);
  }

  const generated: InsertDoctorSlot[] = [];
  for (const rule of input.rules) {
    for (const dateLocal of dateLocals) {
      if (!isRuleActiveOnDate(rule, dateLocal)) {
        continue;
      }
      const windows = buildWindowsForRule({
        rule,
        dateLocal,
        exceptions: exceptionsByDate.get(dateLocal)?.filter(item => item.doctorId === rule.doctorId) ?? [],
      });
      for (const window of windows) {
        generated.push(...buildSlotsForWindow({ rule, dateLocal, window }));
      }
    }
  }

  return generated;
}
