import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../modules/appointments/publicApi", () => ({
  appointmentPaymentApi: {
    getById: vi.fn(),
    getBySessionId: vi.fn(),
    claimPaidBySessionId: vi.fn(),
    recordStatusEvent: vi.fn(),
    assertCheckoutCanBeReinitiated: vi.fn(),
    attachReinitiatedCheckout: vi.fn(),
    issueAccessLinks: vi.fn(),
    cachePatientAccessToken: vi.fn(),
  },
  appointmentPaymentLinkApi: {
    resendPaymentLinkByPatient: vi.fn(),
  },
}));

vi.mock("../../modules/payments/publicApi", () => ({
  paymentProviderApi: { createCheckoutSession: vi.fn() },
}));

vi.mock("../../modules/scheduling/publicApi", () => ({
  schedulingSlotApi: { bookHeldSlotByAppointmentId: vi.fn() },
}));

vi.mock("../../_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

import { sendMagicLinkEmail } from "../../_core/mailer";
import {
  appointmentPaymentApi,
  appointmentPaymentLinkApi,
} from "../../modules/appointments/publicApi";
import { paymentProviderApi } from "../../modules/payments/publicApi";
import { schedulingSlotApi } from "../../modules/scheduling/publicApi";
import {
  confirmMockCheckoutAction,
  confirmMockCheckoutByAppointmentAction,
  createCheckoutSessionForAppointmentAction,
  reinitiateCheckoutForAppointment,
  resendPaymentLinkForPatient,
  settleStripePaymentBySessionId,
} from "./publicApi";

function createAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 51,
    amount: 4900,
    currency: "usd",
    email: "patient@example.com",
    status: "expired",
    paymentStatus: "expired",
    stripeSessionId: "cs_old_51",
    paymentProvider: "stripe",
    ...overrides,
  } as never;
}

function mockIssuedLinks() {
  vi.mocked(appointmentPaymentApi.issueAccessLinks).mockResolvedValue({
    patient: { token: "patient-token" },
    doctor: { token: "doctor-token" },
    expiresAt: new Date("2026-08-10T00:00:00.000Z"),
    patientLink: "https://medibridge.test/visit/51?t=patient-token",
    doctorLink: "https://medibridge.test/visit/51?t=doctor-token",
  } as never);
}

describe("appointment payment workflow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_BASE_URL", "https://medibridge.test");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns NOT_FOUND before creating checkout for a missing appointment", async () => {
    vi.mocked(appointmentPaymentApi.getById).mockResolvedValue(null as never);

    await expect(
      createCheckoutSessionForAppointmentAction({
        appointmentId: 404,
        operatorId: null,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Appointment not found",
    });
    expect(paymentProviderApi.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns the existing base URL error when configuration is missing", async () => {
    vi.mocked(appointmentPaymentApi.getById).mockResolvedValue(
      createAppointment()
    );
    vi.stubEnv("APP_BASE_URL", "   ");

    await expect(
      createCheckoutSessionForAppointmentAction({
        appointmentId: 51,
        operatorId: 7,
      })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "APP_BASE_URL_MISSING",
    });
  });

  it("normalizes checkout URLs and attaches the provider session", async () => {
    const appointment = createAppointment();
    vi.mocked(paymentProviderApi.createCheckoutSession).mockResolvedValue({
      provider: "stripe",
      id: "cs_new_51",
      url: "https://checkout.medibridge.test/cs_new_51",
    });

    const result = await reinitiateCheckoutForAppointment({
      appointment,
      baseUrl: " https://medibridge.test/ ",
      operatorType: "admin",
      operatorId: 99,
    });

    expect(paymentProviderApi.createCheckoutSession).toHaveBeenCalledWith({
      appointmentId: 51,
      amount: 4900,
      currency: "usd",
      successUrl: "https://medibridge.test/payment/success",
      cancelUrl: "https://medibridge.test/payment/cancel",
    });
    expect(
      appointmentPaymentApi.attachReinitiatedCheckout
    ).toHaveBeenCalledWith({
      appointment,
      checkoutSessionId: "cs_new_51",
      paymentProvider: "stripe",
      operatorType: "admin",
      operatorId: 99,
    });
    expect(result.stripeSessionId).toBe("cs_new_51");
  });

  it("rejects an empty explicit checkout base URL", async () => {
    await expect(
      reinitiateCheckoutForAppointment({
        appointment: createAppointment(),
        baseUrl: " / ",
        operatorType: "patient",
        operatorId: 7,
      })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "APP_BASE_URL_MISSING",
    });
    expect(paymentProviderApi.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("resolves the public base URL before delegating a patient payment link", async () => {
    vi.stubEnv("APP_BASE_URL", "");
    vi.mocked(
      appointmentPaymentLinkApi.resendPaymentLinkByPatient
    ).mockResolvedValue({ appointmentId: 51 } as never);
    const requestMetadata = {
      clientIp: "203.0.113.10",
      forwardedHost: "payments.medibridge.test",
      forwardedProto: "https",
      host: "internal.medibridge.test",
      protocol: "http",
      requestId: "request-51",
      userAgent: "vitest",
    };

    await resendPaymentLinkForPatient({
      appointmentId: 51,
      operatorId: 7,
      requestMetadata,
    });

    expect(
      appointmentPaymentLinkApi.resendPaymentLinkByPatient
    ).toHaveBeenCalledWith({
      appointmentId: 51,
      operatorId: 7,
      baseUrl: "https://payments.medibridge.test",
      reinitiateCheckout: reinitiateCheckoutForAppointment,
    });
  });

  it("disables mock confirmation in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(
      confirmMockCheckoutAction({ stripeSessionId: "cs_mock_51" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Mock checkout is disabled in production",
    });
    expect(appointmentPaymentApi.claimPaidBySessionId).not.toHaveBeenCalled();
  });

  it("confirms a mock session and returns development access links", async () => {
    vi.mocked(appointmentPaymentApi.claimPaidBySessionId).mockResolvedValue(
      1 as never
    );
    vi.mocked(appointmentPaymentApi.getBySessionId).mockResolvedValue(
      createAppointment({
        email: "phone+8613800000000@medibridge.local",
        status: "paid",
        paymentStatus: "paid",
      })
    );
    mockIssuedLinks();

    const result = await confirmMockCheckoutAction({
      stripeSessionId: "cs_mock_51",
    });

    expect(result).toMatchObject({
      ok: true,
      alreadySettled: false,
      appointmentId: 51,
      devPatientLink: "https://medibridge.test/visit/51?t=patient-token",
      devDoctorLink: "https://medibridge.test/visit/51?t=doctor-token",
    });
    expect(appointmentPaymentApi.claimPaidBySessionId).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSessionId: "cs_mock_51",
        operatorType: "system",
        reason: "mock_payment_paid",
      })
    );
  });

  it("requires a stored session for appointment-based mock confirmation", async () => {
    vi.mocked(appointmentPaymentApi.getById).mockResolvedValue(
      createAppointment({ stripeSessionId: null })
    );

    await expect(
      confirmMockCheckoutByAppointmentAction({ appointmentId: 51 })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Stripe session is missing for appointment",
    });
  });

  it("returns NOT_FOUND for mock confirmation of a missing appointment", async () => {
    vi.mocked(appointmentPaymentApi.getById).mockResolvedValue(null as never);

    await expect(
      confirmMockCheckoutByAppointmentAction({ appointmentId: 404 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns an internal error when a claimed appointment disappears", async () => {
    vi.mocked(appointmentPaymentApi.claimPaidBySessionId).mockResolvedValue(
      1 as never
    );
    vi.mocked(appointmentPaymentApi.getBySessionId).mockResolvedValue(
      null as never
    );

    await expect(
      settleStripePaymentBySessionId({
        stripeSessionId: "cs_missing_after_claim",
        source: "webhook",
      })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after payment settlement",
    });
  });

  it("records mail failure without rolling back successful settlement", async () => {
    const appointment = createAppointment({
      status: "paid",
      paymentStatus: "paid",
      stripeSessionId: "cs_paid_51",
    });
    vi.mocked(appointmentPaymentApi.claimPaidBySessionId).mockResolvedValue(
      1 as never
    );
    vi.mocked(appointmentPaymentApi.getBySessionId).mockResolvedValue(
      appointment
    );
    vi.mocked(schedulingSlotApi.bookHeldSlotByAppointmentId).mockResolvedValue({
      id: 5,
    } as never);
    mockIssuedLinks();
    vi.mocked(sendMagicLinkEmail).mockRejectedValue(
      new Error("mailer unavailable")
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const result = await settleStripePaymentBySessionId({
      stripeSessionId: "cs_paid_51",
      source: "webhook",
      eventId: "evt_51",
    });

    expect(result.alreadySettled).toBe(false);
    expect(appointmentPaymentApi.recordStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 51,
        reason: "payment_link_email_failed",
        payloadJson: {
          stripeSessionId: "cs_paid_51",
          error: "mailer unavailable",
        },
      })
    );
    const serialized = String(consoleError.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "appointment-payment-settlement",
      event: "patient_link_email_failed",
      appointmentId: 51,
      source: "webhook",
      errorName: "Error",
    });
    expect(serialized).not.toContain("mailer unavailable");
    expect(serialized).not.toContain("cs_paid_51");
  });

  it("skips email delivery for internal placeholder addresses", async () => {
    vi.mocked(appointmentPaymentApi.claimPaidBySessionId).mockResolvedValue(
      1 as never
    );
    vi.mocked(appointmentPaymentApi.getBySessionId).mockResolvedValue(
      createAppointment({ email: "phone+8613800000000@medibridge.local" })
    );
    mockIssuedLinks();

    await settleStripePaymentBySessionId({
      stripeSessionId: "cs_internal_51",
      source: "mock",
    });

    expect(sendMagicLinkEmail).not.toHaveBeenCalled();
    expect(appointmentPaymentApi.cachePatientAccessToken).toHaveBeenCalledWith(
      51,
      "patient-token",
      new Date("2026-08-10T00:00:00.000Z")
    );
  });
});
