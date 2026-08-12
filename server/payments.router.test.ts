import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/payments/readActions", () => ({
  getCheckoutResultByStripeSession: vi.fn(),
  getPaymentStatusByAppointmentForUser: vi.fn(),
}));
vi.mock("./workflows/appointmentPayments/publicApi", () => ({
  confirmMockCheckoutAction: vi.fn(),
  confirmMockCheckoutByAppointmentAction: vi.fn(),
  createCheckoutSessionForAppointmentAction: vi.fn(),
}));

import * as readActions from "./modules/payments/readActions";
import {
  confirmMockCheckoutAction,
  confirmMockCheckoutByAppointmentAction,
  createCheckoutSessionForAppointmentAction,
} from "./workflows/appointmentPayments/publicApi";
import { paymentsRouter } from "./routers/payments";

function caller(authenticated = false) {
  return paymentsRouter.createCaller({
    user: authenticated
      ? { id: 20, email: "patient@example.com", role: "free" }
      : null,
    req: { headers: {} },
    res: {},
  } as never);
}

describe("payments router delegation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates appointment checkout creation", async () => {
    vi.mocked(createCheckoutSessionForAppointmentAction).mockResolvedValue({
      appointmentId: 10,
      checkoutSessionUrl: "https://checkout.test/session-10",
      status: "pending_payment",
      paymentStatus: "pending",
      stripeSessionId: "session-10",
    });
    await caller().createCheckoutSessionForAppointment({ appointmentId: 10 });
    expect(createCheckoutSessionForAppointmentAction).toHaveBeenCalledWith({
      appointmentId: 10,
      operatorId: null,
    });
  });

  it("delegates checkout result and protected owner status", async () => {
    vi.mocked(readActions.getCheckoutResultByStripeSession).mockResolvedValue({
      appointmentId: 10,
      status: "paid",
      paymentStatus: "paid",
      email: "p***t@example.com",
      lastAccessAt: null,
      paidAt: null,
      canResendLink: true,
      messageForUser: "Payment successful.",
    });
    await caller().getCheckoutResult({ stripeSessionId: " session-10 " });
    expect(readActions.getCheckoutResultByStripeSession).toHaveBeenCalledWith({
      stripeSessionId: "session-10",
    });

    vi.mocked(
      readActions.getPaymentStatusByAppointmentForUser
    ).mockResolvedValue({
      appointmentId: 10,
      status: "paid",
      paymentStatus: "paid",
      paidAt: null,
      stripeSessionId: "session-10",
    } as never);
    await caller(true).getStatus({ appointmentId: 10 });
    expect(
      readActions.getPaymentStatusByAppointmentForUser
    ).toHaveBeenCalledWith({
      appointmentId: 10,
      userId: 20,
      userEmail: "patient@example.com",
    });
    await expect(
      caller().getStatus({ appointmentId: 10 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("delegates both mock confirmation paths", async () => {
    vi.mocked(confirmMockCheckoutAction).mockResolvedValue({
      ok: true,
      alreadySettled: false,
      appointmentId: 10,
      devPatientLink: null,
      devDoctorLink: null,
    });
    vi.mocked(confirmMockCheckoutByAppointmentAction).mockResolvedValue({
      ok: true,
      alreadySettled: true,
      appointmentId: 10,
      stripeSessionId: "session-10",
      devPatientLink: null,
      devDoctorLink: null,
    });
    await caller().confirmMockCheckout({ stripeSessionId: "session-10" });
    await caller().confirmMockCheckoutByAppointment({ appointmentId: 10 });
    expect(confirmMockCheckoutAction).toHaveBeenCalledWith({
      stripeSessionId: "session-10",
    });
    expect(confirmMockCheckoutByAppointmentAction).toHaveBeenCalledWith({
      appointmentId: 10,
    });
  });
});
