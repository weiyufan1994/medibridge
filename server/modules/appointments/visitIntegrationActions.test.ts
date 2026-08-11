import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  insertStatusEvent: vi.fn(),
  markAppointmentInSessionIfNeeded: vi.fn(),
  updateAppointmentById: vi.fn(),
}));

import * as appointmentsRepo from "./repo";
import {
  markAppointmentInSessionAfterFirstMessage,
  touchAppointmentVisitAccess,
} from "./visitIntegrationActions";

describe("appointment visit integration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["doctor", "doctorLastAccessAt"],
    ["patient", "lastAccessAt"],
  ] as const)(
    "records %s room access in the owned field",
    async (role, field) => {
      const touchedAt = new Date("2026-08-11T04:00:00.000Z");

      await touchAppointmentVisitAccess({
        appointmentId: 9001,
        role,
        touchedAt,
      });

      expect(appointmentsRepo.updateAppointmentById).toHaveBeenCalledWith(
        9001,
        {
          [field]: touchedAt,
        }
      );
    }
  );

  it("records the paid-to-active transition after the first visit message", async () => {
    vi.mocked(
      appointmentsRepo.markAppointmentInSessionIfNeeded
    ).mockResolvedValue("paid" as never);

    await markAppointmentInSessionAfterFirstMessage(9001);

    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith({
      appointmentId: 9001,
      fromStatus: "paid",
      toStatus: "active",
      operatorType: "system",
      reason: "first_visit_message",
    });
  });

  it("does not write an event when no state transition occurs", async () => {
    vi.mocked(
      appointmentsRepo.markAppointmentInSessionIfNeeded
    ).mockResolvedValue(null as never);

    await markAppointmentInSessionAfterFirstMessage(9001);

    expect(appointmentsRepo.insertStatusEvent).not.toHaveBeenCalled();
  });

  it("keeps message delivery resilient when status synchronization fails", async () => {
    vi.mocked(
      appointmentsRepo.markAppointmentInSessionIfNeeded
    ).mockRejectedValue(new Error("temporary database error"));

    await expect(
      markAppointmentInSessionAfterFirstMessage(9001)
    ).resolves.toBeUndefined();
    expect(appointmentsRepo.insertStatusEvent).not.toHaveBeenCalled();
  });
});
