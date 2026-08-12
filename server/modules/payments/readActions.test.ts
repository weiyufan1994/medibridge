import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../appointments/publicApi", () => ({
  appointmentPaymentApi: {
    getById: vi.fn(),
    getCheckoutResultBySessionId: vi.fn(),
  },
}));

import { appointmentPaymentApi } from "../appointments/publicApi";
import {
  getCheckoutResultByStripeSession,
  getPaymentStatusByAppointmentForUser,
} from "./readActions";

function checkout(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    paymentStatus: "paid",
    status: "paid",
    email: "patient@example.com",
    lastAccessAt: null,
    paidAt: null,
    ...overrides,
  } as never;
}

describe("payment read actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["a@example.com", "***@example.com"],
    ["ab@example.com", "a***@example.com"],
    ["alice@example.com", "a***e@example.com"],
    ["invalid", "***"],
  ])("masks checkout email %s", async (email, masked) => {
    vi.mocked(
      appointmentPaymentApi.getCheckoutResultBySessionId
    ).mockResolvedValue(checkout({ email }));
    await expect(
      getCheckoutResultByStripeSession({ stripeSessionId: "session-10" })
    ).resolves.toMatchObject({ email: masked, canResendLink: true });
  });

  it.each([
    ["pending", "pending_payment", "Payment is still processing"],
    ["failed", "pending_payment", "Payment failed"],
    ["refunded", "refunded", "payment was refunded"],
    ["canceled", "canceled", "appointment was canceled"],
    ["expired", "expired", "appointment has expired"],
    ["unpaid", "draft", "not completed"],
  ])(
    "returns stable user guidance for %s/%s",
    async (paymentStatus, status, text) => {
      vi.mocked(
        appointmentPaymentApi.getCheckoutResultBySessionId
      ).mockResolvedValue(checkout({ paymentStatus, status }));
      const result = await getCheckoutResultByStripeSession({
        stripeSessionId: "session-10",
      });
      expect(result.canResendLink).toBe(false);
      expect(result.messageForUser).toContain(text);
    }
  );

  it("serializes checkout timestamps and rejects unknown sessions", async () => {
    vi.mocked(
      appointmentPaymentApi.getCheckoutResultBySessionId
    ).mockResolvedValueOnce(
      checkout({
        lastAccessAt: new Date("2026-01-02T00:00:00.000Z"),
        paidAt: new Date("2026-01-01T00:00:00.000Z"),
      })
    );
    await expect(
      getCheckoutResultByStripeSession({ stripeSessionId: "session-10" })
    ).resolves.toMatchObject({
      lastAccessAt: "2026-01-02T00:00:00.000Z",
      paidAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(
      appointmentPaymentApi.getCheckoutResultBySessionId
    ).mockResolvedValueOnce(null as never);
    await expect(
      getCheckoutResultByStripeSession({ stripeSessionId: "missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("allows payment status access by user id or normalized email", async () => {
    vi.mocked(appointmentPaymentApi.getById).mockResolvedValue(
      checkout({
        userId: 20,
        stripeSessionId: "session-10",
      })
    );
    await expect(
      getPaymentStatusByAppointmentForUser({ appointmentId: 10, userId: 20 })
    ).resolves.toMatchObject({ appointmentId: 10, paymentStatus: "paid" });
    await expect(
      getPaymentStatusByAppointmentForUser({
        appointmentId: 10,
        userId: 99,
        userEmail: " PATIENT@EXAMPLE.COM ",
      })
    ).resolves.toMatchObject({ stripeSessionId: "session-10" });
  });

  it("rejects missing appointments and non-owners", async () => {
    vi.mocked(appointmentPaymentApi.getById).mockResolvedValueOnce(
      null as never
    );
    await expect(
      getPaymentStatusByAppointmentForUser({ appointmentId: 10, userId: 20 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    vi.mocked(appointmentPaymentApi.getById).mockResolvedValueOnce(
      checkout({ userId: 20 })
    );
    await expect(
      getPaymentStatusByAppointmentForUser({
        appointmentId: 10,
        userId: 99,
        userEmail: "other@example.com",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
