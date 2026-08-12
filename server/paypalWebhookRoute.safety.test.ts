import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/payments/providers/paypalAdapter", () => ({
  captureOrFinalizePaypalSession: vi.fn(),
  parsePaypalWebhookEvent: vi.fn(),
  verifyPaypalWebhookSignature: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./modules/appointments/repo", () => ({
  getAppointmentByStripeSessionId: vi.fn(),
  insertStripeWebhookEvent: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
  tryTransitionAppointmentByStripeSessionId: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));
vi.mock("./modules/scheduling/repo", () => ({
  releaseHeldSlotByAppointmentId: vi.fn(),
}));
vi.mock("./workflows/appointmentPayments/publicApi", () => ({
  settleStripePaymentBySessionId: vi.fn(),
}));

import { clearMetricsForTests, getMetricsSnapshot } from "./_core/metrics";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./modules/appointments/stateMachine";
import {
  captureOrFinalizePaypalSession,
  parsePaypalWebhookEvent,
  verifyPaypalWebhookSignature,
} from "./modules/payments/providers/paypalAdapter";
import * as schedulingRepo from "./modules/scheduling/repo";
import { handlePaypalWebhook } from "./paypalWebhookRoute";
import { settleStripePaymentBySessionId } from "./workflows/appointmentPayments/publicApi";

function createReqRes(body: unknown = '{"id":"evt-1"}') {
  const response: { status?: number; body?: Record<string, unknown> } = {};
  return {
    req: {
      body,
      headers: {
        "paypal-transmission-sig": "signature",
        "paypal-transmission-id": "transmission",
        "paypal-transmission-time": "time",
        "paypal-cert-url": "cert",
        "paypal-auth-algo": "algo",
        "x-request-id": "paypal-request-1",
      },
    } as never,
    res: {
      status(code: number) {
        response.status = code;
        return this;
      },
      setHeader() {
        return this;
      },
      send(value: string) {
        response.body = JSON.parse(value);
        return this;
      },
    } as never,
    response,
  };
}

function event(
  eventType: unknown,
  resource: Record<string, unknown> | undefined = { id: "order-1" }
) {
  return { id: "evt-1", event_type: eventType, resource } as never;
}

describe("PayPal webhook safety boundaries", () => {
  const tx = { transaction: true };

  beforeEach(() => {
    vi.clearAllMocks();
    clearMetricsForTests();
    vi.mocked(verifyPaypalWebhookSignature).mockResolvedValue(
      undefined as never
    );
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(
      event("UNHANDLED.EVENT")
    );
    vi.mocked(getDb).mockResolvedValue({
      transaction: async (callback: (executor: unknown) => Promise<void>) =>
        callback(tx),
    } as never);
    vi.mocked(
      appointmentsRepo.getAppointmentByStripeSessionId
    ).mockResolvedValue({
      id: 41,
    } as never);
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockResolvedValue(
      undefined as never
    );
    vi.mocked(
      appointmentsRepo.tryTransitionAppointmentByStripeSessionId
    ).mockResolvedValue({ ok: true, reason: "updated" } as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
  });

  it.each([
    "CHECKOUT.ORDER.APPROVED",
    "CHECKOUT.ORDER.COMPLETED",
    "PAYMENT.CAPTURE.COMPLETED",
  ])("captures and settles normalized event %s", async type => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(
      event(` ${type.toLowerCase()} `)
    );
    const { req, res, response } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(captureOrFinalizePaypalSession).toHaveBeenCalledWith({
      providerSessionId: "order-1",
    });
    expect(settleStripePaymentBySessionId).toHaveBeenCalledWith({
      stripeSessionId: "order-1",
      source: "webhook",
      eventId: "evt-1",
      dbExecutor: tx,
    });
    expect(response).toMatchObject({ status: 200, body: { ok: true } });
  });

  it("uses purchase-unit metadata when session lookup has no appointment", async () => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(
      event("UNHANDLED.EVENT", {
        id: "order-1",
        purchase_units: [{ reference_id: " 72 " }],
      })
    );
    vi.mocked(
      appointmentsRepo.getAppointmentByStripeSessionId
    ).mockResolvedValue(null as never);
    const { req, res } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(appointmentsRepo.insertStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "UNHANDLED.EVENT",
        provider: "paypal",
        stripeSessionId: "order-1",
        appointmentId: 72,
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        dbExecutor: tx,
      })
    );
  });

  it("falls back to numeric custom metadata", async () => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(
      event("UNHANDLED.EVENT", {
        custom_id: " 73 ",
        purchase_units: [{ reference_id: "not-numeric" }],
      })
    );
    const { req, res } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(appointmentsRepo.insertStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 73, stripeSessionId: null })
    );
  });

  it("ignores malformed appointment metadata", async () => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(
      event(7, { custom_id: "-1", purchase_units: "invalid" })
    );
    const { req, res } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(appointmentsRepo.insertStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "", appointmentId: null })
    );
  });

  it.each([
    "CHECKOUT.ORDER.CANCELLED",
    "PAYMENT.CAPTURE.DENIED",
    "PAYMENT.CAPTURE.REVERSED",
    "PAYMENT.CAPTURE.REFUNDED",
    "RISK.DISPUTE.CREATED",
    "RISK.DISPUTE.RESOLVED",
  ])("rejects %s without a provider session id", async type => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(event(type, {}));
    const { req, res, response } = createReqRes("missing-session");
    await handlePaypalWebhook(req, res);
    expect(response).toMatchObject({
      status: 400,
      body: { ok: false, error: "PayPal webhook missing session id" },
    });
    expect(appointmentsRepo.insertStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "webhook_error_missing_session_id",
        provider: "paypal",
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
  });

  it.each(["CHECKOUT.ORDER.CANCELLED", "PAYMENT.CAPTURE.DENIED"])(
    "fails %s and releases the held slot",
    async type => {
      vi.mocked(parsePaypalWebhookEvent).mockReturnValue(event(type));
      const { req, res } = createReqRes();
      await handlePaypalWebhook(req, res);
      expect(
        appointmentsRepo.tryTransitionAppointmentByStripeSessionId
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSessionId: "order-1",
          toStatus: "canceled",
          toPaymentStatus: "failed",
          dbExecutor: tx,
        })
      );
      expect(
        schedulingRepo.releaseHeldSlotByAppointmentId
      ).toHaveBeenCalledWith({
        appointmentId: 41,
        dbExecutor: tx,
      });
    }
  );

  it("does not release a slot when failure transition loses a race", async () => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(
      event("PAYMENT.CAPTURE.DENIED")
    );
    vi.mocked(
      appointmentsRepo.tryTransitionAppointmentByStripeSessionId
    ).mockResolvedValue({ ok: false, reason: "conflict" } as never);
    const { req, res } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(
      schedulingRepo.releaseHeldSlotByAppointmentId
    ).not.toHaveBeenCalled();
  });

  it.each([
    "PAYMENT.CAPTURE.REVERSED",
    "PAYMENT.CAPTURE.REFUNDED",
    "RISK.DISPUTE.CREATED",
    "RISK.DISPUTE.RESOLVED",
  ])("refunds appointment and revokes tokens for %s", async type => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(event(type));
    const { req, res, response } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 41,
        toStatus: "refunded",
        toPaymentStatus: "refunded",
        payloadJson: expect.objectContaining({ eventType: type }),
        dbExecutor: tx,
      })
    );
    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith({
      appointmentId: 41,
      reason: "payment_refunded",
      dbExecutor: tx,
    });
    expect(response.status).toBe(200);
  });

  it("rejects an illegal refund transition without revoking tokens", async () => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(
      event("PAYMENT.CAPTURE.REFUNDED")
    );
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: false,
      reason: "illegal_transition",
    } as never);
    const { req, res, response } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(response).toMatchObject({
      status: 400,
      body: { error: APPOINTMENT_INVALID_TRANSITION_ERROR },
    });
    expect(appointmentsRepo.revokeAppointmentTokens).not.toHaveBeenCalled();
  });

  it("ignores an unresolvable appointment refund", async () => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue(
      event("PAYMENT.CAPTURE.REFUNDED")
    );
    vi.mocked(
      appointmentsRepo.getAppointmentByStripeSessionId
    ).mockResolvedValue(null as never);
    const { req, res, response } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(
      appointmentsRepo.tryTransitionAppointmentById
    ).not.toHaveBeenCalled();
    expect(appointmentsRepo.revokeAppointmentTokens).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("handles duplicate events idempotently", async () => {
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue({
      code: "ER_DUP_ENTRY",
    } as never);
    const { req, res, response } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(response).toMatchObject({ status: 200, body: { ok: true } });
    expect(getMetricsSnapshot()).toContainEqual(
      expect.objectContaining({
        key: "paypal_webhook_duplicate_total",
        value: 1,
      })
    );
  });

  it("propagates non-duplicate persistence failures to the HTTP error path", async () => {
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue(
      new Error("webhook insert failed")
    );
    const { req, res, response } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(response).toMatchObject({ status: 400, body: { ok: false } });
    expect(getMetricsSnapshot()).toContainEqual(
      expect.objectContaining({
        key: "paypal_webhook_failure_total{type=processing_error}",
      })
    );
  });

  it("classifies missing storage and preserves an empty payload hash", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    const { req, res, response } = createReqRes({ invalid: true });
    await handlePaypalWebhook(req, res);
    expect(response).toMatchObject({
      status: 400,
      body: { error: "Database not available" },
    });
    expect(getMetricsSnapshot()).toContainEqual(
      expect.objectContaining({
        key: "paypal_webhook_failure_total{type=db_unavailable}",
      })
    );
  });

  it.each([
    [new Error("no provider session id"), "missing_session_id"],
    [new Error("Malformed PayPal webhook payload"), "malformed_event"],
    ["unexpected", "processing_error"],
  ])("classifies rejected inputs and redacts logs", async (error, type) => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(verifyPaypalWebhookSignature).mockImplementation(() => {
      throw error;
    });
    const { req, res } = createReqRes("secret-paypal-payload");
    await handlePaypalWebhook(req, res);
    expect(getMetricsSnapshot()).toContainEqual(
      expect.objectContaining({
        key: `paypal_webhook_failure_total{type=${type}}`,
      })
    );
    expect(String(consoleError.mock.calls.at(-1)?.[0])).not.toContain(
      "secret-paypal-payload"
    );
    consoleError.mockRestore();
  });

  it("degrades safely when failure audit persistence rejects", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    vi.mocked(verifyPaypalWebhookSignature).mockRejectedValue(
      new Error("PayPal signature failed")
    );
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue(
      new Error("audit failed")
    );
    const { req, res, response } = createReqRes();
    await handlePaypalWebhook(req, res);
    expect(response.status).toBe(400);
    expect(consoleWarn).toHaveBeenCalled();
    expect(String(consoleWarn.mock.calls.at(-1)?.[0])).not.toContain(
      "audit failed"
    );
    consoleWarn.mockRestore();
  });
});
