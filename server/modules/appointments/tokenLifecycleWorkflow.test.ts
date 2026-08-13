import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestMetadata } from "@shared/requestMetadata";

vi.mock("./accessValidation", () => ({
  validateAppointmentToken: vi.fn(),
}));

vi.mock("./rescheduleActions", () => ({
  rescheduleAppointmentByToken: vi.fn(),
}));

vi.mock("./serializers", () => ({
  toPublicAppointment: vi.fn(),
}));

vi.mock("./statusActions", () => ({
  completeAppointmentByDoctor: vi.fn(),
}));

import { validateAppointmentToken } from "./accessValidation";
import { rescheduleAppointmentByToken } from "./rescheduleActions";
import { toPublicAppointment } from "./serializers";
import { completeAppointmentByDoctor } from "./statusActions";
import {
  completeAppointmentByTokenFlow,
  rescheduleByTokenFlow,
} from "./tokenLifecycleWorkflow";

const requestMetadata: RequestMetadata = {
  clientIp: "198.51.100.7",
  forwardedHost: null,
  forwardedProto: null,
  host: "medibridge.test",
  protocol: "https",
  requestId: "request-1",
  userAgent: "Token-Lifecycle-Test/1.0",
};

describe("appointment token lifecycle workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates join access before rescheduling and serializes the result", async () => {
    const newScheduledAt = new Date("2026-08-20T09:30:00.000Z");
    const updatedAppointment = { id: 9001, status: "paid" };
    const publicAppointment = { id: 9001, status: "paid" };
    vi.mocked(validateAppointmentToken).mockResolvedValue({
      role: "patient",
      appointment: { id: 9001, status: "active" },
    } as never);
    vi.mocked(rescheduleAppointmentByToken).mockResolvedValue(
      updatedAppointment as never
    );
    vi.mocked(toPublicAppointment).mockReturnValue(publicAppointment as never);

    await expect(
      rescheduleByTokenFlow({
        appointmentId: 9001,
        token: "patient-token",
        newScheduledAt,
        requestMetadata,
      })
    ).resolves.toBe(publicAppointment);

    expect(validateAppointmentToken).toHaveBeenCalledWith(
      9001,
      "patient-token",
      "join_room",
      requestMetadata
    );
    expect(rescheduleAppointmentByToken).toHaveBeenCalledWith({
      appointmentId: 9001,
      role: "patient",
      newScheduledAt,
      currentStatus: "active",
    });
    expect(toPublicAppointment).toHaveBeenCalledWith(updatedAppointment);
  });

  it("does not reschedule when token validation fails", async () => {
    vi.mocked(validateAppointmentToken).mockRejectedValue(
      new Error("token invalid")
    );

    await expect(
      rescheduleByTokenFlow({
        appointmentId: 9001,
        token: "invalid-token",
        newScheduledAt: new Date("2026-08-20T09:30:00.000Z"),
      })
    ).rejects.toThrow("token invalid");

    expect(rescheduleAppointmentByToken).not.toHaveBeenCalled();
    expect(toPublicAppointment).not.toHaveBeenCalled();
  });

  it("propagates reschedule failure without serializing a stale result", async () => {
    vi.mocked(validateAppointmentToken).mockResolvedValue({
      role: "patient",
      appointment: { id: 9001, status: "paid" },
    } as never);
    vi.mocked(rescheduleAppointmentByToken).mockRejectedValue(
      new Error("reschedule failed")
    );

    await expect(
      rescheduleByTokenFlow({
        appointmentId: 9001,
        token: "patient-token",
        newScheduledAt: new Date("2026-08-20T09:30:00.000Z"),
      })
    ).rejects.toThrow("reschedule failed");

    expect(toPublicAppointment).not.toHaveBeenCalled();
  });

  it("validates send access before completing as the resolved doctor", async () => {
    const completion = {
      appointmentId: 9001,
      status: "ended",
      paymentStatus: "paid",
    };
    vi.mocked(validateAppointmentToken).mockResolvedValue({
      role: "doctor",
      appointment: { id: 9001, status: "active" },
    } as never);
    vi.mocked(completeAppointmentByDoctor).mockResolvedValue(
      completion as never
    );

    await expect(
      completeAppointmentByTokenFlow({
        appointmentId: 9001,
        token: "doctor-token",
        operatorId: 77,
        requestMetadata,
      })
    ).resolves.toBe(completion);

    expect(validateAppointmentToken).toHaveBeenCalledWith(
      9001,
      "doctor-token",
      "send_message",
      requestMetadata
    );
    expect(completeAppointmentByDoctor).toHaveBeenCalledWith({
      appointmentId: 9001,
      role: "doctor",
      operatorId: 77,
    });
  });

  it("does not complete when token validation fails", async () => {
    vi.mocked(validateAppointmentToken).mockRejectedValue(
      new Error("token expired")
    );

    await expect(
      completeAppointmentByTokenFlow({
        appointmentId: 9001,
        token: "expired-token",
        operatorId: null,
      })
    ).rejects.toThrow("token expired");

    expect(completeAppointmentByDoctor).not.toHaveBeenCalled();
  });
});
