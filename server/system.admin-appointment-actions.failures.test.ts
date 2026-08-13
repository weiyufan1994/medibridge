import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAppointmentById: vi.fn(),
  insertStatusEvent: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
  updateAppointmentById: vi.fn(),
  issueAppointmentAccessLinks: vi.fn(),
  setCachedPatientAccessToken: vi.fn(),
  getDoctorById: vi.fn(),
  getRecentMessages: vi.fn(),
  reinitiateCheckoutForAppointment: vi.fn(),
  sendMagicLinkEmail: vi.fn(),
  notifyOwner: vi.fn(),
}));

vi.mock("./modules/appointments/publicApi", () => ({
  APPOINTMENT_STATUS_VALUES: [
    "draft",
    "pending_payment",
    "paid",
    "active",
    "ended",
    "completed",
    "expired",
    "refunded",
    "canceled",
  ],
  PAYMENT_STATUS_VALUES: ["unpaid", "pending", "paid", "failed", "refunded"],
  appointmentsAdminApi: {
    getAppointmentById: mocks.getAppointmentById,
    insertStatusEvent: mocks.insertStatusEvent,
    tryTransitionAppointmentById: mocks.tryTransitionAppointmentById,
    updateAppointmentById: mocks.updateAppointmentById,
  },
  issueAppointmentAccessLinks: mocks.issueAppointmentAccessLinks,
  setCachedPatientAccessToken: mocks.setCachedPatientAccessToken,
}));
vi.mock("./modules/doctors/publicApi", () => ({
  doctorsAdminApi: { getDoctorById: mocks.getDoctorById },
}));
vi.mock("./modules/visit/publicApi", () => ({
  visitAdminApi: { getRecentMessages: mocks.getRecentMessages },
}));
vi.mock("./workflows/appointmentPayments/publicApi", () => ({
  reinitiateCheckoutForAppointment: mocks.reinitiateCheckoutForAppointment,
}));
vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: mocks.sendMagicLinkEmail,
}));
vi.mock("./_core/notification", () => ({
  notifyOwner: mocks.notifyOwner,
}));

import { systemRouter } from "./routers/system";

function createAdminCaller() {
  return systemRouter.createCaller({
    user: { id: 99, role: "admin" },
    req: {
      protocol: "https",
      headers: { host: "medibridge.test" },
      get(name: string) {
        return name.toLowerCase() === "host" ? "medibridge.test" : undefined;
      },
    },
  } as never);
}

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 321,
    email: "patient@example.com",
    doctorId: 7,
    status: "paid",
    paymentStatus: "paid",
    stripeSessionId: "cs_old",
    scheduledAt: new Date("2026-03-01T10:00:00.000Z"),
    ...overrides,
  };
}

describe("system admin appointment action failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppointmentById.mockResolvedValue(appointment());
    mocks.insertStatusEvent.mockResolvedValue(undefined);
    mocks.updateAppointmentById.mockResolvedValue(undefined);
    mocks.notifyOwner.mockResolvedValue(true);
    mocks.getRecentMessages.mockResolvedValue([]);
    mocks.getDoctorById.mockResolvedValue(null);
  });

  it.each([
    [
      "reinitiate payment",
      () => createAdminCaller().adminReinitiatePayment({ appointmentId: 321 }),
    ],
    [
      "resend access link",
      () => createAdminCaller().adminResendAccessLink({ appointmentId: 321 }),
    ],
    [
      "issue access links",
      () => createAdminCaller().adminIssueAccessLinks({ appointmentId: 321 }),
    ],
    [
      "notify doctor",
      () =>
        createAdminCaller().adminNotifyDoctorFollowup({ appointmentId: 321 }),
    ],
    [
      "update status",
      () =>
        createAdminCaller().adminUpdateAppointmentStatus({
          appointmentId: 321,
          toStatus: "active",
          toPaymentStatus: "paid",
          reason: "manual review",
        }),
    ],
    [
      "update schedule",
      () =>
        createAdminCaller().adminUpdateAppointmentSchedule({
          appointmentId: 321,
          scheduledAt: new Date("2026-03-02T10:00:00.000Z"),
          reason: "manual review",
        }),
    ],
  ])("returns NOT_FOUND before %s side effects", async (_name, invoke) => {
    mocks.getAppointmentById.mockResolvedValue(null);

    await expect(invoke()).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.insertStatusEvent).not.toHaveBeenCalled();
  });

  it.each([
    [
      "resend",
      () => createAdminCaller().adminResendAccessLink({ appointmentId: 321 }),
    ],
    [
      "issue",
      () => createAdminCaller().adminIssueAccessLinks({ appointmentId: 321 }),
    ],
  ])("forbids %s access links before payment", async (_name, invoke) => {
    mocks.getAppointmentById.mockResolvedValue(
      appointment({ paymentStatus: "pending" })
    );

    await expect(invoke()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.issueAppointmentAccessLinks).not.toHaveBeenCalled();
  });

  it("records a null replacement session when reinitiation omits one", async () => {
    mocks.reinitiateCheckoutForAppointment.mockResolvedValue({
      appointmentId: 321,
      checkoutSessionUrl: "https://checkout.example.test/session",
      status: "pending_payment",
    });

    await createAdminCaller().adminReinitiatePayment({ appointmentId: 321 });

    expect(mocks.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadJson: expect.objectContaining({ newStripeSessionId: null }),
      })
    );
  });

  it("uses identifiers and an empty timestamp when doctor context is absent", async () => {
    await createAdminCaller().adminNotifyDoctorFollowup({ appointmentId: 321 });

    expect(mocks.notifyOwner).toHaveBeenCalledWith({
      title: "Doctor follow-up reminder #321",
      content: expect.stringMatching(
        /Doctor: 7[\s\S]*Latest patient message: -/
      ),
    });
  });

  it.each([
    ["not_found", "NOT_FOUND"],
    ["invalid_transition", "PRECONDITION_FAILED"],
  ])("maps %s transition failures to %s", async (reason, code) => {
    mocks.tryTransitionAppointmentById.mockResolvedValue({ ok: false, reason });

    await expect(
      createAdminCaller().adminUpdateAppointmentStatus({
        appointmentId: 321,
        toStatus: "active",
        toPaymentStatus: "paid",
        reason: "manual review",
      })
    ).rejects.toMatchObject({ code });
  });

  it("preserves a legacy scheduled value in the schedule audit", async () => {
    mocks.getAppointmentById.mockResolvedValue(
      appointment({ scheduledAt: "legacy-schedule" })
    );
    const scheduledAt = new Date("2026-03-02T10:00:00.000Z");

    await createAdminCaller().adminUpdateAppointmentSchedule({
      appointmentId: 321,
      scheduledAt,
      reason: "manual review",
    });

    expect(mocks.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadJson: expect.objectContaining({
          fromScheduledAt: "legacy-schedule",
          toScheduledAt: scheduledAt.toISOString(),
        }),
      })
    );
  });
});
