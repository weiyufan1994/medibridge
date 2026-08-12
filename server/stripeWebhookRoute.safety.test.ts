import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/payments/stripe", () => ({
  verifyStripeWebhookSignature: vi.fn(),
  parseStripeWebhookEvent: vi.fn(),
}));
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("./modules/appointments/repo", () => ({
  insertStripeWebhookEvent: vi.fn(),
}));
vi.mock("./stripeWebhookContext", () => ({
  buildStripeWebhookContext: vi.fn(),
}));
vi.mock("./stripeWebhookProcessor", () => ({
  processStripeWebhookEvent: vi.fn(),
}));

import { clearMetricsForTests, getMetricsSnapshot } from "./_core/metrics";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import {
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./modules/payments/stripe";
import { buildStripeWebhookContext } from "./stripeWebhookContext";
import { processStripeWebhookEvent } from "./stripeWebhookProcessor";
import { handleStripeWebhook } from "./stripeWebhookRoute";

function request(body: unknown = '{"id":"evt-1"}') {
  const response: { status?: number; body?: Record<string, unknown> } = {};
  return {
    req: {
      body,
      headers: {
        "stripe-signature": "signature",
        "x-request-id": "stripe-request-1",
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

describe("Stripe webhook HTTP safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetricsForTests();
    vi.mocked(verifyStripeWebhookSignature).mockReturnValue(undefined);
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt-1",
      type: "unhandled.event",
      data: { object: {} },
    });
    vi.mocked(buildStripeWebhookContext).mockResolvedValue({
      stripeSessionId: null,
    } as never);
    vi.mocked(getDb).mockResolvedValue({ database: true } as never);
    vi.mocked(processStripeWebhookEvent).mockResolvedValue({
      duplicatedEvent: false,
    });
  });

  it("accepts string bodies and forwards a stable payload hash", async () => {
    const { req, res, response } = request('{"id":"evt-string"}');
    await handleStripeWebhook(req, res);
    expect(verifyStripeWebhookSignature).toHaveBeenCalledWith(
      expect.objectContaining({ rawBody: Buffer.from('{"id":"evt-string"}') })
    );
    expect(processStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
    expect(response).toMatchObject({ status: 200, body: { ok: true } });
  });

  it("rejects checkout completion without a session and records an audit", async () => {
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt-missing",
      type: "checkout.session.async_payment_succeeded",
      data: { object: {} },
    });
    const { req, res, response } = request(Buffer.from("missing"));
    await handleStripeWebhook(req, res);
    expect(response).toMatchObject({ status: 400 });
    expect(appointmentsRepo.insertStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "webhook_error_missing_session_id",
        provider: "stripe",
        payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it("returns success for duplicate events without processed metric", async () => {
    vi.mocked(processStripeWebhookEvent).mockResolvedValue({
      duplicatedEvent: true,
    });
    const { req, res, response } = request();
    await handleStripeWebhook(req, res);
    expect(response).toMatchObject({ status: 200, body: { ok: true } });
    expect(getMetricsSnapshot()).not.toContainEqual(
      expect.objectContaining({
        key: "stripe_webhook_processed_total{result=ok}",
      })
    );
  });

  it.each([
    [
      new Error("signature verification failed"),
      "signature_verification_failed",
    ],
    [new Error("missing session id"), "missing_session_id"],
    [new Error("Malformed Stripe webhook event"), "malformed_event"],
    [new Error("Database not available"), "db_unavailable"],
    ["unexpected", "processing_error"],
  ])(
    "classifies processing failures without logging secrets",
    async (error, type) => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      vi.mocked(verifyStripeWebhookSignature).mockImplementation(() => {
        throw error;
      });
      const { req, res, response } = request(Buffer.from("secret-payload"));
      await handleStripeWebhook(req, res);
      expect(response.status).toBe(400);
      expect(getMetricsSnapshot()).toContainEqual(
        expect.objectContaining({
          key: `stripe_webhook_failure_total{type=${type}}`,
          value: 1,
        })
      );
      expect(String(consoleError.mock.calls.at(-1)?.[0])).not.toContain(
        "secret-payload"
      );
      consoleError.mockRestore();
    }
  );

  it("does not fail the response when failure audit storage is unavailable", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    vi.mocked(verifyStripeWebhookSignature).mockImplementation(() => {
      throw new Error("processing failed");
    });
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue(
      new Error("audit write failed")
    );
    const { req, res, response } = request({ invalid: true });
    await handleStripeWebhook(req, res);
    expect(response.status).toBe(400);
    expect(consoleWarn).toHaveBeenCalled();
    expect(String(consoleWarn.mock.calls.at(-1)?.[0])).not.toContain(
      "audit write failed"
    );
    consoleWarn.mockRestore();
  });

  it("skips failure audit persistence when the database is absent", async () => {
    vi.mocked(verifyStripeWebhookSignature).mockImplementation(() => {
      throw new Error("processing failed");
    });
    vi.mocked(getDb).mockResolvedValue(null);
    const { req, res, response } = request(42);
    await handleStripeWebhook(req, res);
    expect(response.status).toBe(400);
    expect(appointmentsRepo.insertStripeWebhookEvent).not.toHaveBeenCalled();
  });
});
