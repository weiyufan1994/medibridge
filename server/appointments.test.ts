import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/appointments/repo", () => ({
  createAppointmentDraft: vi.fn(),
  findLatestAppointmentIdByLookup: vi.fn(),
  markAppointmentPendingPayment: vi.fn(),
  insertStatusEvent: vi.fn(),
  getAppointmentById: vi.fn(),
  updateAppointmentById: vi.fn(),
}));
vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
}));

vi.mock("./modules/payments/stripe", () => ({
  createStripeCheckoutSession: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import * as aiRepo from "./modules/ai/repo";
import { createStripeCheckoutSession } from "./modules/payments/stripe";
import { sendMagicLinkEmail } from "./_core/mailer";
import { hashToken } from "./_core/appointmentToken";
import { setCachedPatientAccessToken } from "./modules/appointments/tokenCache";
import { appointmentsRouter } from "./appointmentsRouter";

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
    const token = "paid_token_for_resend_1234567890";
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setCachedPatientAccessToken(202, token, expiresAt);

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
      accessTokenHash: hashToken(token),
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
    expect(result.devLink).toContain(`/appointment/202?t=${encodeURIComponent(token)}`);
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
    expect(sendMagicLinkEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringContaining(`/appointment/202?t=${encodeURIComponent(token)}`)
    );
  });
});
