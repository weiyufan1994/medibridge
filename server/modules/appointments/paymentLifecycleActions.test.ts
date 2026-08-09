import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getAppointmentById: vi.fn(),
  getAppointmentByStripeSessionId: vi.fn(),
  tryMarkPaidByStripeSessionId: vi.fn(),
  insertStatusEvent: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
}));

vi.mock("./tokenCache", () => ({
  setCachedPatientAccessToken: vi.fn(),
}));

vi.mock("./tokenService", () => ({
  issueAppointmentAccessLinks: vi.fn(),
}));

import * as repo from "./repo";
import {
  appointmentPaymentApi,
  assertCheckoutCanBeReinitiated,
} from "./paymentLifecycleActions";

function createAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 41,
    status: "expired",
    paymentStatus: "expired",
    stripeSessionId: "cs_old_41",
    paymentProvider: "stripe",
    ...overrides,
  } as never;
}

describe("appointment payment lifecycle actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects checkout re-initiation for a paid appointment", () => {
    expect(() =>
      assertCheckoutCanBeReinitiated(
        createAppointment({ status: "paid", paymentStatus: "paid" })
      )
    ).toThrowError("APPOINTMENT_INVALID_STATUS_TRANSITION");
  });

  it("allows checkout re-initiation for an expired appointment", () => {
    expect(() =>
      assertCheckoutCanBeReinitiated(createAppointment())
    ).not.toThrow();
  });

  it("revokes old tokens before attaching the replacement checkout", async () => {
    vi.mocked(repo.revokeAppointmentTokens).mockResolvedValue(undefined);
    vi.mocked(repo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);

    await appointmentPaymentApi.attachReinitiatedCheckout({
      appointment: createAppointment(),
      checkoutSessionId: "order_new_41",
      paymentProvider: "paypal",
      operatorType: "patient",
      operatorId: 9,
    });

    expect(repo.revokeAppointmentTokens).toHaveBeenCalledWith({
      appointmentId: 41,
      reason: "payment_reinitiated",
    });
    expect(repo.tryTransitionAppointmentById).toHaveBeenCalledWith({
      appointmentId: 41,
      allowedFrom: ["draft", "pending_payment", "expired", "canceled"],
      toStatus: "pending_payment",
      toPaymentStatus: "pending",
      operatorType: "patient",
      operatorId: 9,
      reason: "checkout_session_created",
      payloadJson: {
        oldStripeSessionId: "cs_old_41",
        newStripeSessionId: "order_new_41",
      },
      update: {
        stripeSessionId: "order_new_41",
        paymentProvider: "paypal",
      },
    });
    expect(
      vi.mocked(repo.revokeAppointmentTokens).mock.invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(repo.tryTransitionAppointmentById).mock.invocationCallOrder[0]
    );
  });

  it("preserves the transition error when checkout attachment loses a race", async () => {
    vi.mocked(repo.revokeAppointmentTokens).mockResolvedValue(undefined);
    vi.mocked(repo.tryTransitionAppointmentById).mockResolvedValue({
      ok: false,
      reason: "conflict",
    } as never);

    await expect(
      appointmentPaymentApi.attachReinitiatedCheckout({
        appointment: createAppointment(),
        checkoutSessionId: "cs_new_41",
        paymentProvider: "stripe",
        operatorType: "admin",
        operatorId: 99,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "APPOINTMENT_INVALID_STATUS_TRANSITION",
    });
  });
});
