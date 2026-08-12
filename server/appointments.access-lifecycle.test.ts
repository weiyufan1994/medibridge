import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestContext,
  resetAppointmentTestState,
} from "./appointments.medical-summary.test-setup";
import { sendMagicLinkEmail } from "./_core/mailer";
import * as appointmentsRepo from "./modules/appointments/repo";
import { issueAppointmentAccessLinks } from "./modules/appointments/tokenService";
import { validateAppointmentAccessToken } from "./modules/appointments/tokenValidation";
import {
  appointmentsRouter,
  validateAppointmentToken,
} from "./routers/appointments";

describe("appointments access-link and completion lifecycle", () => {
  beforeEach(resetAppointmentTestState);

  it("resendLink rejects refunded appointments with clear error", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 201,
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "video_call",
      scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
      status: "refunded",
      paymentStatus: "refunded",
      amount: 4900,
      currency: "usd",
      paidAt: new Date("2026-03-03T08:00:00.000Z"),
      email: "user@example.com",
      sessionId: null,
      userId: 1,
      accessTokenHash: "hash_x",
      doctorTokenHash: "hash_y",
      accessTokenExpiresAt: new Date("2026-03-10T09:00:00.000Z"),
      accessTokenRevokedAt: null,
      doctorTokenRevokedAt: null,
      lastAccessAt: null,
      doctorLastAccessAt: null,
      stripeSessionId: "cs_x",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    await expect(
      caller.resendLink({
        appointmentId: 201,
      })
    ).rejects.toThrow("Cannot resend link for refunded appointment");

    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("resendLink succeeds for paid appointment and returns usable link", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 202,
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "video_call",
      scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
      status: "paid",
      paymentStatus: "paid",
      amount: 4900,
      currency: "usd",
      paidAt: new Date("2026-03-03T08:00:00.000Z"),
      email: "user@example.com",
      sessionId: null,
      userId: 1,
      accessTokenHash: "legacy_hash_patient",
      doctorTokenHash: "hash_doctor",
      accessTokenExpiresAt: expiresAt,
      accessTokenRevokedAt: null,
      doctorTokenRevokedAt: null,
      lastAccessAt: null,
      doctorLastAccessAt: null,
      stripeSessionId: "cs_paid",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    } as never);
    vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.resendLink({
      appointmentId: 202,
    });

    expect(result.ok).toBe(true);
    expect(result.devLink).toContain("/visit/202?t=");
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
    expect(sendMagicLinkEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringContaining("/visit/202?t=")
    );
    expect(issueAppointmentAccessLinks).toHaveBeenCalledWith({
      appointmentId: 202,
      createdBy: "resend_link",
    });
  });

  it("resendLink rejects when another patient token was issued within 60 seconds", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 203,
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "video_call",
      scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
      status: "paid",
      paymentStatus: "paid",
      amount: 4900,
      currency: "usd",
      paidAt: new Date("2026-03-03T08:00:00.000Z"),
      email: "user@example.com",
      sessionId: null,
      userId: 1,
      accessTokenHash: "legacy_hash_patient",
      doctorTokenHash: "hash_doctor",
      accessTokenExpiresAt: expiresAt,
      accessTokenRevokedAt: null,
      doctorTokenRevokedAt: null,
      lastAccessAt: null,
      doctorLastAccessAt: null,
      stripeSessionId: "cs_paid",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    } as never);
    vi.mocked(
      appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds
    ).mockResolvedValue(30 as never);

    const caller = appointmentsRouter.createCaller(createTestContext());

    await expect(
      caller.resendLink({
        appointmentId: 203,
      })
    ).rejects.toThrow("Please wait 30 seconds before resending again");
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
    expect(issueAppointmentAccessLinks).not.toHaveBeenCalled();
  });

  it("resendLink allows resend again after 60 seconds", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 204,
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "video_call",
      scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
      status: "paid",
      paymentStatus: "paid",
      amount: 4900,
      currency: "usd",
      paidAt: new Date("2026-03-03T08:00:00.000Z"),
      email: "user@example.com",
      sessionId: null,
      userId: 1,
      accessTokenHash: "legacy_hash_patient",
      doctorTokenHash: "hash_doctor",
      accessTokenExpiresAt: expiresAt,
      accessTokenRevokedAt: null,
      doctorTokenRevokedAt: null,
      lastAccessAt: null,
      doctorLastAccessAt: null,
      stripeSessionId: "cs_paid",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
    } as never);
    vi.mocked(
      appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds
    ).mockResolvedValue(0 as never);
    vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.resendLink({
      appointmentId: 204,
    });

    expect(result.ok).toBe(true);
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
    expect(issueAppointmentAccessLinks).toHaveBeenCalledTimes(1);
  });

  it("completeAppointment allows doctor to end consultation", async () => {
    vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
      appointmentId: 5001,
      role: "doctor",
      tokenId: 91,
      tokenHash: "b".repeat(64),
      expiresAt: new Date("2026-03-05T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 5001,
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
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 5001,
      status: "ended",
      paymentStatus: "paid",
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.completeAppointment({
      appointmentId: 5001,
      token: "doctor_token_1234567890",
    });

    expect(result).toMatchObject({
      appointmentId: 5001,
      status: "ended",
      paymentStatus: "paid",
    });
    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 5001,
        allowedFrom: ["paid", "active"],
        toStatus: "ended",
        operatorType: "doctor",
        reason: "doctor_completed_consultation",
      })
    );
  });

  it("completeAppointment rejects non-doctor token", async () => {
    vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
      appointmentId: 5002,
      role: "patient",
      tokenId: 92,
      tokenHash: "c".repeat(64),
      expiresAt: new Date("2026-03-05T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 5002,
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
        lastAccessAt: null,
        doctorLastAccessAt: null,
        stripeSessionId: "cs_paid",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    await expect(
      caller.completeAppointment({
        appointmentId: 5002,
        token: "patient_token_1234567890",
      })
    ).rejects.toThrow("Only doctor can complete appointment");
  });

  it("completeAppointment rejects invalid status transition", async () => {
    vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
      appointmentId: 5003,
      role: "doctor",
      tokenId: 93,
      tokenHash: "d".repeat(64),
      expiresAt: new Date("2026-03-05T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 5003,
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
      caller.completeAppointment({
        appointmentId: 5003,
        token: "doctor_token_abcdef123456",
      })
    ).rejects.toThrow("APPOINTMENT_INVALID_STATUS_TRANSITION");
  });

  it("validateAppointmentToken delegates to tokenValidation and returns role", async () => {
    const result = await validateAppointmentToken(
      303,
      "patient_token_2_1234567890",
      "join_room"
    );

    expect(result.role).toBe("patient");
    expect(validateAppointmentAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "patient_token_2_1234567890",
        expectedAppointmentId: 303,
        action: "join_room",
      })
    );
  });
});
