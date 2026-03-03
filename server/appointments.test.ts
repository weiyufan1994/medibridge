import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/appointments/repo", () => ({
  createAppointment: vi.fn(),
  findLatestAppointmentIdByLookup: vi.fn(),
  getAppointmentById: vi.fn(),
  updateAppointmentById: vi.fn(),
}));

vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("./_core/appointmentToken", () => ({
  generateToken: vi
    .fn()
    .mockReturnValueOnce("patient_token_1234567890")
    .mockReturnValueOnce("doctor_token_1234567890")
    .mockReturnValue("token_default"),
  hashToken: vi.fn((token: string) => `hash:${token}`),
  verifyToken: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import { sendMagicLinkEmail } from "./_core/mailer";
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
      get: (name: string) => (name.toLowerCase() === "host" ? "medibridge.test" : undefined),
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("appointments router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "development";
  });

  it("create validates input and calls appointments repo + mailer", async () => {
    vi.mocked(appointmentsRepo.createAppointment).mockResolvedValue({
      insertId: 123,
    } as unknown as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    const scheduledAt = new Date("2026-03-03T09:00:00.000Z");
    const result = await caller.create({
      doctorId: 11,
      appointmentType: "video_call",
      scheduledAt,
      email: "USER@EXAMPLE.COM",
      sessionId: "session_1",
    });

    expect(appointmentsRepo.createAppointment).toHaveBeenCalledTimes(1);
    expect(appointmentsRepo.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        doctorId: 11,
        appointmentType: "video_call",
        scheduledAt,
        email: "user@example.com",
        sessionId: "session_1",
        accessTokenHash: "hash:patient_token_1234567890",
        doctorTokenHash: "hash:doctor_token_1234567890",
      })
    );
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
    expect(sendMagicLinkEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringContaining("/appointment/123?t=")
    );
    expect(result).toMatchObject({
      appointmentId: 123,
    });
    expect(result.devLink).toContain("/appointment/123?t=");
    expect(result.devDoctorLink).toContain("/visit/123?t=");
  });

  it("create rejects invalid email before repo call", async () => {
    const caller = appointmentsRouter.createCaller(createTestContext());

    await expect(
      caller.create({
        doctorId: 11,
        appointmentType: "video_call",
        scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
        email: "not_an_email",
      })
    ).rejects.toThrow();

    expect(appointmentsRepo.createAppointment).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
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
        appointmentType: "video_call",
        scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
        email: "user@example.com",
      })
    ).rejects.toThrow("请先验证您的邮箱以确认身份");

    expect(appointmentsRepo.createAppointment).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("create resolves insert id via fallback lookup when insertId missing", async () => {
    vi.mocked(appointmentsRepo.createAppointment).mockResolvedValue({} as never);
    vi.mocked(appointmentsRepo.findLatestAppointmentIdByLookup).mockResolvedValue(456 as never);

    const ctx = createTestContext();
    ctx.user = {
      ...ctx.user!,
      email: "fallback@example.com",
    };
    const caller = appointmentsRouter.createCaller(ctx);
    const scheduledAt = new Date("2026-03-03T10:00:00.000Z");
    const result = await caller.create({
      doctorId: 22,
      appointmentType: "online_chat",
      scheduledAt,
      email: "fallback@example.com",
    });

    expect(appointmentsRepo.findLatestAppointmentIdByLookup).toHaveBeenCalledTimes(1);
    expect(appointmentsRepo.findLatestAppointmentIdByLookup).toHaveBeenCalledWith({
      doctorId: 22,
      email: "fallback@example.com",
      scheduledAt,
    });
    expect(result.appointmentId).toBe(456);
  });

  it("create keeps token links silent in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.PUBLIC_URL = "https://app.medibridge.test";
    vi.mocked(appointmentsRepo.createAppointment).mockResolvedValue({
      insertId: 789,
    } as unknown as never);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const caller = appointmentsRouter.createCaller(createTestContext());
    const result = await caller.create({
      doctorId: 11,
      appointmentType: "video_call",
      scheduledAt: new Date("2026-03-03T09:00:00.000Z"),
      email: "user@example.com",
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(result.devLink).toBeUndefined();
    expect(result.devDoctorLink).toBeUndefined();

    logSpy.mockRestore();
    delete process.env.PUBLIC_URL;
  });

});
