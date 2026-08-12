import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTestContext,
  resetAppointmentTestState,
} from "./appointments.medical-summary.test-setup";
import * as appointmentsRepo from "./modules/appointments/repo";
import { issueAppointmentAccessLinks } from "./modules/appointments/tokenService";
import { appointmentsRouter } from "./routers/appointments";

describe("appointments creation and room access", () => {
  beforeEach(resetAppointmentTestState);

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

    expect(appointmentsRepo.markAppointmentPendingPayment).toHaveBeenCalledWith(
      {
        appointmentId: 123,
        stripeSessionId: "cs_test_abc",
        paymentProvider: "stripe",
      }
    );

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
    vi.mocked(appointmentsRepo.createAppointmentDraft).mockResolvedValue(
      {} as never
    );
    vi.mocked(
      appointmentsRepo.findLatestAppointmentIdByLookup
    ).mockResolvedValue(456 as never);

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

    expect(
      appointmentsRepo.findLatestAppointmentIdByLookup
    ).toHaveBeenCalledWith({
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

  it("openMyRoom blocks future scheduled appointment with APPOINTMENT_NOT_STARTED", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 205,
      doctorId: 11,
      triageSessionId: 99,
      appointmentType: "video_call",
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
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
    } as never);

    const caller = appointmentsRouter.createCaller(createTestContext());
    await expect(caller.openMyRoom({ appointmentId: 205 })).rejects.toThrow(
      "APPOINTMENT_NOT_STARTED"
    );
    expect(issueAppointmentAccessLinks).not.toHaveBeenCalled();
  });

  it("openMyRoom allows future scheduled appointment when VISIT_ROOM_TEST_MODE is enabled", async () => {
    process.env.VISIT_ROOM_TEST_MODE = "1";
    try {
      vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
        id: 205,
        doctorId: 11,
        triageSessionId: 99,
        appointmentType: "video_call",
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
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
      } as never);

      const caller = appointmentsRouter.createCaller(createTestContext());
      const result = await caller.openMyRoom({ appointmentId: 205 });

      expect(result.joinUrl).toContain("/visit/205");
      expect(issueAppointmentAccessLinks).toHaveBeenCalled();
    } finally {
      delete process.env.VISIT_ROOM_TEST_MODE;
    }
  });
});
