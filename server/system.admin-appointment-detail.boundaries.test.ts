import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentById: vi.fn(),
  listActiveAppointmentTokens: vi.fn(),
  listStatusEventsByAppointment: vi.fn(),
  listStripeWebhookEventsForAppointment: vi.fn(),
}));
vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
}));
vi.mock("./modules/doctors/repo", () => ({
  getDoctorById: vi.fn(),
}));
vi.mock("./modules/visit/repo", () => ({
  getRecentMessages: vi.fn(),
}));

import * as aiRepo from "./modules/ai/repo";
import * as appointmentsRepo from "./modules/appointments/repo";
import * as doctorsRepo from "./modules/doctors/repo";
import * as visitRepo from "./modules/visit/repo";
import { systemRouter } from "./routers/system";

function createOpsCaller() {
  return systemRouter.createCaller({
    user: { id: 77, role: "ops" },
    req: { headers: {} },
  } as never);
}

describe("system admin appointment detail boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns NOT_FOUND before loading related records", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      null as never
    );

    await expect(
      createOpsCaller().adminAppointmentDetail({ appointmentId: 321 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(aiRepo.getAiChatSessionById).not.toHaveBeenCalled();
  });

  it("maps audit collections and safely omits unavailable doctor and triage context", async () => {
    const createdAt = new Date("2026-03-01T09:30:00.000Z");
    const expiresAt = new Date("2026-03-08T09:30:00.000Z");
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 321,
      userId: null,
      email: "patient@example.com",
      doctorId: 88,
      triageSessionId: 77,
      appointmentType: "online_chat",
      status: "paid",
      paymentStatus: "paid",
      amount: 19900,
      currency: "USD",
      stripeSessionId: null,
      scheduledAt: null,
      paidAt: null,
      createdAt,
      updatedAt: createdAt,
      notes: JSON.stringify({ chiefComplaint: "headache" }),
    } as never);
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(null as never);
    vi.mocked(doctorsRepo.getDoctorById).mockResolvedValue(null as never);
    vi.mocked(appointmentsRepo.listActiveAppointmentTokens).mockResolvedValue([
      {
        id: 1,
        role: "patient",
        expiresAt,
        useCount: 2,
        maxUses: 10,
        lastUsedAt: createdAt,
        ipFirstSeen: "203.0.113.10",
      },
    ] as never);
    vi.mocked(appointmentsRepo.listStatusEventsByAppointment).mockResolvedValue(
      [
        {
          id: 2,
          fromStatus: "pending_payment",
          toStatus: "paid",
          operatorType: "system",
          operatorId: null,
          reason: "payment_completed",
          payloadJson: { provider: "stripe" },
          createdAt,
        },
      ] as never
    );
    vi.mocked(
      appointmentsRepo.listStripeWebhookEventsForAppointment
    ).mockResolvedValue([
      {
        eventId: "evt_1",
        type: "checkout.session.completed",
        stripeSessionId: "cs_1",
        appointmentId: 321,
        payloadHash: "hash",
        createdAt,
      },
    ] as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([
      {
        id: 4,
        senderType: "doctor",
        content: "latest",
        originalContent: "latest",
        translatedContent: null,
        sourceLanguage: "en",
        targetLanguage: null,
        createdAt: new Date("2026-03-01T09:40:00.000Z"),
      },
      {
        id: 3,
        senderType: "patient",
        content: "earlier",
        originalContent: "earlier",
        translatedContent: null,
        sourceLanguage: "en",
        targetLanguage: null,
        createdAt,
      },
    ] as never);

    const result = await createOpsCaller().adminAppointmentDetail({
      appointmentId: 321,
    });

    expect(result).toMatchObject({
      doctor: null,
      triageSession: null,
      intake: { chiefComplaint: "headache" },
      activeTokens: [{ id: 1, role: "patient", expiresAt }],
      statusEvents: [{ id: 2, reason: "payment_completed" }],
      webhookEvents: [{ eventId: "evt_1", appointmentId: 321 }],
      recentMessages: [
        { id: 3, content: "earlier" },
        { id: 4, content: "latest" },
      ],
    });
    expect(
      appointmentsRepo.listStripeWebhookEventsForAppointment
    ).toHaveBeenCalledWith({
      appointmentId: 321,
      stripeSessionId: null,
      limit: 100,
    });
  });
});
