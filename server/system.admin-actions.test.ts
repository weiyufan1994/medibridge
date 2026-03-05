import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentById: vi.fn(),
  insertStatusEvent: vi.fn(),
}));

vi.mock("./paymentsRouter", () => ({
  reinitiateCheckoutForAppointment: vi.fn(),
}));

vi.mock("./modules/appointments/tokenService", () => ({
  issueAppointmentAccessLinks: vi.fn(),
}));

vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("./modules/appointments/tokenCache", () => ({
  setCachedPatientAccessToken: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import { reinitiateCheckoutForAppointment } from "./paymentsRouter";
import { issueAppointmentAccessLinks } from "./modules/appointments/tokenService";
import { sendMagicLinkEmail } from "./_core/mailer";
import { setCachedPatientAccessToken } from "./modules/appointments/tokenCache";
import { systemRouter } from "./_core/systemRouter";

function createAdminCaller() {
  return systemRouter.createCaller({
    user: {
      id: 99,
      role: "pro",
    },
    req: {
      protocol: "https",
      headers: {
        host: "medibridge.test",
      },
      get(name: string) {
        return name.toLowerCase() === "host" ? "medibridge.test" : undefined;
      },
    },
  } as never);
}

function mockAppointment(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 321,
    userId: 12,
    email: "patient@example.com",
    doctorId: 7,
    triageSessionId: 88,
    appointmentType: "online_chat",
    status: "paid",
    paymentStatus: "paid",
    amount: 2900,
    currency: "usd",
    stripeSessionId: "cs_test_123",
    scheduledAt: new Date("2026-03-01T10:00:00.000Z"),
    paidAt: new Date("2026-03-01T09:00:00.000Z"),
    createdAt: new Date("2026-03-01T08:00:00.000Z"),
    updatedAt: new Date("2026-03-01T08:30:00.000Z"),
    notes: null,
    sessionId: null,
    lastAccessAt: null,
    doctorLastAccessAt: null,
    ...overrides,
  };
}

describe("system admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adminReinitiatePayment writes audit status event", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment({ status: "draft", paymentStatus: "unpaid" }) as never
    );
    vi.mocked(reinitiateCheckoutForAppointment).mockResolvedValue({
      appointmentId: 321,
      checkoutSessionUrl: "https://checkout.mock/cs_1",
      status: "pending_payment",
      paymentStatus: "pending",
      stripeSessionId: "cs_1",
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminReinitiatePayment({ appointmentId: 321 });

    expect(result).toEqual({
      appointmentId: 321,
      checkoutUrl: "https://checkout.mock/cs_1",
    });
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 321,
        operatorType: "admin",
        operatorId: 99,
        reason: "admin_reinitiate_payment",
      })
    );
  });

  it("adminResendAccessLink sends email and writes audit status event", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: {
        token: "patient_token",
      },
      doctor: {
        token: "doctor_token",
      },
      expiresAt: new Date("2026-03-10T00:00:00.000Z"),
      patientLink: "https://medibridge.test/visit?t=patient_token",
      doctorLink: "https://medibridge.test/visit?t=doctor_token",
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminResendAccessLink({ appointmentId: 321 });

    expect(result).toEqual({ ok: true });
    expect(sendMagicLinkEmail).toHaveBeenCalledWith(
      "patient@example.com",
      "https://medibridge.test/visit?t=patient_token"
    );
    expect(setCachedPatientAccessToken).toHaveBeenCalled();
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 321,
        operatorType: "admin",
        operatorId: 99,
        reason: "admin_resend_access_link",
      })
    );
  });

  it("adminIssueAccessLinks returns links and writes audit status event", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: {
        token: "patient_token",
      },
      doctor: {
        token: "doctor_token",
      },
      expiresAt: new Date("2026-03-10T00:00:00.000Z"),
      patientLink: "https://medibridge.test/visit?t=patient_token",
      doctorLink: "https://medibridge.test/visit?t=doctor_token",
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminIssueAccessLinks({ appointmentId: 321 });

    expect(result).toMatchObject({
      appointmentId: 321,
      patientLink: "https://medibridge.test/visit?t=patient_token",
      doctorLink: "https://medibridge.test/visit?t=doctor_token",
    });
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 321,
        operatorType: "admin",
        operatorId: 99,
        reason: "admin_issue_access_links",
      })
    );
  });
});
