import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getAppointmentById: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
}));

vi.mock("../scheduling/publicApi", () => ({
  schedulingSlotApi: {
    releaseHeldSlotByAppointmentId: vi.fn(),
  },
}));

vi.mock("../doctorAccounts/publicApi", () => ({
  doctorAccountAccessApi: {
    resolveBoundDoctorIdForUser: vi.fn(),
  },
}));

vi.mock("./accessValidation", () => ({
  getAppointmentByIdOrThrow: vi.fn(),
}));

import { doctorAccountAccessApi as doctorAccess } from "../doctorAccounts/publicApi";
import { schedulingSlotApi as slots } from "../scheduling/publicApi";
import { getAppointmentByIdOrThrow } from "./accessValidation";
import * as repo from "./repo";
import {
  cancelAppointmentByPatient,
  cancelAppointmentByPatientById,
  completeAppointmentByDoctor,
  startAppointmentByDoctorUser,
} from "./statusActions";

function createAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    doctorId: 17,
    status: "paid",
    paymentStatus: "paid",
    stripeSessionId: "cs_41",
    paidAt: new Date("2026-08-13T08:00:00.000Z"),
    ...overrides,
  } as never;
}

describe("appointment status actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(repo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(repo.revokeAppointmentTokens).mockResolvedValue(undefined);
    vi.mocked(slots.releaseHeldSlotByAppointmentId).mockResolvedValue(
      undefined
    );
    vi.mocked(doctorAccess.resolveBoundDoctorIdForUser).mockResolvedValue(17);
  });

  it("cancels a paid appointment before revoking access and releasing its slot", async () => {
    const appointment = createAppointment();
    const updated = createAppointment({ status: "canceled" });
    vi.mocked(repo.getAppointmentById).mockResolvedValue(updated);

    await expect(
      cancelAppointmentByPatient({
        appointment,
        operatorId: 9,
        reason: "patient_request",
      })
    ).resolves.toEqual({
      appointmentId: 41,
      status: "canceled",
      paymentStatus: "paid",
      stripeSessionId: "cs_41",
      paidAt: updated.paidAt,
    });

    expect(repo.tryTransitionAppointmentById).toHaveBeenCalledWith({
      appointmentId: 41,
      allowedFrom: ["draft", "pending_payment", "paid"],
      toStatus: "canceled",
      toPaymentStatus: "failed",
      operatorType: "patient",
      operatorId: 9,
      reason: "patient_request",
    });
    expect(repo.revokeAppointmentTokens).toHaveBeenCalledWith({
      appointmentId: 41,
      reason: "appointment_canceled",
    });
    expect(slots.releaseHeldSlotByAppointmentId).toHaveBeenCalledWith({
      appointmentId: 41,
    });
    expect(
      vi.mocked(repo.tryTransitionAppointmentById).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(repo.revokeAppointmentTokens).mock.invocationCallOrder[0]
    );
    expect(
      vi.mocked(repo.revokeAppointmentTokens).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(slots.releaseHeldSlotByAppointmentId).mock
        .invocationCallOrder[0]
    );
  });

  it("uses canceled payment state and the default audit reason when unpaid", async () => {
    const appointment = createAppointment({
      paymentStatus: "pending",
      stripeSessionId: null,
      paidAt: null,
    });
    vi.mocked(repo.getAppointmentById).mockResolvedValue(
      createAppointment({
        status: "canceled",
        paymentStatus: "canceled",
        stripeSessionId: null,
        paidAt: null,
      })
    );

    const result = await cancelAppointmentByPatient({
      appointment,
      operatorId: null,
    });

    expect(repo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        toPaymentStatus: "canceled",
        reason: "appointment_canceled",
      })
    );
    expect(result).toMatchObject({ stripeSessionId: null, paidAt: null });
  });

  it("stops cancellation side effects when the status transition loses a race", async () => {
    vi.mocked(repo.tryTransitionAppointmentById).mockResolvedValue({
      ok: false,
      reason: "conflict",
    } as never);

    await expect(
      cancelAppointmentByPatient({
        appointment: createAppointment(),
        operatorId: 9,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "APPOINTMENT_INVALID_STATUS_TRANSITION",
    });

    expect(repo.revokeAppointmentTokens).not.toHaveBeenCalled();
    expect(slots.releaseHeldSlotByAppointmentId).not.toHaveBeenCalled();
    expect(repo.getAppointmentById).not.toHaveBeenCalled();
  });

  it("fails closed when a canceled appointment can no longer be read", async () => {
    vi.mocked(repo.getAppointmentById).mockResolvedValue(undefined);

    await expect(
      cancelAppointmentByPatient({
        appointment: createAppointment(),
        operatorId: null,
      })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after cancellation",
    });
  });

  it("loads an appointment before canceling by id", async () => {
    const appointment = createAppointment({ paymentStatus: "pending" });
    vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(appointment);
    vi.mocked(repo.getAppointmentById).mockResolvedValue(
      createAppointment({ status: "canceled", paymentStatus: "canceled" })
    );

    await cancelAppointmentByPatientById({
      appointmentId: 41,
      operatorId: 9,
      reason: "patient_request",
    });

    expect(getAppointmentByIdOrThrow).toHaveBeenCalledWith(41);
    expect(repo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({ operatorId: 9, reason: "patient_request" })
    );
  });

  it("allows only doctors to complete an appointment", async () => {
    await expect(
      completeAppointmentByDoctor({
        appointmentId: 41,
        role: "patient",
        operatorId: 9,
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Only doctor can complete appointment",
    });

    expect(repo.tryTransitionAppointmentById).not.toHaveBeenCalled();
  });

  it("completes an active appointment with the doctor audit identity", async () => {
    vi.mocked(repo.getAppointmentById).mockResolvedValue(
      createAppointment({ status: "ended" })
    );

    await expect(
      completeAppointmentByDoctor({
        appointmentId: 41,
        role: "doctor",
        operatorId: 77,
      })
    ).resolves.toEqual({
      appointmentId: 41,
      status: "ended",
      paymentStatus: "paid",
    });

    expect(repo.tryTransitionAppointmentById).toHaveBeenCalledWith({
      appointmentId: 41,
      allowedFrom: ["paid", "active"],
      toStatus: "ended",
      toPaymentStatus: "paid",
      operatorType: "doctor",
      operatorId: 77,
      reason: "doctor_completed_consultation",
    });
  });

  it.each([
    ["transition", { ok: false, reason: "conflict" }, "PRECONDITION_FAILED"],
    ["reload", { ok: true, reason: "updated" }, "INTERNAL_SERVER_ERROR"],
  ] as const)(
    "rejects completion after a failed %s",
    async (_name, transition, code) => {
      vi.mocked(repo.tryTransitionAppointmentById).mockResolvedValue(
        transition as never
      );
      vi.mocked(repo.getAppointmentById).mockResolvedValue(undefined);

      await expect(
        completeAppointmentByDoctor({
          appointmentId: 41,
          role: "doctor",
          operatorId: 77,
        })
      ).rejects.toMatchObject({ code });
    }
  );

  it("rejects a doctor starting an appointment owned by another doctor", async () => {
    vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(
      createAppointment({ doctorId: 18 })
    );

    await expect(
      startAppointmentByDoctorUser({
        appointmentId: 41,
        currentUserId: 77,
        currentUserRole: "doctor",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(repo.tryTransitionAppointmentById).not.toHaveBeenCalled();
  });

  it("starts the bound doctor's appointment", async () => {
    vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(createAppointment());
    vi.mocked(repo.getAppointmentById).mockResolvedValue(
      createAppointment({ status: "active" })
    );

    await expect(
      startAppointmentByDoctorUser({
        appointmentId: 41,
        currentUserId: 77,
        currentUserRole: "admin",
        doctorId: 17,
      })
    ).resolves.toEqual({
      appointmentId: 41,
      status: "active",
      paymentStatus: "paid",
    });

    expect(doctorAccess.resolveBoundDoctorIdForUser).toHaveBeenCalledWith({
      userId: 77,
      allowAdminDoctorId: 17,
      userRole: "admin",
    });
    expect(repo.tryTransitionAppointmentById).toHaveBeenCalledWith({
      appointmentId: 41,
      allowedFrom: ["paid", "active"],
      toStatus: "active",
      toPaymentStatus: "paid",
      operatorType: "doctor",
      operatorId: 77,
      reason: "doctor_started_consultation",
    });
  });

  it.each([
    ["transition", { ok: false, reason: "conflict" }, "PRECONDITION_FAILED"],
    ["reload", { ok: true, reason: "updated" }, "INTERNAL_SERVER_ERROR"],
  ] as const)(
    "rejects activation after a failed %s",
    async (_name, transition, code) => {
      vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(
        createAppointment()
      );
      vi.mocked(repo.tryTransitionAppointmentById).mockResolvedValue(
        transition as never
      );
      vi.mocked(repo.getAppointmentById).mockResolvedValue(undefined);

      await expect(
        startAppointmentByDoctorUser({
          appointmentId: 41,
          currentUserId: 77,
        })
      ).rejects.toMatchObject({ code });
    }
  );
});
