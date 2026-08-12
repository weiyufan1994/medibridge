import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from "axios";
import {
  captureOrFinalizeStripeSession,
  createStripeCheckoutSession,
  extractSessionIdFromWebhookEvent,
  parseStripeWebhookEvent,
  refundStripePayment,
  stripeAdapter,
  verifyStripeWebhookSignature,
} from "./stripeAdapter";

const ORIGINAL_ENV = { ...process.env };

function signedHeader(rawBody: Buffer, secret: string, timestamp: number) {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("Stripe adapter safety boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_CHECKOUT_BASE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.useRealTimers();
  });

  it("builds local checkout URLs without calling Stripe", async () => {
    const replaced = await createStripeCheckoutSession({
      appointmentId: 42,
      amount: 4900,
      currency: "usd",
      successUrl: "https://app.test/success/{CHECKOUT_SESSION_ID}",
      cancelUrl: "https://app.test/cancel",
    });
    expect(replaced.id).toMatch(/^cs_test_/);
    expect(replaced.url).toContain(replaced.id);

    const appended = await createStripeCheckoutSession({
      appointmentId: 42,
      amount: 4900,
      currency: "usd",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    expect(new URL(appended.url).searchParams.get("session_id")).toBe(
      appended.id
    );

    process.env.STRIPE_CHECKOUT_BASE_URL = "https://checkout.test/";
    const configured = await createStripeCheckoutSession({
      appointmentId: 42,
      amount: 4900,
      currency: "usd",
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
    expect(configured.url).toBe(`https://checkout.test/${configured.id}`);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("fails closed for production credentials and invalid resources", async () => {
    process.env.NODE_ENV = "production";
    await expect(
      createStripeCheckoutSession({
        appointmentId: 42,
        amount: 4900,
        currency: "usd",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).rejects.toThrow("STRIPE_SECRET_KEY is required");

    process.env.NODE_ENV = "test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    await expect(
      createStripeCheckoutSession({
        amount: 4900,
        currency: "usd",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).rejects.toThrow("Payment resource is required");
  });

  it("rejects incomplete Stripe checkout responses", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    vi.mocked(axios.post).mockResolvedValue({ data: { id: "cs_42" } });
    await expect(
      createStripeCheckoutSession({
        appointmentId: 42,
        amount: 4900,
        currency: "usd",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).rejects.toThrow("invalid session");
  });

  it("accepts a current valid webhook signature", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const timestamp = Math.floor(Date.now() / 1000);
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: signedHeader(rawBody, "whsec_test", timestamp),
        webhookSecret: "whsec_test",
      })
    ).not.toThrow();
  });

  it.each([
    [undefined, "t=1,v1=value", "not configured"],
    ["secret", undefined, "Missing Stripe-Signature"],
    ["secret", "garbage", "Invalid Stripe-Signature"],
    ["secret", "t=nope,v1=value", "Invalid Stripe signature timestamp"],
  ])("rejects malformed signature inputs", (secret, header, message) => {
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody: Buffer.from("{}"),
        signatureHeader: header,
        webhookSecret: secret,
      })
    ).toThrow(message);
  });

  it("rejects stale and mismatched webhook signatures", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:10:00.000Z"));
    const rawBody = Buffer.from("{}");
    expect(() =>
      verifyStripeWebhookSignature({
        rawBody,
        signatureHeader: signedHeader(rawBody, "secret", 1),
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

  it("parses webhook events and extracts session identifiers by precedence", () => {
    const parsed = parseStripeWebhookEvent(
      Buffer.from(
        JSON.stringify({
          id: "evt_1",
          type: "checkout.session.completed",
          data: { object: { id: "cs_direct" } },
        })
      )
    );
    expect(extractSessionIdFromWebhookEvent(parsed)).toBe("cs_direct");
    expect(
      extractSessionIdFromWebhookEvent({
        ...parsed,
        data: {
          object: {
            id: "cs_direct",
            checkout_session: "cs_nested",
            metadata: { stripeSessionId: "cs_metadata" },
          },
        },
      })
    ).toBe("cs_metadata");
    expect(
      extractSessionIdFromWebhookEvent({
        ...parsed,
        data: { object: { checkout_session: "cs_nested" } },
      })
    ).toBe("cs_nested");
    expect(
      extractSessionIdFromWebhookEvent({ ...parsed, data: { object: {} } })
    ).toBeNull();
    expect(() => parseStripeWebhookEvent(Buffer.from("null"))).toThrow(
      "Invalid Stripe webhook payload"
    );
    expect(() => parseStripeWebhookEvent(Buffer.from('{"id":"evt"}'))).toThrow(
      "Malformed Stripe webhook payload"
    );
  });

  it("handles local, production, and paid capture paths", async () => {
    await expect(
      captureOrFinalizeStripeSession({ providerSessionId: "" })
    ).rejects.toThrow("Missing session id");
    await expect(
      captureOrFinalizeStripeSession({ providerSessionId: "cs_local" })
    ).resolves.toMatchObject({
      providerTransactionId: "cs_local",
      paymentStatus: "paid",
    });

    process.env.NODE_ENV = "production";
    await expect(
      captureOrFinalizeStripeSession({ providerSessionId: "cs_prod" })
    ).rejects.toThrow("STRIPE_SECRET_KEY is required");

    process.env.NODE_ENV = "test";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    vi.mocked(axios.get).mockResolvedValue({
      data: { payment_status: "paid", payment_intent: "pi_42" },
    });
    await expect(
      captureOrFinalizeStripeSession({ providerSessionId: "cs_42" })
    ).resolves.toMatchObject({
      providerTransactionId: "pi_42",
      paymentStatus: "paid",
    });
  });

  it("resolves refund transactions and preserves pending status", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    vi.mocked(axios.get).mockResolvedValue({
      data: { payment_status: "paid", payment_intent: "pi_42" },
    });
    vi.mocked(axios.post).mockResolvedValue({
      data: { id: "re_42", status: "pending" },
    });
    await expect(
      refundStripePayment({
        providerSessionId: "cs_42",
        amount: 4900,
        currency: "usd",
        idempotencyKey: "refund-42",
      })
    ).resolves.toMatchObject({ providerRefundId: "re_42", status: "pending" });
  });

  it("rejects refunds without a transaction or refund id", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    vi.mocked(axios.get).mockResolvedValue({
      data: { payment_status: "unpaid", payment_intent: null },
    });
    await expect(
      refundStripePayment({
        providerSessionId: "cs_42",
        amount: 4900,
        currency: "usd",
        idempotencyKey: "refund-42",
      })
    ).rejects.toThrow("Payment Intent is required");

    vi.mocked(axios.post).mockResolvedValue({ data: { status: "failed" } });
    await expect(
      refundStripePayment({
        providerSessionId: "cs_42",
        providerTransactionId: "pi_42",
        amount: 4900,
        currency: "usd",
        idempotencyKey: "refund-42",
      })
    ).rejects.toThrow("returned no refund id");
  });

  it("maps the adapter webhook header contract", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const rawBody = Buffer.from("{}");
    const webhookSecret = "whsec_adapter";
    expect(() =>
      stripeAdapter.verifyWebhook({
        rawBody,
        headers: {
          "stripe-signature": signedHeader(
            rawBody,
            webhookSecret,
            Math.floor(Date.now() / 1000)
          ),
        },
        webhookSecret,
      })
    ).not.toThrow();
  });
});
