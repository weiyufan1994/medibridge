import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createStripeCheckoutSession,
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./stripe";

const ORIGINAL_CHECKOUT_BASE = process.env.STRIPE_CHECKOUT_BASE_URL;

function signature(rawBody: Buffer, secret: string, timestamp: number) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`, "utf8")
    .digest("hex");
}

describe("legacy Stripe integration seam", () => {
  beforeEach(() => {
    delete process.env.STRIPE_CHECKOUT_BASE_URL;
  });

  afterEach(() => {
    process.env.STRIPE_CHECKOUT_BASE_URL = ORIGINAL_CHECKOUT_BASE;
    vi.useRealTimers();
  });

  it("builds a deterministic callback shape for local checkout", () => {
    const session = createStripeCheckoutSession({
      appointmentId: 12,
      amount: 4900,
      currency: "usd",
      successUrl: "https://app.test/success/{CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.test/cancel",
    });
    expect(session.id).toMatch(/^cs_test_/);
    expect(session.url).toContain(session.id);

    const querySession = createStripeCheckoutSession({
      appointmentId: 12,
      amount: 4900,
      currency: "usd",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    const url = new URL(querySession.url);
    expect(url.searchParams.get("session_id")).toBe(querySession.id);
    expect(url.searchParams.get("mockPaid")).toBe("1");
  });

  it("uses a configured local checkout base without double slashes", () => {
    process.env.STRIPE_CHECKOUT_BASE_URL = "https://checkout.test/";
    const session = createStripeCheckoutSession({
      appointmentId: 12,
      amount: 4900,
      currency: "usd",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    expect(session.url).toBe(`https://checkout.test/${session.id}`);
  });

  it("accepts any matching current v1 signature", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const rawBody = Buffer.from('{"id":"evt"}');
    const timestamp = Math.floor(Date.now() / 1000);
    const valid = signature(rawBody, "secret", timestamp);
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: `t=${timestamp},v0=ignored,v1=short,v1=${valid}`,
        webhookSecret: "secret",
      })
    ).not.toThrow();
  });

  it.each([
    [undefined, "t=1,v1=value", "not configured"],
    ["secret", undefined, "Missing Stripe-Signature"],
    ["secret", "bad", "Invalid Stripe-Signature"],
    ["secret", "t=nope,v1=value", "Invalid Stripe signature timestamp"],
  ])("rejects invalid signature prerequisites", (secret, header, message) => {
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody: Buffer.from("{}"),
        signatureHeader: header,
        webhookSecret: secret,
      })
    ).toThrow(message);
  });

  it("rejects stale and non-matching signatures", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00.000Z"));
    const rawBody = Buffer.from("{}");
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: `t=1,v1=${signature(rawBody, "secret", 1)}`,
        webhookSecret: "secret",
      })
    ).toThrow("out of tolerance");
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: `t=${Math.floor(Date.now() / 1000)},v1=short`,
        webhookSecret: "secret",
      })
    ).toThrow("verification failed");
  });

  it("parses valid webhook events and rejects invalid payloads", () => {
    expect(
      parseStripeWebhookEvent(
        Buffer.from(
          '{"id":"evt","type":"checkout.session.completed","data":{"object":{}}}'
        )
      )
    ).toMatchObject({ id: "evt", type: "checkout.session.completed" });
    expect(() => parseStripeWebhookEvent(Buffer.from("null"))).toThrow(
      "Invalid Stripe webhook payload"
    );
    expect(() => parseStripeWebhookEvent(Buffer.from('{"id":"evt"}'))).toThrow(
      "Malformed Stripe webhook event"
    );
  });
});
