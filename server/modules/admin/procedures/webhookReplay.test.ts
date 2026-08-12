import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../appointments/publicApi", () => ({
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
  PAYMENT_STATUS_VALUES: [
    "unpaid",
    "pending",
    "paid",
    "failed",
    "expired",
    "refunded",
    "canceled",
  ],
  appointmentsAdminApi: {
    getAppointmentById: vi.fn(),
    getStripeWebhookEventById: vi.fn(),
    hasAppointmentStatusReason: vi.fn(),
    insertStatusEvent: vi.fn(),
    listStripeWebhookEventsForAppointment: vi.fn(),
    tryTransitionAppointmentByStripeSessionId: vi.fn(),
  },
}));
vi.mock("../../scheduling/publicApi", () => ({
  schedulingAdminApi: { releaseHeldSlotByAppointmentId: vi.fn() },
}));
vi.mock("../../../workflows/appointmentPayments/publicApi", () => ({
  settleStripePaymentBySessionId: vi.fn(),
}));

import { router } from "../../../_core/trpc";
import { appointmentsAdminApi as appointments } from "../../appointments/publicApi";
import { schedulingAdminApi as scheduling } from "../../scheduling/publicApi";
import { settleStripePaymentBySessionId } from "../../../workflows/appointmentPayments/publicApi";
import { webhookReplayProcedures } from "./webhookReplay";

const replayRouter = router(webhookReplayProcedures);

function caller(role?: "admin" | "ops" | "free") {
  return replayRouter.createCaller({
    user: role ? { id: 77, role } : null,
    req: { headers: {} },
    res: {},
  } as never);
}

function webhookEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: "evt-1",
    type: "payment_intent.payment_failed",
    stripeSessionId: "cs-1",
    appointmentId: 41,
    payloadHash: null,
    ...overrides,
  } as never;
}

describe("admin webhook replay procedure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      webhookEvent()
    );
    vi.mocked(
      appointments.listStripeWebhookEventsForAppointment
    ).mockResolvedValue([webhookEvent()] as never);
    vi.mocked(appointments.hasAppointmentStatusReason).mockResolvedValue(
      false as never
    );
    vi.mocked(
      appointments.tryTransitionAppointmentByStripeSessionId
    ).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(appointments.insertStatusEvent).mockResolvedValue(
      undefined as never
    );
    vi.mocked(scheduling.releaseHeldSlotByAppointmentId).mockResolvedValue(
      undefined as never
    );
  });

  it.each([undefined, "free" as const])("rejects role %s", async role => {
    await expect(
      caller(role).adminWebhookReplay({ eventId: "evt-1" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(appointments.getStripeWebhookEventById).not.toHaveBeenCalled();
  });

  it.each(["admin" as const, "ops" as const])(
    "allows %s to locate an event by id",
    async role => {
      await caller(role).adminWebhookReplay({
        eventId: " evt-1 ",
        replayKey: " replay-key ",
      });
      expect(appointments.getStripeWebhookEventById).toHaveBeenCalledWith(
        "evt-1"
      );
      expect(appointments.hasAppointmentStatusReason).toHaveBeenCalledWith({
        appointmentId: 41,
        reason: "admin_webhook_replay:replay-key:evt-1",
      });
    }
  );

  it("locates the newest event by appointment id", async () => {
    await caller("admin").adminWebhookReplay({
      appointmentId: 41,
      replayKey: "appointment-replay",
    });
    expect(
      appointments.listStripeWebhookEventsForAppointment
    ).toHaveBeenCalledWith({
      appointmentId: 41,
      limit: 1,
    });
    expect(appointments.getStripeWebhookEventById).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND when event lookup is empty", async () => {
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      null as never
    );
    await expect(
      caller("admin").adminWebhookReplay({ eventId: "missing" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    vi.mocked(
      appointments.listStripeWebhookEventsForAppointment
    ).mockResolvedValue([] as never);
    await expect(
      caller("admin").adminWebhookReplay({ appointmentId: 41 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects events without linked appointments", async () => {
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      webhookEvent({ appointmentId: null })
    );
    await expect(
      caller("ops").adminWebhookReplay({ eventId: "evt-1" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Webhook event has no linked appointment",
    });
  });

  it("skips an already recorded replay marker", async () => {
    vi.mocked(appointments.hasAppointmentStatusReason).mockResolvedValue(
      true as never
    );
    await expect(
      caller("admin").adminWebhookReplay({
        eventId: "evt-1",
        replayKey: "same-replay",
      })
    ).resolves.toEqual({
      ok: false,
      skipped: true,
      action: "skipped-idempotent",
      eventId: "evt-1",
    });
    expect(
      appointments.tryTransitionAppointmentByStripeSessionId
    ).not.toHaveBeenCalled();
  });

  it.each([
    "checkout.session.completed",
    "payment_intent.payment_failed",
    "checkout.session.expired",
    "charge.refunded",
    "refund.updated",
  ])("rejects supported %s event without a session", async type => {
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      webhookEvent({ type, stripeSessionId: null })
    );
    await expect(
      caller("admin").adminWebhookReplay({ eventId: "evt-1" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Webhook event is missing stripe session id",
    });
  });

  it("replays completed checkout and records source state", async () => {
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      webhookEvent({ type: "checkout.session.completed" })
    );
    vi.mocked(appointments.getAppointmentById).mockResolvedValue({
      id: 41,
      status: "pending_payment",
      paymentStatus: "pending",
    } as never);
    await expect(
      caller("ops").adminWebhookReplay({
        eventId: "evt-1",
        replayKey: "completed-replay",
      })
    ).resolves.toMatchObject({
      ok: true,
      action: "checkout.session.completed",
    });
    expect(settleStripePaymentBySessionId).toHaveBeenCalledWith({
      stripeSessionId: "cs-1",
      source: "webhook",
      eventId: "evt-1",
    });
    expect(appointments.insertStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: "pending_payment",
        toStatus: "paid",
        operatorType: "admin",
        operatorId: 77,
        payloadJson: expect.objectContaining({ actorRole: "ops" }),
      })
    );
  });

  it("rejects completed checkout when appointment vanished", async () => {
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      webhookEvent({ type: "checkout.session.completed" })
    );
    vi.mocked(appointments.getAppointmentById).mockResolvedValue(null as never);
    await expect(
      caller("admin").adminWebhookReplay({ eventId: "evt-1" })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Appointment not found for webhook replay",
    });
    expect(settleStripePaymentBySessionId).not.toHaveBeenCalled();
  });

  it.each([
    ["checkout.session.expired", "expired", "expired"],
    ["payment_intent.payment_failed", "canceled", "failed"],
  ])(
    "replays %s transition and releases the slot",
    async (type, status, payment) => {
      vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
        webhookEvent({ type })
      );
      await expect(
        caller("admin").adminWebhookReplay({
          eventId: "evt-1",
          replayKey: `${status}-replay`,
        })
      ).resolves.toMatchObject({ ok: true, action: type });
      expect(
        appointments.tryTransitionAppointmentByStripeSessionId
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          toStatus: status,
          toPaymentStatus: payment,
          operatorType: "admin",
          operatorId: 77,
        })
      );
      expect(scheduling.releaseHeldSlotByAppointmentId).toHaveBeenCalledWith({
        appointmentId: 41,
      });
    }
  );

  it.each([
    ["checkout.session.expired", "Unable to replay expired webhook"],
    [
      "payment_intent.payment_failed",
      "Unable to replay failed payment webhook",
    ],
  ])("rejects failed %s transitions", async (type, message) => {
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      webhookEvent({ type })
    );
    vi.mocked(
      appointments.tryTransitionAppointmentByStripeSessionId
    ).mockResolvedValue({
      ok: false,
      reason: "conflict",
    } as never);
    await expect(
      caller("ops").adminWebhookReplay({ eventId: "evt-1" })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: `${message}: conflict`,
    });
    expect(scheduling.releaseHeldSlotByAppointmentId).not.toHaveBeenCalled();
  });

  it.each(["charge.refunded", "refund.updated"])(
    "replays %s as a refunded transition",
    async type => {
      vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
        webhookEvent({ type })
      );
      await expect(
        caller("admin").adminWebhookReplay({ eventId: "evt-1" })
      ).resolves.toMatchObject({ ok: true, action: type });
      expect(
        appointments.tryTransitionAppointmentByStripeSessionId
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedFrom: ["paid", "active", "ended", "completed"],
          toStatus: "refunded",
          toPaymentStatus: "refunded",
        })
      );
    }
  );

  it("rejects a failed refund transition", async () => {
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      webhookEvent({ type: "charge.refunded" })
    );
    vi.mocked(
      appointments.tryTransitionAppointmentByStripeSessionId
    ).mockResolvedValue({
      ok: false,
      reason: "illegal_transition",
    } as never);
    await expect(
      caller("admin").adminWebhookReplay({ eventId: "evt-1" })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Unable to replay refund webhook: illegal_transition",
    });
  });

  it("rejects unsupported event types", async () => {
    vi.mocked(appointments.getStripeWebhookEventById).mockResolvedValue(
      webhookEvent({ type: "customer.created" })
    );
    await expect(
      caller("admin").adminWebhookReplay({ eventId: "evt-1" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Unsupported webhook event for replay: customer.created",
    });
  });
});
