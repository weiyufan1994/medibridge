import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./accessValidation", () => ({
  getAppointmentByIdOrThrow: vi.fn(),
}));

import { getAppointmentByIdOrThrow } from "./accessValidation";
import { resendPaymentLinkByPatient } from "./paymentActions";

describe("patient payment link action", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the appointment, preserves operator context, and maps checkout aliases", async () => {
    const appointment = { id: 41, status: "expired", paymentStatus: "expired" };
    vi.mocked(getAppointmentByIdOrThrow).mockResolvedValue(
      appointment as never
    );
    const reinitiateCheckout = vi.fn().mockResolvedValue({
      appointmentId: 41,
      checkoutSessionUrl: "https://checkout.test/session-41",
      status: "pending_payment",
      paymentStatus: "pending",
      stripeSessionId: "session-41",
    });

    await expect(
      resendPaymentLinkByPatient({
        appointmentId: 41,
        operatorId: 9,
        baseUrl: "https://medibridge.test",
        reinitiateCheckout,
      })
    ).resolves.toEqual({
      appointmentId: 41,
      checkoutUrl: "https://checkout.test/session-41",
      checkoutSessionUrl: "https://checkout.test/session-41",
      status: "pending_payment",
      paymentStatus: "pending",
      stripeSessionId: "session-41",
    });
    expect(getAppointmentByIdOrThrow).toHaveBeenCalledWith(41);
    expect(reinitiateCheckout).toHaveBeenCalledWith({
      appointment,
      baseUrl: "https://medibridge.test",
      operatorType: "patient",
      operatorId: 9,
    });
  });
});
