import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/appointments/repo", () => ({
  createAppointmentDraft: vi.fn(),
  findLatestAppointmentIdByLookup: vi.fn(),
  markAppointmentPendingPayment: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
  insertStatusEvent: vi.fn(),
  getAppointmentById: vi.fn(),
  getAppointmentTokenCooldownRemainingSeconds: vi.fn(),
  updateAppointmentById: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));
vi.mock("./modules/appointments/tokenService", () => ({
  issueAppointmentAccessLinks: vi.fn(),
}));
vi.mock("./modules/appointments/tokenValidation", () => ({
  validateAppointmentAccessToken: vi.fn(),
  revokeAppointmentAccessToken: vi.fn(),
}));
vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
  createAiChatSession: vi.fn(),
}));

vi.mock("./modules/payments/stripe", () => ({
  createStripeCheckoutSession: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import * as aiRepo from "./modules/ai/repo";
import { createStripeCheckoutSession } from "./modules/payments/stripe";
import { sendMagicLinkEmail } from "./_core/mailer";
import { issueAppointmentAccessLinks } from "./modules/appointments/tokenService";
import { validateAppointmentAccessToken } from "./modules/appointments/tokenValidation";
import { appointmentsRouter, validateAppointmentToken } from "./routers/appointments";

function createTestContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "guest_openid",
      name: null,
      email: "user@example.com",
      isGuest: 1,
      deviceId: "device_1",
      loginMethod: "guest",
      role: "free",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      lastSignedIn: new Date("2026-03-01T00:00:00.000Z"),
    },
    userId: 1,
    deviceId: "device_1",
    req: {
      protocol: "https",
      headers: { host: "medibridge.test" },
      get: (name: string) =>
        name.toLowerCase() === "host" ? "medibridge.test" : undefined,
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("appointments router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
    process.env.APP_BASE_URL = "https://medibridge.test";
    vi.mocked(
      appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds
    ).mockResolvedValue(0 as never);
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: { token: "patient-token" },
      doctor: { token: "doctor-token" },
      expiresAt: new Date("2026-03-05T00:00:00.000Z"),
      patientLink: "https://medibridge.test/visit/202?t=patient-token",
      doctorLink: "https://medibridge.test/visit/202?t=doctor-token",
    } as never);
    vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
      appointmentId: 303,
      role: "patient",
      tokenId: 1,
      tokenHash: "a".repeat(64),
      expiresAt: new Date("2026-03-05T00:00:00.000Z"),
      displayInfo: { patientEmail: "user@example.com", doctorId: 11 },
      appointment: {
        id: 303,
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
        lastAccessAt: null,
        doctorLastAccessAt: null,
        stripeSessionId: "cs_paid",
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    } as never);

    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue({
      id: 99,
      userId: 1,
      status: "completed",
    } as never);

    vi.mocked(createStripeCheckoutSession).mockReturnValue({
      id: "cs_test_abc",
      url: "https://checkout.mock/cs_test_abc",
    });
  });

  it("create validates input and calls draft + checkout flow", async () => {
    vi.mocked(appointmentsRepo.createAppointmentDraft).mockResolvedValue({
      insertId: 123,
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const scheduledAt = new Date("2026-03-03T09:00:00.000Z");
    const result = await caller.create({
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "video_call",
      scheduledAt,
      email: "USER@EXAMPLE.COM",
      sessionId: "session_1",
    });

    expect(appointmentsRepo.createAppointmentDraft).toHaveBeenCalledTimes(1);
    expect(appointmentsRepo.createAppointmentDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorId: 11,
        triageSessionId: 99,
        appointmentType: "video_call",
        scheduledAt,
        email: "user@example.com",
        sessionId: "session_1",
      })
    );

    expect(appointmentsRepo.markAppointmentPendingPayment).toHaveBeenCalledWith({
      appointmentId: 123,
      stripeSessionId: "cs_test_abc",
    });

    expect(result).toMatchObject({
      appointmentId: 123,
      checkoutUrl: "https://checkout.mock/cs_test_abc",
      status: "pending_payment",
      paymentStatus: "pending",
      stripeSessionId: "cs_test_abc",
    });
  });

  it("create rejects invalid email before repo call", async () => {
    const caller = appointmentsRouter.createCaller(createTestContext());

    await expect(
      caller.create({
        doctorId: 11,
        triageSessionId: 99,
        appointmentType: "video_call",
        scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
        email: "not_an_email",
      })
    ).rejects.toThrow();

    expect(appointmentsRepo.createAppointmentDraft).not.toHaveBeenCalled();
  });

  it("create rejects when current user email is missing or mismatched", async () => {
    const ctx = createTestContext();
    ctx.user = {
      ...ctx.user!,
      email: "another@example.com",
    };
    const caller = appointmentsRouter.createCaller(ctx);

    await expect(
      caller.create({
        doctorId: 11,
        triageSessionId: 99,
        appointmentType: "video_call",
        scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
        email: "user@example.com",
      })
    ).rejects.toThrow("请先验证您的邮箱以确认身份");

    expect(appointmentsRepo.createAppointmentDraft).not.toHaveBeenCalled();
  });

  it("create resolves insert id via fallback lookup when insertId missing", async () => {
    vi.mocked(appointmentsRepo.createAppointmentDraft).mockResolvedValue({} as never);
    vi.mocked(appointmentsRepo.findLatestAppointmentIdByLookup).mockResolvedValue(
      456 as never
    );

    const ctx = createTestContext();
    ctx.user = {
      ...ctx.user!,
      email: "fallback@example.com",
    };
    const caller = appointmentsRouter.createCaller(ctx);
    const scheduledAt = new Date("2026-03-03T10:00:00.000Z");
    const result = await caller.create({
      doctorId: 22,
      triageSessionId: 99,
      appointmentType: "online_chat",
      scheduledAt,
      email: "fallback@example.com",
    });

    expect(appointmentsRepo.findLatestAppointmentIdByLookup).toHaveBeenCalledWith({
      doctorId: 22,
      email: "fallback@example.com",
      scheduledAt,
      triageSessionId: 99,
      status: "draft",
      paymentStatus: "unpaid",
    });
    expect(result.appointmentId).toBe(456);
  });

  it("create hides stripe session id in production", async () => {
    process.env.NODE_ENV = "production";
    vi.mocked(appointmentsRepo.createAppointmentDraft).mockResolvedValue({
      insertId: 789,
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.create({
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "video_call",
      scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
      email: "user@example.com",
    });

    expect(result.stripeSessionId).toBeUndefined();
  });

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

  it("createV2 creates pending_payment appointment and returns checkout session url", async () => {
    vi.mocked(appointmentsRepo.createAppointmentDraft).mockResolvedValue({
      insertId: 1001,
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.createV2({
      doctorId: 11,
      contact: { email: "user@example.com" },
      appointmentType: "online_chat",
      triageSessionId: 99,
    });

    expect(result.appointmentId).toBe(1001);
    expect(result.status).toBe("pending_payment");
    expect(result.paymentStatus).toBe("pending");
    expect(result.checkoutSessionUrl).toContain("checkout.mock");
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
