import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/appointments/repo", () => ({
  getCheckoutResultByStripeSessionId: vi.fn(),
  getAppointmentById: vi.fn(),
  getAppointmentByStripeSessionId: vi.fn(),
  tryMarkPaidByStripeSessionId: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
  getAppointmentTokenByHash: vi.fn(),
  updateTokenUsageIfAllowed: vi.fn(),
  saveTokenFirstSeen: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
  insertStatusEvent: vi.fn(),
}));

vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("./modules/appointments/tokenService", () => ({
  issueAppointmentAccessLinks: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import { sendMagicLinkEmail } from "./_core/mailer";
import { issueAppointmentAccessLinks } from "./modules/appointments/tokenService";
import { paymentsRouter, settleStripePaymentBySessionId } from "./paymentsRouter";
import {
  clearTokenValidationStateForTests,
  validateAppointmentAccessToken,
} from "./modules/appointments/tokenValidation";

function createTestContext(): TrpcContext {
  return {
    user: null,
    userId: null,
    deviceId: null,
    req: {
      protocol: "https",
      headers: { host: "medibridge.test" },
      get: (name: string) =>
        name.toLowerCase() === "host" ? "medibridge.test" : undefined,
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("payments router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenValidationStateForTests();
    process.env.APP_BASE_URL = "https://medibridge.test";
  });

  it("getCheckoutResult returns checkout summary by stripe session id without token", async () => {
    vi.mocked(appointmentsRepo.getCheckoutResultByStripeSessionId).mockResolvedValue({
      id: 321,
      paymentStatus: "paid",
      status: "paid",
      email: "alicebob@gmail.com",
      lastAccessAt: new Date("2026-03-03T08:20:00.000Z"),
      paidAt: new Date("2026-03-03T08:00:00.000Z"),
    } as never);

    const caller = paymentsRouter.createCaller(createTestContext());
    const result = await caller.getCheckoutResult({
      stripeSessionId: "cs_test_12345678",
    });

    expect(appointmentsRepo.getCheckoutResultByStripeSessionId).toHaveBeenCalledWith(
      "cs_test_12345678"
    );
    expect(result).toMatchObject({
      appointmentId: 321,
      paymentStatus: "paid",
      status: "paid",
      email: "a***b@gmail.com",
      canResendLink: true,
    });
    expect(result.messageForUser).toContain("Payment successful");
  });

  it("getCheckoutResult throws NOT_FOUND when stripe session does not exist", async () => {
    vi.mocked(appointmentsRepo.getCheckoutResultByStripeSessionId).mockResolvedValue(
      null as never
    );

    const caller = paymentsRouter.createCaller(createTestContext());
    await expect(
      caller.getCheckoutResult({ stripeSessionId: "cs_not_found_1234" })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "NOT_FOUND",
      message: "Appointment not found for Stripe session",
    });
  });

  it("settleStripePaymentBySessionId remains idempotent across 5 webhook replays", async () => {
    vi.mocked(appointmentsRepo.tryMarkPaidByStripeSessionId)
      .mockResolvedValueOnce(1 as never)
      .mockResolvedValue(0 as never);
    vi.mocked(appointmentsRepo.getAppointmentByStripeSessionId).mockResolvedValue({
      id: 9527,
      status: "paid",
      paymentStatus: "paid",
      email: "user@example.com",
      scheduledAt: new Date("2026-03-03T10:00:00.000Z"),
    } as never);
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: { token: "patient-token" },
      doctor: { token: "doctor-token" },
      expiresAt: new Date("2026-03-04T00:00:00.000Z"),
      patientLink: "https://medibridge.test/room?token=patient-token",
      doctorLink: "https://medibridge.test/room?token=doctor-token",
    } as never);
    vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined as never);

    const first = await settleStripePaymentBySessionId({
      stripeSessionId: "cs_test_idempotent_1",
      source: "webhook",
      eventId: "evt_1",
    });
    const repeated = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        settleStripePaymentBySessionId({
          stripeSessionId: "cs_test_idempotent_1",
          source: "webhook",
          eventId: "evt_dup",
        })
      )
    );

    expect(first.alreadySettled).toBe(false);
    expect(first.patientLink).toContain("/room?token=patient-token");
    expect(first.doctorLink).toContain("/room?token=doctor-token");
    expect(repeated.every(entry => entry.alreadySettled)).toBe(true);
    expect(repeated.every(entry => entry.patientLink === null)).toBe(true);
    expect(repeated.every(entry => entry.doctorLink === null)).toBe(true);

    expect(appointmentsRepo.tryMarkPaidByStripeSessionId).toHaveBeenCalledTimes(6);
    expect(issueAppointmentAccessLinks).toHaveBeenCalledTimes(1);
    expect(issueAppointmentAccessLinks).toHaveBeenCalledWith({
      appointmentId: 9527,
      createdBy: "stripe_webhook",
    });
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
  });

  it("E2E path: payment -> webhook settlement -> issue links -> join room", async () => {
    vi.mocked(appointmentsRepo.tryMarkPaidByStripeSessionId).mockResolvedValue(1 as never);
    vi.mocked(appointmentsRepo.getAppointmentByStripeSessionId).mockResolvedValue({
      id: 7001,
      status: "paid",
      paymentStatus: "paid",
      email: "patient@example.com",
      scheduledAt: new Date("2026-03-03T10:00:00.000Z"),
      paidAt: new Date("2026-03-03T09:50:00.000Z"),
      amount: 4900,
      currency: "usd",
    } as never);
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: { token: "patient-room-token" },
      doctor: { token: "doctor-room-token" },
      expiresAt: new Date(Date.now() + 60_000),
      patientLink: "https://medibridge.test/visit?t=patient-room-token",
      doctorLink: "https://medibridge.test/visit?t=doctor-room-token",
    } as never);
    vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined as never);

    const settled = await settleStripePaymentBySessionId({
      stripeSessionId: "cs_e2e_path_1",
      source: "webhook",
      eventId: "evt_e2e_1",
    });

    expect(settled.alreadySettled).toBe(false);
    expect(settled.patientLink).toContain("patient-room-token");
    expect(settled.doctorLink).toContain("doctor-room-token");

    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
      id: 501,
      appointmentId: 7001,
      role: "patient",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      useCount: 0,
      maxUses: 10,
      revokedAt: null,
      revokeReason: null,
      ipFirstSeen: null,
      uaFirstSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 7001,
      status: "paid",
      paymentStatus: "paid",
      email: "patient@example.com",
      doctorId: 1,
      triageSessionId: 1,
      appointmentType: "online_chat",
      amount: 4900,
      currency: "usd",
      scheduledAt: new Date("2026-03-03T10:00:00.000Z"),
      paidAt: new Date("2026-03-03T09:50:00.000Z"),
      stripeSessionId: "cs_e2e_path_1",
      userId: 1,
      sessionId: null,
      notes: null,
      lastAccessAt: null,
      doctorLastAccessAt: null,
      createdAt: new Date("2026-03-03T09:00:00.000Z"),
      updatedAt: new Date("2026-03-03T09:50:00.000Z"),
    } as never);
    vi.mocked(appointmentsRepo.updateTokenUsageIfAllowed).mockResolvedValue(1 as never);
    vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(undefined as never);

    const access = await validateAppointmentAccessToken({
      token: "patient-room-token",
      action: "join_room",
      req: {
        ip: "127.0.0.1",
        headers: {
          "user-agent": "vitest-e2e",
        },
      } as never,
    });

    expect(access.appointmentId).toBe(7001);
    expect(access.role).toBe("patient");
  });

  it("settleStripePaymentBySessionId throws when claim fails and appointment is not paid", async () => {
    vi.mocked(appointmentsRepo.tryMarkPaidByStripeSessionId).mockResolvedValue(0 as never);
    vi.mocked(appointmentsRepo.getAppointmentByStripeSessionId).mockResolvedValue({
      id: 123,
      status: "pending_payment",
      paymentStatus: "failed",
      email: "user@example.com",
      scheduledAt: new Date("2026-03-03T10:00:00.000Z"),
    } as never);

    await expect(
      settleStripePaymentBySessionId({
        stripeSessionId: "cs_test_invalid_state_1",
        source: "webhook",
        eventId: "evt_invalid",
      })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "PRECONDITION_FAILED",
      message: "Appointment is not in settleable payment state",
    });
    expect(issueAppointmentAccessLinks).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it("settleStripePaymentBySessionId rejects stale stripe session after payment re-init", async () => {
    vi.mocked(appointmentsRepo.tryMarkPaidByStripeSessionId).mockResolvedValue(0 as never);
    vi.mocked(appointmentsRepo.getAppointmentByStripeSessionId).mockResolvedValue(
      null as never
    );

    await expect(
      settleStripePaymentBySessionId({
        stripeSessionId: "cs_old_stale",
        source: "webhook",
        eventId: "evt_stale",
      })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "NOT_FOUND",
      message: "Appointment not found for Stripe session",
    });
  });

  it("createCheckoutSessionForAppointment re-initiates pending payment", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 66,
      amount: 4900,
      currency: "usd",
      status: "expired",
      paymentStatus: "expired",
      stripeSessionId: "cs_old",
    } as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);

    const caller = paymentsRouter.createCaller(createTestContext());
    const result = await caller.createCheckoutSessionForAppointment({
      appointmentId: 66,
    });

    expect(result.appointmentId).toBe(66);
    expect(result.status).toBe("pending_payment");
    expect(result.paymentStatus).toBe("pending");
    expect(result.checkoutSessionUrl).toContain("mockPaid=1");
    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 66, reason: "payment_reinitiated" })
    );
  });
});
