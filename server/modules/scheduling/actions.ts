import { TRPCError } from "@trpc/server";
import { addDays } from "date-fns";
import { getDb } from "../../db";
import { resolveBoundDoctorIdForUser } from "../doctorAccounts/actions";
import { buildGeneratedSlots } from "./slotGeneration";
import * as schedulingRepo from "./repo";
import { SLOT_GENERATION_WINDOW_DAYS } from "./constants";

function normalizeRole(role: string | null | undefined) {
  if (role === "admin" || role === "ops" || role === "doctor") {
    return role;
  }
  return "admin";
}

function serializeRule<T extends { isActive: number; createdByRole: string }>(value: T) {
  return {
    ...value,
    isActive: toBooleanFlag(value.isActive),
    createdByRole: normalizeRole(value.createdByRole),
  };
}

function toBooleanFlag(value: number) {
  return value === 1;
}

function assertRecord<T>(value: T | null, message: string) {
  if (!value) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message,
    });
  }
  return value;
}

export async function listAvailableSlots(input: {
  doctorId: number;
  appointmentType?: "online_chat" | "video_call" | "in_person";
}) {
  await schedulingRepo.releaseExpiredHolds();
  return schedulingRepo.listFutureSlots(input);
}

export async function listScheduleRules(input: { doctorId?: number }) {
  const rows = await schedulingRepo.listScheduleRules(input);
  return rows.map(serializeRule);
}

export async function createScheduleRule(input: {
  doctorId: number;
  timezone: string;
  weekday: number;
  startLocalTime: string;
  endLocalTime: string;
  slotDurationMinutes: number;
  appointmentTypeScope: "online_chat" | "video_call" | "in_person";
  validFrom?: string;
  validTo?: string;
  isActive?: boolean;
  actorRole?: string | null;
  actorUserId?: number | null;
}) {
  const created = assertRecord(
    await schedulingRepo.createScheduleRule({
      doctorId: input.doctorId,
      timezone: input.timezone,
      weekday: input.weekday,
      startLocalTime: input.startLocalTime,
      endLocalTime: input.endLocalTime,
      slotDurationMinutes: input.slotDurationMinutes,
      appointmentTypeScope: input.appointmentTypeScope,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      isActive: input.isActive === false ? 0 : 1,
      createdByRole: normalizeRole(input.actorRole),
      createdByUserId: input.actorUserId ?? null,
    }),
    "Failed to create schedule rule"
  );
  await regenerateDoctorSlots({ doctorId: input.doctorId });
  return serializeRule(created);
}

export async function updateScheduleRule(input: {
  id: number;
  actorUserId?: number | null;
  actorRole?: string | null;
  doctorId?: number;
  timezone?: string;
  weekday?: number;
  startLocalTime?: string;
  endLocalTime?: string;
  slotDurationMinutes?: number;
  appointmentTypeScope?: "online_chat" | "video_call" | "in_person";
  validFrom?: string;
  validTo?: string;
  isActive?: boolean;
}) {
  const updated = assertRecord(
    await schedulingRepo.updateScheduleRule(input.id, {
      doctorId: input.doctorId,
      timezone: input.timezone,
      weekday: input.weekday,
      startLocalTime: input.startLocalTime,
      endLocalTime: input.endLocalTime,
      slotDurationMinutes: input.slotDurationMinutes,
      appointmentTypeScope: input.appointmentTypeScope,
      validFrom: input.validFrom,
      validTo: input.validTo,
      isActive: typeof input.isActive === "boolean" ? (input.isActive ? 1 : 0) : undefined,
      createdByRole: input.actorRole ? normalizeRole(input.actorRole) : undefined,
      createdByUserId: input.actorUserId ?? undefined,
    }),
    "Schedule rule not found"
  );
  await regenerateDoctorSlots({ doctorId: updated.doctorId });
  return serializeRule(updated);
}

export async function deleteScheduleRule(id: number) {
  const rule = assertRecord(await schedulingRepo.getScheduleRuleById(id), "Schedule rule not found");
  const deleted = await schedulingRepo.deleteScheduleRule(id);
  if (!deleted) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Schedule rule not found",
    });
  }
  await regenerateDoctorSlots({ doctorId: rule.doctorId });
  return { ok: true as const };
}

export async function listScheduleExceptions(input: {
  doctorId?: number;
  dateLocal?: string;
}) {
  return schedulingRepo.listScheduleExceptions(input);
}

export async function createScheduleException(input: {
  doctorId: number;
  dateLocal: string;
  action: "block" | "extend" | "replace";
  startLocalTime?: string;
  endLocalTime?: string;
  reason?: string;
}) {
  const created = assertRecord(
    await schedulingRepo.createScheduleException({
      doctorId: input.doctorId,
      dateLocal: input.dateLocal,
      action: input.action,
      startLocalTime: input.startLocalTime ?? null,
      endLocalTime: input.endLocalTime ?? null,
      reason: input.reason ?? null,
    }),
    "Failed to create schedule exception"
  );
  await regenerateDoctorSlots({ doctorId: input.doctorId });
  return created;
}

export async function updateScheduleException(input: {
  id: number;
  doctorId?: number;
  dateLocal?: string;
  action?: "block" | "extend" | "replace";
  startLocalTime?: string;
  endLocalTime?: string;
  reason?: string;
}) {
  const updated = assertRecord(
    await schedulingRepo.updateScheduleException(input.id, {
      doctorId: input.doctorId,
      dateLocal: input.dateLocal,
      action: input.action,
      startLocalTime: input.startLocalTime,
      endLocalTime: input.endLocalTime,
      reason: input.reason,
    }),
    "Schedule exception not found"
  );
  await regenerateDoctorSlots({ doctorId: updated.doctorId });
  return updated;
}

export async function deleteScheduleException(input: { id: number; doctorId?: number }) {
  const deleted = await schedulingRepo.deleteScheduleException(input.id);
  if (!deleted) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Schedule exception not found",
    });
  }
  if (input.doctorId) {
    await regenerateDoctorSlots({ doctorId: input.doctorId });
  }
  return { ok: true as const };
}

export async function createManualSlots(input: {
  slots: Array<{
    doctorId: number;
    appointmentType: "online_chat" | "video_call" | "in_person";
    slotDurationMinutes: number;
    timezone: string;
    startAt: Date;
  }>;
}) {
  const rows = input.slots.map(item => ({
    doctorId: item.doctorId,
    appointmentType: item.appointmentType,
    slotDurationMinutes: item.slotDurationMinutes,
    timezone: item.timezone,
    localDate: new Intl.DateTimeFormat("en-CA", {
      timeZone: item.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(item.startAt),
    startAt: item.startAt,
    endAt: new Date(item.startAt.getTime() + item.slotDurationMinutes * 60_000),
    status: "open" as const,
    source: "manual" as const,
    scheduleRuleId: null,
    holdExpiresAt: null,
    heldBySessionId: null,
    appointmentId: null,
  }));

  return schedulingRepo.createManualSlots({ slots: rows });
}

export async function regenerateDoctorSlots(input: { doctorId: number }) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }
  const windowStart = new Date();
  const windowEnd = addDays(windowStart, SLOT_GENERATION_WINDOW_DAYS);

  await db.transaction(async tx => {
    const { rules, exceptions } = await schedulingRepo.getRulesAndExceptionsForDoctor({
      doctorId: input.doctorId,
      dbExecutor: tx,
    });
    const generated = buildGeneratedSlots({
      rules,
      exceptions,
      windowStart,
      windowDays: SLOT_GENERATION_WINDOW_DAYS,
    });

    for (const rule of rules) {
      await schedulingRepo.removeRuleGeneratedSlotsInWindow({
        ruleId: rule.id,
        startAt: windowStart,
        endAt: windowEnd,
        dbExecutor: tx,
      });
    }

    await schedulingRepo.createManualSlots({
      slots: generated,
      dbExecutor: tx,
    });
  });

  return {
    ok: true as const,
  };
}

export async function blockSlot(slotId: number) {
  return assertRecord(await schedulingRepo.blockSlot(slotId), "Slot not found");
}

export async function unblockSlot(slotId: number) {
  return assertRecord(await schedulingRepo.unblockSlot(slotId), "Slot not found");
}

export async function listDoctorUpcomingSlots(input: {
  doctorId?: number;
  currentUserId: number;
  currentUserRole?: string | null;
}) {
  const doctorId = await resolveBoundDoctorIdForUser({
    userId: input.currentUserId,
    allowAdminDoctorId: input.doctorId,
    userRole: input.currentUserRole,
  });
  return schedulingRepo.listUpcomingSlotsByDoctor({ doctorId });
}

export { buildGeneratedSlots } from "./slotGeneration";
