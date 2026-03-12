import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentById: vi.fn(),
  updateAppointmentById: vi.fn(),
  insertStatusEvent: vi.fn(),
  hasAppointmentStatusReason: vi.fn(),
  getStripeWebhookEventById: vi.fn(),
  listStripeWebhookEventsForAppointment: vi.fn(),
  tryTransitionAppointmentByStripeSessionId: vi.fn(),
}));
vi.mock("./modules/visit/repo", () => ({
  getRecentMessages: vi.fn(),
}));
vi.mock("./modules/doctors/repo", () => ({
  getDoctorById: vi.fn(),
}));

vi.mock("./modules/payments/reinitiateCheckout", () => ({
  reinitiateCheckoutForAppointment: vi.fn(),
}));

vi.mock("./modules/appointments/tokenService", () => ({
  issueAppointmentAccessLinks: vi.fn(),
}));

vi.mock("./_core/mailer", () => ({
  sendMagicLinkEmail: vi.fn(),
}));
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn(),
}));

vi.mock("./modules/appointments/tokenCache", () => ({
  setCachedPatientAccessToken: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import * as visitRepo from "./modules/visit/repo";
import * as doctorsRepo from "./modules/doctors/repo";
import { reinitiateCheckoutForAppointment } from "./modules/payments/reinitiateCheckout";
import { issueAppointmentAccessLinks } from "./modules/appointments/tokenService";
import { sendMagicLinkEmail } from "./_core/mailer";
import { setCachedPatientAccessToken } from "./modules/appointments/tokenCache";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./_core/systemRouter";

function createAdminCaller() {
  return systemRouter.createCaller({
    user: {
      id: 99,
      role: "admin",
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

function createOpsCaller() {
  return systemRouter.createCaller({
    user: {
      id: 77,
      role: "ops",
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
      patientLink: "https://medibridge.test/visit/321?t=patient_token",
      doctorLink: "https://medibridge.test/visit/321?t=doctor_token",
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminResendAccessLink({ appointmentId: 321 });

    expect(result).toEqual({ ok: true });
    expect(sendMagicLinkEmail).toHaveBeenCalledWith(
      "patient@example.com",
      "https://medibridge.test/visit/321?t=patient_token"
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
      patientLink: "https://medibridge.test/visit/321?t=patient_token",
      doctorLink: "https://medibridge.test/visit/321?t=doctor_token",
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminIssueAccessLinks({ appointmentId: 321 });

    expect(result).toMatchObject({
      appointmentId: 321,
      patientLink: "https://medibridge.test/visit/321?t=patient_token",
      doctorLink: "https://medibridge.test/visit/321?t=doctor_token",
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

  it("adminNotifyDoctorFollowup sends reminder notification", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );
    vi.mocked(doctorsRepo.getDoctorById).mockResolvedValue({
      doctor: { id: 7, name: "Dr. Li" },
      hospital: { name: "Ruijin Hospital" },
      department: { name: "Cardiology" },
    } as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([
      {
        id: 1,
        senderType: "patient",
        createdAt: new Date("2026-03-01T11:00:00.000Z"),
      },
    ] as never);
    vi.mocked(notifyOwner).mockResolvedValue(true as never);

    const caller = createAdminCaller();
    const result = await caller.adminNotifyDoctorFollowup({ appointmentId: 321 });

    expect(result).toEqual({ ok: true });
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("#321"),
        content: expect.stringContaining("patient@example.com"),
      })
    );
  });

  it("ops can send doctor follow-up reminder", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );
    vi.mocked(doctorsRepo.getDoctorById).mockResolvedValue({
      doctor: { id: 7, name: "Dr. Ops" },
      hospital: { name: "Ops Hospital" },
      department: { name: "General" },
    } as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([
      {
        id: 1,
        senderType: "patient",
        createdAt: new Date("2026-03-01T11:00:00.000Z"),
      },
    ] as never);
    vi.mocked(notifyOwner).mockResolvedValue(true as never);

    const caller = createOpsCaller();
    const result = await caller.adminNotifyDoctorFollowup({ appointmentId: 321 });

    expect(result).toEqual({ ok: true });
  });

  it("ops can resend access link", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: {
        token: "ops_patient_token",
      },
      doctor: {
        token: "ops_doctor_token",
      },
      expiresAt: new Date("2026-03-10T00:00:00.000Z"),
      patientLink: "https://medibridge.test/visit/321?t=ops_patient_token",
      doctorLink: "https://medibridge.test/visit/321?t=ops_doctor_token",
    } as never);

    const caller = createOpsCaller();
    const result = await caller.adminResendAccessLink({ appointmentId: 321 });

    expect(result).toEqual({ ok: true });
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorType: "admin",
        operatorId: 77,
        reason: "admin_resend_access_link",
        payloadJson: expect.objectContaining({
          actorRole: "ops",
        }),
      })
    );
  });

  it("ops can replay supported webhook event", async () => {
    vi.mocked(appointmentsRepo.getStripeWebhookEventById).mockResolvedValue({
      eventId: "evt_ops_replay_1",
      type: "payment_intent.payment_failed",
      stripeSessionId: "cs_test_ops",
      appointmentId: 321,
      payloadHash: null,
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment({ status: "pending_payment", paymentStatus: "pending" }) as never
    );
    vi.mocked(appointmentsRepo.hasAppointmentStatusReason).mockResolvedValue(false as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentByStripeSessionId).mockResolvedValue(
      {
        ok: true,
        reason: "updated",
      } as never
    );

    const caller = createOpsCaller();
    const result = await caller.adminWebhookReplay({
      eventId: "evt_ops_replay_1",
      replayKey: "webhook-ops",
    });

    expect(result).toEqual({
      ok: true,
      skipped: false,
      action: "payment_intent.payment_failed",
      eventId: "evt_ops_replay_1",
    });
    expect(appointmentsRepo.tryTransitionAppointmentByStripeSessionId).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSessionId: "cs_test_ops",
        reason: "admin_webhook_replay",
      })
    );
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorType: "admin",
        operatorId: 77,
        reason: expect.stringContaining("admin_webhook_replay"),
      })
    );
  });

  it("ops cannot reinitiate payment", async () => {
    const caller = createOpsCaller();

    await expect(caller.adminReinitiatePayment({ appointmentId: 321 })).rejects.toBeTruthy();
  });

  it("ops cannot perform admin-only batch state update", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );

    const caller = createOpsCaller();

    await expect(
      caller.adminBatchAppointmentsAction({
        action: "update_status",
        appointmentIds: [321],
        toStatus: "active",
        toPaymentStatus: "paid",
      })
    ).rejects.toBeTruthy();

    expect(appointmentsRepo.insertStatusEvent).not.toHaveBeenCalled();
  });

  it("ops can perform batch access link resend", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );
    vi.mocked(appointmentsRepo.hasAppointmentStatusReason).mockResolvedValue(false as never);
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: {
        token: "ops_batch_patient_token",
      },
      doctor: {
        token: "ops_batch_doctor_token",
      },
      expiresAt: new Date("2026-03-10T00:00:00.000Z"),
      patientLink: "https://medibridge.test/visit/321?t=ops_batch_patient_token",
      doctorLink: "https://medibridge.test/visit/321?t=ops_batch_doctor_token",
    } as never);

    const caller = createOpsCaller();
    const result = await caller.adminBatchAppointmentsAction({
      action: "resend_access_link",
      appointmentIds: [321],
      idempotencyKey: "batch-ops-resend",
    });

    expect(result.summary.success).toBe(1);
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorType: "admin",
        operatorId: 77,
        payloadJson: expect.objectContaining({
          actorRole: "ops",
        }),
      })
    );
  });

  it("adminUpdateAppointmentSchedule updates scheduledAt and writes audit status event", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment({ status: "active", paymentStatus: "paid" }) as never
    );

    const caller = createAdminCaller();
    const newScheduledAt = new Date("2026-03-01T12:30:00.000Z");
    const result = await caller.adminUpdateAppointmentSchedule({
      appointmentId: 321,
      scheduledAt: newScheduledAt,
      reason: "ops_test_adjust",
    });

    expect(result).toEqual({
      ok: true,
      appointmentId: 321,
      scheduledAt: newScheduledAt,
    });
    expect(appointmentsRepo.updateAppointmentById).toHaveBeenCalledWith(
      321,
      expect.objectContaining({
        scheduledAt: newScheduledAt,
      })
    );
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 321,
        operatorType: "admin",
        operatorId: 99,
        reason: "admin_schedule_update:ops_test_adjust",
      })
    );
  });
});
