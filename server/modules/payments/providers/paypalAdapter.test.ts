import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({
  default: { post: vi.fn() },
}));

import axios from "axios";

const ORIGINAL_ENV = { ...process.env };

async function loadAdapter() {
  return import("./paypalAdapter");
}

function mockToken() {
  vi.mocked(axios.post).mockResolvedValueOnce({
    data: { access_token: "access-token", expires_in: 3600 },
  });
}

describe("PayPal payment adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      PAYPAL_CLIENT_ID: "client-id",
      PAYPAL_CLIENT_SECRET: "client-secret",
      PAYPAL_WEBHOOK_ID: "webhook-id",
      PAYPAL_API_BASE_URL: "https://paypal.test",
    };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("creates a checkout with normalized amount and approval link", async () => {
    mockToken();
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: {
        id: "order-42",
        links: [{ rel: "approve", href: "https://paypal.test/approve/42" }],
      },
    });
    const { createPaypalCheckoutSession } = await loadAdapter();

    await expect(
      createPaypalCheckoutSession({
        resource: { type: "referral_order", id: 42 },
        amount: 19900,
        currency: "cny",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).resolves.toEqual({
      provider: "paypal",
      id: "order-42",
      url: "https://paypal.test/approve/42",
    });
    expect(axios.post).toHaveBeenNthCalledWith(
      2,
      "https://paypal.test/v2/checkout/orders",
      expect.objectContaining({
        purchase_units: [
          expect.objectContaining({
            reference_id: "42",
            amount: { currency_code: "CNY", value: "199.00" },
          }),
        ],
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      })
    );
  });

  it("uses the appointment alias and fallback checkout URL", async () => {
    mockToken();
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { id: "order fallback", links: [] },
    });
    const { createPaypalCheckoutSession } = await loadAdapter();
    await expect(
      createPaypalCheckoutSession({
        appointmentId: 7,
        amount: Number.NaN,
        currency: "usd",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).resolves.toMatchObject({
      url: "https://www.paypal.com/checkoutnow?token=order%20fallback",
    });
  });

  it("rejects missing resources and malformed checkout responses", async () => {
    const { createPaypalCheckoutSession } = await loadAdapter();
    await expect(
      createPaypalCheckoutSession({
        amount: 100,
        currency: "usd",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).rejects.toThrow("Payment resource is required");

    mockToken();
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { links: [] } });
    await expect(
      createPaypalCheckoutSession({
        appointmentId: 7,
        amount: 100,
        currency: "usd",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).rejects.toThrow("returned no order id");
  });

  it("fails closed on missing credentials and invalid OAuth responses", async () => {
    delete process.env.PAYPAL_CLIENT_SECRET;
    let adapter = await loadAdapter();
    await expect(
      adapter.createPaypalCheckoutSession({
        appointmentId: 7,
        amount: 100,
        currency: "usd",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).rejects.toThrow("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");

    vi.resetModules();
    process.env.PAYPAL_CLIENT_SECRET = "client-secret";
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { access_token: "", expires_in: 0 },
    });
    adapter = await loadAdapter();
    await expect(
      adapter.createPaypalCheckoutSession({
        appointmentId: 7,
        amount: 100,
        currency: "usd",
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).rejects.toThrow("Invalid PayPal OAuth response");
  });

  it("parses webhook events and extracts order identifiers", async () => {
    const {
      extractSessionIdFromParamsFromRedirect,
      extractSessionIdFromWebhookEvent,
      parsePaypalWebhookEvent,
    } = await loadAdapter();
    const event = parsePaypalWebhookEvent(
      Buffer.from('{"id":"evt-1","event_type":"CHECKOUT.ORDER.APPROVED"}')
    );
    expect(
      extractSessionIdFromWebhookEvent({
        ...event,
        resource: { id: " order-1 " },
      })
    ).toBe("order-1");
    expect(
      extractSessionIdFromWebhookEvent({
        ...event,
        resource: { purchase_units: [{ reference_id: " ref-1 " }] },
      })
    ).toBe("ref-1");
    expect(extractSessionIdFromWebhookEvent(event)).toBeNull();
    expect(
      extractSessionIdFromParamsFromRedirect(
        new URLSearchParams("token=%20order-2%20")
      )
    ).toBe("order-2");
    expect(
      extractSessionIdFromParamsFromRedirect(new URLSearchParams())
    ).toBeNull();
    expect(() => parsePaypalWebhookEvent(Buffer.from("null"))).toThrow(
      "Invalid PayPal webhook payload"
    );
    expect(() => parsePaypalWebhookEvent(Buffer.from('{"id":""}'))).toThrow(
      "Malformed PayPal webhook payload"
    );
    expect(() => parsePaypalWebhookEvent(Buffer.from('{"id":"evt"}'))).toThrow(
      "Malformed PayPal webhook payload"
    );
  });

  it("verifies webhook headers including array-valued headers", async () => {
    mockToken();
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { verification_status: "SUCCESS" },
    });
    const { verifyPaypalWebhookSignature } = await loadAdapter();
    const rawBody = Buffer.from(
      '{"id":"evt-1","event_type":"PAYMENT.CAPTURE.COMPLETED"}'
    );
    await expect(
      verifyPaypalWebhookSignature({
        rawBody,
        headers: {
          "paypal-transmission-sig": ["signature"],
          "paypal-transmission-id": ["transmission-id"],
          "paypal-transmission-time": ["2026-01-01T00:00:00Z"],
          "paypal-cert-url": ["https://paypal.test/cert"],
          "paypal-auth-algo": ["SHA256withRSA"],
        },
      })
    ).resolves.toMatchObject({ id: "evt-1" });
  });

  it("rejects absent webhook configuration, headers, and failed verification", async () => {
    delete process.env.PAYPAL_WEBHOOK_ID;
    let adapter = await loadAdapter();
    const rawBody = Buffer.from('{"id":"evt","event_type":"event"}');
    await expect(
      adapter.verifyPaypalWebhookSignature({ rawBody, headers: {} })
    ).rejects.toThrow("PAYPAL_WEBHOOK_ID is required");

    vi.resetModules();
    process.env.PAYPAL_WEBHOOK_ID = "webhook-id";
    adapter = await loadAdapter();
    await expect(
      adapter.verifyPaypalWebhookSignature({ rawBody, headers: {} })
    ).rejects.toThrow("Missing PayPal webhook headers");

    mockToken();
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { verification_status: "FAILURE" },
    });
    await expect(
      adapter.verifyPaypalWebhookSignature({
        rawBody,
        headers: {
          "paypal-transmission-sig": "signature",
          "paypal-transmission-id": "transmission-id",
          "paypal-transmission-time": "time",
          "paypal-cert-url": "cert",
          "paypal-auth-algo": "algo",
        },
      })
    ).rejects.toThrow("signature verification failed");
  });

  it("captures completed and approved sessions while rejecting other states", async () => {
    mockToken();
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { status: "COMPLETED" } })
      .mockResolvedValueOnce({ data: { status: "APPROVED" } })
      .mockResolvedValueOnce({ data: { status: "PAYER_ACTION_REQUIRED" } });
    const { captureOrFinalizePaypalSession } = await loadAdapter();
    await expect(
      captureOrFinalizePaypalSession({ providerSessionId: "order/1" })
    ).resolves.toMatchObject({ paymentStatus: "paid" });
    await expect(
      captureOrFinalizePaypalSession({ providerSessionId: "order-2" })
    ).resolves.toMatchObject({ paymentStatus: "paid" });
    await expect(
      captureOrFinalizePaypalSession({ providerSessionId: "order-3" })
    ).rejects.toThrow("PayPal capture not completed");
    expect(vi.mocked(axios.post).mock.calls[1]?.[0]).toContain("order%2F1");
  });

  it("refunds captures idempotently and maps pending status", async () => {
    mockToken();
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ data: { id: "refund-1", status: "COMPLETED" } })
      .mockResolvedValueOnce({ data: { id: "refund-2", status: "PENDING" } });
    const { refundPaypalPayment } = await loadAdapter();
    await expect(
      refundPaypalPayment({
        providerSessionId: "order-1",
        providerTransactionId: "capture/1",
        amount: 1099,
        currency: "usd",
        idempotencyKey: "refund-key-1",
      })
    ).resolves.toMatchObject({
      providerRefundId: "refund-1",
      status: "succeeded",
    });
    expect(vi.mocked(axios.post).mock.calls[1]?.[0]).toContain(
      "capture%2F1/refund"
    );
    expect(vi.mocked(axios.post).mock.calls[1]?.[2]).toMatchObject({
      headers: { "PayPal-Request-Id": "refund-key-1" },
    });
    await expect(
      refundPaypalPayment({
        providerSessionId: "order-2",
        providerTransactionId: "capture-2",
        amount: 1099,
        currency: "usd",
        idempotencyKey: "refund-key-2",
      })
    ).resolves.toMatchObject({ status: "pending" });
  });

  it("rejects refunds without capture or provider refund identifiers", async () => {
    const { refundPaypalPayment } = await loadAdapter();
    await expect(
      refundPaypalPayment({
        providerSessionId: "order-1",
        providerTransactionId: " ",
        amount: 100,
        currency: "usd",
        idempotencyKey: "refund-key",
      })
    ).rejects.toThrow("capture id is required");

    mockToken();
    vi.mocked(axios.post).mockResolvedValueOnce({
      data: { status: "PENDING" },
    });
    await expect(
      refundPaypalPayment({
        providerSessionId: "order-1",
        providerTransactionId: "capture-1",
        amount: 100,
        currency: "usd",
        idempotencyKey: "refund-key",
      })
    ).rejects.toThrow("returned no refund id");
  });
});
