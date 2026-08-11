import { describe, expect, it, vi } from "vitest";
import { createAppointmentDraft } from "./draftWriteRepo";

function buildExecutor(rows: unknown[]) {
  const returning = vi.fn(async () => rows);
  const values = vi.fn(() => ({ returning }));
  return {
    executor: {
      select: vi.fn(),
      insert: vi.fn(() => ({ values })),
      update: vi.fn(),
    },
    values,
  };
}

describe("appointment draft write repository", () => {
  it("creates an unpaid draft with explicit access defaults", async () => {
    const { executor, values } = buildExecutor([{ id: 601 }]);
    const scheduledAt = new Date("2026-03-04T05:06:07.000Z");

    await expect(
      createAppointmentDraft({
        slotId: 21,
        doctorId: 11,
        triageSessionId: 41,
        appointmentType: "video_call",
        scheduledAt,
        email: "patient@example.com",
        amount: 15900,
        currency: "cny",
        userId: 31,
        sessionId: "guest-session",
        notes: "prefers morning",
        dbExecutor: executor as never,
      })
    ).resolves.toBe(601);

    expect(values).toHaveBeenCalledWith({
      slotId: 21,
      doctorId: 11,
      triageSessionId: 41,
      appointmentType: "video_call",
      scheduledAt,
      status: "draft",
      paymentStatus: "unpaid",
      amount: 15900,
      currency: "cny",
      email: "patient@example.com",
      userId: 31,
      sessionId: "guest-session",
      notes: "prefers morning",
      lastAccessAt: null,
      doctorLastAccessAt: null,
    });
  });

  it("returns null when the insert does not return an id", async () => {
    const { executor } = buildExecutor([]);

    await expect(
      createAppointmentDraft({
        doctorId: 12,
        triageSessionId: 42,
        appointmentType: "online_chat",
        scheduledAt: new Date("2026-04-05T06:07:08.000Z"),
        email: "patient@example.com",
        amount: 9900,
        currency: "cny",
        dbExecutor: executor as never,
      })
    ).resolves.toBeNull();
  });
});
