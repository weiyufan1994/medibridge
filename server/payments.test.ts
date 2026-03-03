import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/appointments/repo", () => ({
  getCheckoutResultByStripeSessionId: vi.fn(),
  getAppointmentById: vi.fn(),
  getAppointmentByStripeSessionId: vi.fn(),
  tryMarkPaidByStripeSessionId: vi.fn(),
  trySetAppointmentAccessTokensIfEmpty: vi.fn(),
  insertStatusEvent: vi.fn(),
}));

vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("./_core/appointmentToken", () => ({
  generateToken: vi.fn(),
  hashToken: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import { sendMagicLinkEmail } from "./_core/mailer";
import { generateToken, hashToken } from "./_core/appointmentToken";
import { paymentsRouter, settleStripePaymentBySessionId } from "./paymentsRouter";

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

  it("settleStripePaymentBySessionId is idempotent for repeated calls", async () => {
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
    vi.mocked(appointmentsRepo.trySetAppointmentAccessTokensIfEmpty).mockResolvedValue(
      1 as never
    );
    vi.mocked(generateToken)
      .mockReturnValueOnce("patient-token")
      .mockReturnValueOnce("doctor-token");
    vi.mocked(hashToken).mockImplementation((token: string) => `hash:${token}`);
    vi.mocked(sendMagicLinkEmail).mockResolvedValue(undefined as never);

    const first = await settleStripePaymentBySessionId({
      stripeSessionId: "cs_test_idempotent_1",
      source: "webhook",
      eventId: "evt_1",
    });
    const repeated = await Promise.all(
      Array.from({ length: 4 }).map(() =>
        settleStripePaymentBySessionId({
          stripeSessionId: "cs_test_idempotent_1",
          source: "webhook",
          eventId: "evt_dup",
        })
      )
    );

    expect(first.alreadySettled).toBe(false);
    expect(first.patientLink).toContain("patient-token");
    expect(first.doctorLink).toContain("doctor-token");
    expect(repeated.every(entry => entry.alreadySettled)).toBe(true);
    expect(repeated.every(entry => entry.patientLink === null)).toBe(true);
    expect(repeated.every(entry => entry.doctorLink === null)).toBe(true);

    expect(appointmentsRepo.tryMarkPaidByStripeSessionId).toHaveBeenCalledTimes(5);
    expect(appointmentsRepo.trySetAppointmentAccessTokensIfEmpty).toHaveBeenCalledTimes(1);
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledTimes(1);
    expect(sendMagicLinkEmail).toHaveBeenCalledTimes(1);
    expect(generateToken).toHaveBeenCalledTimes(2);
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
    expect(appointmentsRepo.trySetAppointmentAccessTokensIfEmpty).not.toHaveBeenCalled();
    expect(appointmentsRepo.insertStatusEvent).not.toHaveBeenCalled();
    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
  });
});
