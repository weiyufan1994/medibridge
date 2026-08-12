import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestContext,
  mockAppointmentAccessValidation,
  resetAppointmentTestState,
} from "./appointments.medical-summary.test-setup";
import * as appointmentsRepo from "./modules/appointments/repo";
import { appointmentsRouter } from "./routers/appointments";

describe("appointments medical summary signing", () => {
  beforeEach(resetAppointmentTestState);

  it("signMedicalSummary persists summary and marks appointment completed", async () => {
    mockAppointmentAccessValidation({
      appointmentId: 7003,
      role: "doctor",
      tokenId: 203,
      tokenHash: "h".repeat(64),
      expiresAt: new Date("2026-03-08T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 7003,
        doctorId: 11,
        triageSessionId: 99,
        appointmentType: "online_chat",
        scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
        status: "active",
        paymentStatus: "paid",
        amount: 4900,
        currency: "usd",
        paidAt: new Date("2026-03-03T08:00:00.000Z"),
        email: "user@example.com",
        sessionId: null,
        userId: 1,
        notes: null,
        lastAccessAt: null,
        doctorLastAccessAt: null,
        stripeSessionId: "cs_paid",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    } as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(
      appointmentsRepo.upsertMedicalSummaryByAppointmentId
    ).mockResolvedValue({ id: 99 } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 7003,
      status: "completed",
      paymentStatus: "paid",
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.signMedicalSummary({
      appointmentId: 7003,
      token: "doctor_token_7003_123456",
      chiefComplaint: "Cough for 3 days",
      historyOfPresentIllness: "Intermittent dry cough with mild fever.",
      pastMedicalHistory: "No chronic disease reported.",
      assessmentDiagnosis: "Likely upper respiratory tract infection.",
      planRecommendations: "Hydration, rest, and follow-up if symptoms worsen.",
    });

    expect(result).toMatchObject({
      appointmentId: 7003,
      status: "completed",
      paymentStatus: "paid",
    });
    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 7003,
        allowedFrom: ["paid", "active", "ended", "completed"],
        toStatus: "completed",
      })
    );
    expect(
      appointmentsRepo.upsertMedicalSummaryByAppointmentId
    ).toHaveBeenCalled();
  });

  it("signMedicalSummary rejects invalid status transition", async () => {
    mockAppointmentAccessValidation({
      appointmentId: 7004,
      role: "doctor",
      tokenId: 204,
      tokenHash: "i".repeat(64),
      expiresAt: new Date("2026-03-08T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 7004,
        doctorId: 11,
        triageSessionId: 99,
        appointmentType: "online_chat",
        scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
        status: "ended",
        paymentStatus: "paid",
        amount: 4900,
        currency: "usd",
        paidAt: new Date("2026-03-03T08:00:00.000Z"),
        email: "user@example.com",
        sessionId: null,
        userId: 1,
        notes: null,
        lastAccessAt: null,
        doctorLastAccessAt: null,
        stripeSessionId: "cs_paid",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    } as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: false,
      reason: "illegal_transition",
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    await expect(
      caller.signMedicalSummary({
        appointmentId: 7004,
        token: "doctor_token_7004_123456",
        chiefComplaint: "Cough for 3 days",
        historyOfPresentIllness: "Intermittent dry cough with mild fever.",
        pastMedicalHistory: "No chronic disease reported.",
        assessmentDiagnosis: "Likely upper respiratory tract infection.",
        planRecommendations:
          "Hydration, rest, and follow-up if symptoms worsen.",
      })
    ).rejects.toThrow("APPOINTMENT_INVALID_STATUS_TRANSITION");
  });
});
