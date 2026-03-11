import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/payments/providers/paypalAdapter", () => ({
  captureOrFinalizePaypalSession: vi.fn(),
  parsePaypalWebhookEvent: vi.fn(),
  verifyPaypalWebhookSignature: vi.fn(),
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

import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import { parsePaypalWebhookEvent, verifyPaypalWebhookSignature } from "./modules/payments/providers/paypalAdapter";
import { clearMetricsForTests, getMetricsSnapshot } from "./_core/metrics";
import { settleStripePaymentBySessionId } from "./modules/payments/settlement";
import { handlePaypalWebhook } from "./paypalWebhookRoute";

type Req = {
  body: Buffer;
  headers: Record<string, string>;
};

function createReqRes(rawPayload: string) {
  const req = {
    body: Buffer.from(rawPayload, "utf8"),
    headers: {
      "paypal-transmission-sig": "sig",
      "paypal-transmission-id": "tx",
      "paypal-transmission-time": "t",
      "paypal-cert-url": "https://example",
      "paypal-auth-algo": "SHA256withRSA",
    },
  } as Req as never;

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

describe("paypalWebhookRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetricsForTests();
    vi.mocked(verifyPaypalWebhookSignature).mockResolvedValue(undefined as never);
    vi.mocked(getDb).mockResolvedValue({
      transaction: async (fn: (tx: object) => Promise<void>) => {
        await fn({});
      },
    } as never);
  });

  it("settles paypal capture completed event", async () => {
    vi.mocked(parsePaypalWebhookEvent).mockReturnValue({
      id: "evt_pp_complete_1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "pp_order_1",
      },
    } as never);
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockResolvedValue(undefined as never);
    vi.mocked(settleStripePaymentBySessionId).mockResolvedValue({
      alreadySettled: false,
      appointment: {
        id: 777,
        paymentStatus: "paid",
        status: "paid",
      },
      patientLink: null,
      doctorLink: null,
    } as never);

    const { req, res, resPayload } = createReqRes('{"id":"evt_pp_complete_1"}');
    await handlePaypalWebhook(req as never, res);

    expect(settleStripePaymentBySessionId).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSessionId: "pp_order_1",
        source: "webhook",
        eventId: "evt_pp_complete_1",
      })
    );
    expect(appointmentsRepo.tryTransitionAppointmentByStripeSessionId).not.toHaveBeenCalled();
    expect(resPayload.status).toBe(200);
    expect(resPayload.body).toMatchObject({ ok: true });
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "paypal_webhook_processed_total{result=ok}",
          value: 1,
        }),
      ])
    );
  });

  it("signature failure records paypal webhook error", async () => {
    vi.mocked(verifyPaypalWebhookSignature).mockImplementation(() => {
      throw new Error("Missing PayPal-transmission-sig header");
    });

    const { req, res, resPayload } = createReqRes('{"id":"evt_bad_sig"}');
    await handlePaypalWebhook(req as never, res);

    expect(resPayload.status).toBe(400);
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "paypal_webhook_failure_total{type=signature_verification_failed}",
          value: 1,
        }),
      ])
    );
  });
});
