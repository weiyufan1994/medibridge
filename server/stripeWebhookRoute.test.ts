import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/payments/stripe", () => ({
  verifyStripeWebhookSignature: vi.fn(),
  parseStripeWebhookEvent: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentByStripeSessionId: vi.fn(),
  insertStripeWebhookEvent: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
  tryTransitionAppointmentByStripeSessionId: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));

vi.mock("./modules/payments/settlement", () => ({
  settleStripePaymentBySessionId: vi.fn(),
}));

import { parseStripeWebhookEvent, verifyStripeWebhookSignature } from "./modules/payments/stripe";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import { clearMetricsForTests, getMetricsSnapshot } from "./_core/metrics";
import { handleStripeWebhook } from "./stripeWebhookRoute";

function createReqRes(rawPayload: string) {
  const req = {
    body: Buffer.from(rawPayload, "utf8"),
    headers: {
      "stripe-signature": "t=123,v1=sig",
    },
  } as never;

  const resPayload: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      resPayload.status = code;
      return this;
    },
    setHeader() {
      return this;
    },
    send(body: string) {
      resPayload.body = JSON.parse(body);
      return this;
    },
  } as never;

  return { req, res, resPayload };
}

describe("stripeWebhookRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetricsForTests();
    vi.mocked(verifyStripeWebhookSignature).mockImplementation(() => undefined);
    vi.mocked(getDb).mockResolvedValue({
      transaction: async (fn: (tx: object) => Promise<void>) => {
        await fn({});
      },
    } as never);
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockResolvedValue(undefined as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
  });

  it("refund webhook marks refunded and revokes appointment tokens", async () => {
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt_ref_1",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_1",
          metadata: {
            appointmentId: "123",
          },
        },
      },
    } as never);

    const { req, res, resPayload } = createReqRes('{"id":"evt_ref_1"}');
    await handleStripeWebhook(req, res);

    expect(verifyStripeWebhookSignature).toHaveBeenCalled();
    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 123,
        toStatus: "refunded",
        toPaymentStatus: "refunded",
      })
    );
    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 123,
        reason: "payment_refunded",
      })
    );
    expect(resPayload.status).toBe(200);
    expect(resPayload.body).toMatchObject({ ok: true });
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "stripe_webhook_processed_total{result=ok}",
          value: 1,
        }),
      ])
    );
  });

  it("signature failure records classified failure metric", async () => {
    vi.mocked(verifyStripeWebhookSignature).mockImplementation(() => {
      throw new Error("Missing Stripe-Signature header");
    });

    const { req, res, resPayload } = createReqRes('{"id":"evt_bad_sig"}');
    await handleStripeWebhook(req, res);

    expect(resPayload.status).toBe(400);
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "stripe_webhook_failure_total{type=signature_invalid}",
          value: 1,
        }),
      ])
    );
  });

  it("duplicate webhook event increments duplicate metric and returns ok", async () => {
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt_dup_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_dup_1",
          metadata: {
            appointmentId: "123",
            stripeSessionId: "cs_dup_1",
          },
        },
      },
    } as never);
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue({
      code: "ER_DUP_ENTRY",
    } as never);

    const { req, res, resPayload } = createReqRes('{"id":"evt_dup_1"}');
    await handleStripeWebhook(req, res);

    expect(resPayload.status).toBe(200);
    expect(resPayload.body).toMatchObject({ ok: true });
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "stripe_webhook_duplicate_total",
          value: 1,
        }),
      ])
    );
  });
});
