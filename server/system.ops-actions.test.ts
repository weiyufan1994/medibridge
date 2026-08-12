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
vi.mock("./modules/scheduling/repo", () => ({
  releaseHeldSlotByAppointmentId: vi.fn(),
}));
vi.mock("./workflows/appointmentPayments/publicApi", () => ({
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
import * as schedulingRepo from "./modules/scheduling/repo";
import { issueAppointmentAccessLinks } from "./modules/appointments/tokenService";
import { notifyOwner } from "./_core/notification";
import { systemRouter } from "./routers/system";

function createOpsCaller() {
  return systemRouter.createCaller({
    user: { id: 77, role: "ops" },
    req: {
      protocol: "https",
      headers: { host: "medibridge.test" },
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

describe("system ops actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("can send a doctor follow-up reminder", async () => {
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

    const result = await createOpsCaller().adminNotifyDoctorFollowup({
      appointmentId: 321,
    });

    expect(result).toEqual({ ok: true });
  });

  it("can resend an access link", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: { token: "ops_patient_token" },
      doctor: { token: "ops_doctor_token" },
      expiresAt: new Date("2026-03-10T00:00:00.000Z"),
      patientLink: "https://medibridge.test/visit/321?t=ops_patient_token",
      doctorLink: "https://medibridge.test/visit/321?t=ops_doctor_token",
    } as never);

    const result = await createOpsCaller().adminResendAccessLink({
      appointmentId: 321,
    });

    expect(result).toEqual({ ok: true });
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorType: "admin",
        operatorId: 77,
        reason: "admin_resend_access_link",
        payloadJson: expect.objectContaining({ actorRole: "ops" }),
      })
    );
  });

  it("can replay a supported webhook event", async () => {
    vi.mocked(appointmentsRepo.getStripeWebhookEventById).mockResolvedValue({
      eventId: "evt_ops_replay_1",
      type: "payment_intent.payment_failed",
      stripeSessionId: "cs_test_ops",
      appointmentId: 321,
      payloadHash: null,
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment({
        status: "pending_payment",
        paymentStatus: "pending",
      }) as never
    );
    vi.mocked(appointmentsRepo.hasAppointmentStatusReason).mockResolvedValue(
      false as never
    );
    vi.mocked(
      appointmentsRepo.tryTransitionAppointmentByStripeSessionId
    ).mockResolvedValue({ ok: true, reason: "updated" } as never);

    const result = await createOpsCaller().adminWebhookReplay({
      eventId: "evt_ops_replay_1",
      replayKey: "webhook-ops",
    });

    expect(result).toEqual({
      ok: true,
      skipped: false,
      action: "payment_intent.payment_failed",
      eventId: "evt_ops_replay_1",
    });
    expect(
      appointmentsRepo.tryTransitionAppointmentByStripeSessionId
    ).toHaveBeenCalledWith(
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
    expect(schedulingRepo.releaseHeldSlotByAppointmentId).toHaveBeenCalledWith({
      appointmentId: 321,
    });
  });

  it("cannot reinitiate payment", async () => {
    await expect(
      createOpsCaller().adminReinitiatePayment({ appointmentId: 321 })
    ).rejects.toBeTruthy();
  });

  it("cannot perform an admin-only batch state update", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );

    await expect(
      createOpsCaller().adminBatchAppointmentsAction({
        action: "update_status",
        appointmentIds: [321],
        toStatus: "active",
        toPaymentStatus: "paid",
      })
    ).rejects.toBeTruthy();

    expect(appointmentsRepo.insertStatusEvent).not.toHaveBeenCalled();
  });

  it("can perform a batch access-link resend", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      mockAppointment() as never
    );
    vi.mocked(appointmentsRepo.hasAppointmentStatusReason).mockResolvedValue(
      false as never
    );
    vi.mocked(issueAppointmentAccessLinks).mockResolvedValue({
      patient: { token: "ops_batch_patient_token" },
      doctor: { token: "ops_batch_doctor_token" },
      expiresAt: new Date("2026-03-10T00:00:00.000Z"),
      patientLink:
        "https://medibridge.test/visit/321?t=ops_batch_patient_token",
      doctorLink: "https://medibridge.test/visit/321?t=ops_batch_doctor_token",
    } as never);

    const result = await createOpsCaller().adminBatchAppointmentsAction({
      action: "resend_access_link",
      appointmentIds: [321],
      idempotencyKey: "batch-ops-resend",
    });

    expect(result.summary.success).toBe(1);
    expect(appointmentsRepo.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operatorType: "admin",
        operatorId: 77,
        payloadJson: expect.objectContaining({ actorRole: "ops" }),
      })
    );
  });
});
