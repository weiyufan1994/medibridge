import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestContext,
  resetAppointmentTestState,
} from "./appointments.medical-summary.test-setup";
import * as appointmentsRepo from "./modules/appointments/repo";
import { aiTriageSessionApi } from "./modules/ai/publicApi";
import { appointmentsRouter } from "./routers/appointments";

describe("appointments doctor workbench", () => {
  beforeEach(resetAppointmentTestState);

  it("createV2 creates pending_payment appointment and returns checkout session url", async () => {
    vi.mocked(appointmentsRepo.createAppointmentDraft).mockResolvedValue({
      insertId: 1001,
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.createV2({
      doctorId: 11,
      slotId: 501,
      contact: { email: "user@example.com" },
      appointmentType: "online_chat",
      triageSessionId: 99,
    });

    expect(result.appointmentId).toBe(1001);
    expect(result.status).toBe("pending_payment");
    expect(result.paymentStatus).toBe("pending");
    expect(result.slotId).toBe(501);
    expect(result.checkoutSessionUrl).toContain("checkout.mock");
  });

  it("listDoctorWorkbench returns upcoming and recent appointments for one doctor", async () => {
    vi.mocked(appointmentsRepo.listAppointmentsByDoctor).mockResolvedValue([
      {
        id: 9001,
        slotId: 501,
        doctorId: 11,
        appointmentType: "online_chat",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
        status: "paid",
        paymentStatus: "paid",
        email: "patient@example.com",
        notes: JSON.stringify({
          chiefComplaint: "cough",
          packageId: "chat_standard_60m",
        }),
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      {
        id: 9002,
        slotId: 502,
        doctorId: 11,
        appointmentType: "online_chat",
        scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
        status: "completed",
        paymentStatus: "paid",
        email: "old@example.com",
        notes: JSON.stringify({
          chiefComplaint: "headache",
          packageId: "chat_quick_30m",
        }),
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ] as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.listDoctorWorkbench({
      doctorId: 11,
      limit: 20,
    });

    expect(result.upcoming).toHaveLength(1);
    expect(result.recent).toHaveLength(1);
    expect(result.upcoming[0]).toMatchObject({
      id: 9001,
      patientEmail: "patient@example.com",
      chiefComplaint: "cough",
      packageId: "chat_standard_60m",
    });
  });

  it("getDoctorWorkbenchAppointmentDetail returns localized intake and summary for bound doctor", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 9001,
      slotId: 501,
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "online_chat",
      scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
      status: "active",
      paymentStatus: "paid",
      amount: 4900,
      currency: "usd",
      paidAt: new Date("2026-03-03T08:00:00.000Z"),
      email: "patient@example.com",
      sessionId: "patient-session-1",
      userId: 1,
      lastAccessAt: null,
      doctorLastAccessAt: null,
      stripeSessionId: "cs_paid",
      notes: JSON.stringify({
        chiefComplaint: "cough",
        medicalHistory: "asthma",
        packageId: "chat_standard_60m",
        packageDurationMinutes: 60,
      }),
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    } as never);
    vi.mocked(aiTriageSessionApi.getById).mockResolvedValue({
      id: 99,
      userId: 1,
      status: "completed",
      summary: "Likely upper respiratory infection",
    });
    vi.mocked(
      appointmentsRepo.getMedicalSummaryByAppointmentId
    ).mockResolvedValue({
      id: 73,
      appointmentId: 9001,
      chiefComplaint: "Cough",
      historyOfPresentIllness: "Two days of cough",
      pastMedicalHistory: "Asthma",
      assessmentDiagnosis: "URI",
      planRecommendations: "Hydration and follow-up",
      source: "doctor_reviewed_ai_draft",
      signedBy: 1,
      createdAt: new Date("2026-03-03T10:00:00.000Z"),
      updatedAt: new Date("2026-03-03T10:05:00.000Z"),
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.getDoctorWorkbenchAppointmentDetail({
      appointmentId: 9001,
      lang: "en",
    });

    expect(result).toMatchObject({
      id: 9001,
      patient: {
        email: "patient@example.com",
        sessionId: "patient-session-1",
      },
      triageSummary: "Likely upper respiratory infection",
      packageId: "chat_standard_60m",
      consultationDurationMinutes: 60,
      consultationTotalMinutes: 60,
      canStartConsultation: false,
      canOpenRoom: true,
      canCompleteConsultation: true,
      hasSignedMedicalSummary: true,
      intake: {
        chiefComplaint: "cough",
        medicalHistory: "asthma",
      },
      medicalSummary: {
        assessmentDiagnosis: "URI",
      },
    });
  });

  it("startDoctorWorkbenchAppointment transitions paid visit to active", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 9010,
      doctorId: 11,
      status: "paid",
      paymentStatus: "paid",
    } as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
      current: {
        id: 9010,
        status: "paid",
        paymentStatus: "paid",
      },
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById)
      .mockResolvedValueOnce({
        id: 9010,
        doctorId: 11,
        status: "paid",
        paymentStatus: "paid",
      } as never)
      .mockResolvedValueOnce({
        id: 9010,
        doctorId: 11,
        status: "active",
        paymentStatus: "paid",
      } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.startDoctorWorkbenchAppointment({
      appointmentId: 9010,
    });

    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 9010,
        toStatus: "active",
        toPaymentStatus: "paid",
        operatorType: "doctor",
      })
    );
    expect(result).toEqual({
      appointmentId: 9010,
      status: "active",
      paymentStatus: "paid",
    });
  });

  it("cancel rejects illegal transition with unified error code", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 3001,
      status: "refunded",
      paymentStatus: "refunded",
      stripeSessionId: "cs_1",
      paidAt: new Date("2026-03-03T00:00:00.000Z"),
    } as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: false,
      reason: "illegal_transition",
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    await expect(caller.cancel({ appointmentId: 3001 })).rejects.toThrow(
      "APPOINTMENT_INVALID_STATUS_TRANSITION"
    );
  });
});
