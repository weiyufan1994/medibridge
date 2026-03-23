import { describe, expect, it } from "vitest";
import type {
  DoctorScheduleException,
  DoctorScheduleRule,
} from "../../../drizzle/schema";
import { buildGeneratedSlots } from "./actions";

function createRule(partial?: Partial<DoctorScheduleRule>): DoctorScheduleRule {
  return {
    id: 1,
    doctorId: 11,
    timezone: "Asia/Shanghai",
    weekday: 1,
    startLocalTime: "10:00",
    endLocalTime: "12:00",
    slotDurationMinutes: 30,
    appointmentTypeScope: "online_chat",
    validFrom: null,
    validTo: null,
    isActive: 1,
    createdByRole: "admin",
    createdByUserId: 1,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...partial,
  };
}

function createException(partial?: Partial<DoctorScheduleException>): DoctorScheduleException {
  return {
    id: 1,
    doctorId: 11,
    dateLocal: "2026-03-16",
    action: "block",
    startLocalTime: "10:00",
    endLocalTime: "12:00",
    reason: "blocked",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    ...partial,
  };
}

describe("slot generation", () => {
  it("expands a rule into timezone-aware 30-minute slots", () => {
    const slots = buildGeneratedSlots({
      rules: [createRule()],
      exceptions: [],
      windowStart: new Date("2026-03-16T00:00:00.000Z"),
      windowDays: 1,
    });

    expect(slots).toHaveLength(4);
    expect(slots[0]).toMatchObject({
      doctorId: 11,
      appointmentType: "online_chat",
      slotDurationMinutes: 30,
      localDate: "2026-03-16",
      source: "rule",
    });
    expect(slots[0]?.startAt.toISOString()).toBe("2026-03-16T02:00:00.000Z");
    expect(slots[3]?.endAt.toISOString()).toBe("2026-03-16T04:00:00.000Z");
  });

  it("blocks slots for a blocked exception window", () => {
    const slots = buildGeneratedSlots({
      rules: [createRule()],
      exceptions: [createException()],
      windowStart: new Date("2026-03-16T00:00:00.000Z"),
      windowDays: 1,
    });

    expect(slots).toHaveLength(0);
  });

  it("replaces the base window when a replace exception exists", () => {
    const slots = buildGeneratedSlots({
      rules: [createRule()],
      exceptions: [
        createException({
          action: "replace",
          startLocalTime: "15:00",
          endLocalTime: "16:00",
        }),
      ],
      windowStart: new Date("2026-03-16T00:00:00.000Z"),
      windowDays: 1,
    });

    expect(slots).toHaveLength(2);
    expect(slots[0]?.startAt.toISOString()).toBe("2026-03-16T07:00:00.000Z");
  });
});
