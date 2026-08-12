import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestContext,
  mockAppointmentAccessValidation,
  resetAppointmentTestState,
} from "./appointments.medical-summary.test-setup";
import * as appointmentsRepo from "./modules/appointments/repo";
import * as visitRepo from "./modules/visit/repo";
import { invokeLLM } from "./_core/llm";
import { appointmentsRouter } from "./routers/appointments";

describe("appointments medical summary draft", () => {
  beforeEach(resetAppointmentTestState);

  it("generateMedicalSummaryDraft returns pending on first non-forced request", async () => {
    mockAppointmentAccessValidation({
      appointmentId: 7001,
      role: "doctor",
      tokenId: 201,
      tokenHash: "f".repeat(64),
      expiresAt: new Date("2026-03-08T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 7001,
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
    vi.mocked(
      appointmentsRepo.getMedicalSummaryByAppointmentId
    ).mockResolvedValue(null as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.generateMedicalSummaryDraft({
      appointmentId: 7001,
      token: "doctor_token_7001_123456",
      lang: "en",
    });

    expect(result.source).toBe("pending");
    expect(result.chiefComplaint).toBe("");
  });

  it("generateMedicalSummaryDraft forceRegenerate returns fallback draft immediately", async () => {
    mockAppointmentAccessValidation({
      appointmentId: 7006,
      role: "doctor",
      tokenId: 206,
      tokenHash: "k".repeat(64),
      expiresAt: new Date("2026-03-08T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 7006,
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
    vi.mocked(
      appointmentsRepo.getMedicalSummaryByAppointmentId
    ).mockResolvedValue(null as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.generateMedicalSummaryDraft({
      appointmentId: 7006,
      token: "doctor_token_7006_123456",
      lang: "en",
      forceRegenerate: true,
    });

    expect(result.source).toBe("fallback");
    expect(result.chiefComplaint.length).toBeGreaterThan(0);
  });

  it("generateMedicalSummaryDraft persists fallback when llm output is invalid", async () => {
    mockAppointmentAccessValidation({
      appointmentId: 7007,
      role: "doctor",
      tokenId: 207,
      tokenHash: "l".repeat(64),
      expiresAt: new Date("2026-03-08T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 7007,
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
    vi.mocked(
      appointmentsRepo.getMedicalSummaryByAppointmentId
    ).mockResolvedValue(null as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([
      {
        content: "patient has mild fever and cough",
        translatedContent: null,
        senderType: "patient",
        createdAt: new Date("2026-03-03T09:10:00.000Z"),
      },
    ] as never);
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: '{"unexpected":"shape"}',
          },
        },
      ],
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.generateMedicalSummaryDraft({
      appointmentId: 7007,
      token: "doctor_token_7007_123456",
      lang: "en",
      forceRegenerate: true,
    });

    expect(result.source).toBe("fallback");
    expect(
      appointmentsRepo.upsertMedicalSummaryByAppointmentId
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 7007,
        source: "ai_draft_fallback",
      })
    );
  });

  it("generateMedicalSummaryDraft rejects non-doctor token", async () => {
    mockAppointmentAccessValidation({
      appointmentId: 7002,
      role: "patient",
      tokenId: 202,
      tokenHash: "g".repeat(64),
      expiresAt: new Date("2026-03-08T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 7002,
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

    const caller = appointmentsRouter.createCaller(createTestContext());
    await expect(
      caller.generateMedicalSummaryDraft({
        appointmentId: 7002,
        token: "patient_token_7002_123456",
        lang: "en",
      })
    ).rejects.toThrow("Only doctor can generate medical summary draft");
  });
});
