import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/accessValidation", () => ({
  validateAppointmentToken: vi.fn(),
}));

vi.mock("./modules/appointments/repo", () => ({
  updateAppointmentNotesIfMatch: vi.fn(),
  insertStatusEvent: vi.fn(),
  getAppointmentById: vi.fn(),
}));

import { validateAppointmentToken } from "./modules/appointments/accessValidation";
import * as appointmentsRepo from "./modules/appointments/repo";
import { extendConsultationByDoctorTokenFlow } from "./modules/appointments/timerActions";

describe("consultation timer actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extends consultation by 5 minutes for doctor token", async () => {
    vi.mocked(validateAppointmentToken).mockResolvedValue({
      role: "doctor",
      appointment: {
        id: 99,
        status: "active",
        notes: JSON.stringify({ packageDurationMinutes: 30 }),
      },
    } as never);
    vi.mocked(appointmentsRepo.updateAppointmentNotesIfMatch).mockResolvedValue(1 as never);
    vi.mocked(appointmentsRepo.insertStatusEvent).mockResolvedValue(undefined as never);

    const result = await extendConsultationByDoctorTokenFlow({
      appointmentId: 99,
      token: "doctor_token_1234567890",
      extensionMinutes: 5,
    });

    expect(result).toEqual({
      appointmentId: 99,
      baseDurationMinutes: 30,
      extensionMinutes: 5,
      totalDurationMinutes: 35,
    });
    expect(appointmentsRepo.updateAppointmentNotesIfMatch).toHaveBeenCalledTimes(1);
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 99,
        operatorType: "doctor",
        reason: "doctor_extended_consultation_timer",
      })
    );
  });

  it("rejects second extension with CONSULTATION_EXTENSION_ALREADY_USED", async () => {
    vi.mocked(validateAppointmentToken).mockResolvedValue({
      role: "doctor",
      appointment: {
        id: 99,
        status: "active",
        notes: JSON.stringify({
          packageDurationMinutes: 30,
          timerExtensionMinutes: 5,
          timerExtensionUsed: true,
        }),
      },
    } as never);

    await expect(
      extendConsultationByDoctorTokenFlow({
        appointmentId: 99,
        token: "doctor_token_1234567890",
        extensionMinutes: 5,
      })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "PRECONDITION_FAILED",
      message: "CONSULTATION_EXTENSION_ALREADY_USED",
    });
  });
});
