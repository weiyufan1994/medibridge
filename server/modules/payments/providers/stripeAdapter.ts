import crypto from "crypto";
import axios from "axios";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export const STRIPE_PROVIDER = "stripe" as const;
export type PaymentProvider = "stripe" | "paypal";

export type CheckoutSession = {
  provider: "stripe";
  id: string;
  url: string;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

function buildMockSessionId() {
  return `cs_test_${crypto.randomBytes(18).toString("hex")}`;
}

type StripeResource = {
  type: "appointment" | "referral_order";
  id: number;
};

type StripeCheckoutInput = {
  appointmentId?: number;
  resource?: StripeResource;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
};

function getStripeApiBase(): string {
  return (process.env.STRIPE_API_BASE_URL ?? "https://api.stripe.com").replace(
    /\/$/,
    ""
  );
}

function getStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required");
  }
  return secretKey;
}

function resolveResource(input: StripeCheckoutInput): StripeResource {
  if (input.resource) {
    return input.resource;
  }
  if (input.appointmentId) {
    return { type: "appointment", id: input.appointmentId };
  }
  throw new Error("Payment resource is required");
}

function buildDevelopmentCheckout(input: StripeCheckoutInput): CheckoutSession {
  const configuredCheckoutBase = process.env.STRIPE_CHECKOUT_BASE_URL?.trim();
  const id = buildMockSessionId();

  const url = configuredCheckoutBase
    ? `${configuredCheckoutBase.replace(/\/$/, "")}/${id}`
    : (() => {
        const successUrlWithSessionId = input.successUrl.includes(
          "{CHECKOUT_SESSION_ID}"
        )
          ? input.successUrl.replace("{CHECKOUT_SESSION_ID}", id)
          : input.successUrl;
        const urlObj = new URL(successUrlWithSessionId);
        if (!urlObj.searchParams.get("session_id")) {
          urlObj.searchParams.set("session_id", id);
        }
        return urlObj.toString();
      })();

  return {
    provider: STRIPE_PROVIDER,
    id,
    url,
  };
}

export async function createStripeCheckoutSession(
  input: StripeCheckoutInput
): Promise<CheckoutSession> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    if (process.env.NODE_ENV === "production") {
      getStripeSecretKey();
    }
    return buildDevelopmentCheckout(input);
  }

  const resource = resolveResource(input);
  const form = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: String(resource.id),
    "metadata[resourceType]": resource.type,
    "metadata[resourceId]": String(resource.id),
    "payment_intent_data[metadata][resourceType]": resource.type,
    "payment_intent_data[metadata][resourceId]": String(resource.id),
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amount),
    "line_items[0][price_data][product_data][name]":
      resource.type === "referral_order"
        ? "MediBridge referral coordination service"
        : "MediBridge consultation",
  });
  if (resource.type === "appointment") {
    form.set("metadata[appointmentId]", String(resource.id));
    form.set(
      "payment_intent_data[metadata][appointmentId]",
      String(resource.id)
    );
  }
  const response = await axios.post(
    `${getStripeApiBase()}/v1/checkout/sessions`,
    form.toString(),
    {
      headers: {
        Authorization: `Bearer ${getStripeSecretKey()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 12_000,
    }
  );
  const id = String(response.data?.id || "").trim();
  const url = String(response.data?.url || "").trim();
  if (!id || !url) {
    throw new Error("Stripe Checkout API returned an invalid session");
  }

  return { provider: STRIPE_PROVIDER, id, url };
}

function parseStripeSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader.split(",").map(item => item.trim());
  let timestamp = "";
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || !value) continue;
    if (key === "t") {
      timestamp = value;
      continue;
    }
    if (key === "v1") {
      signatures.push(value);
    }
  }

  return {
    timestamp,
    signatures,
  };
}

export function verifyStripeWebhookSignature(input: {
  rawBody: Buffer;
  signatureHeader: string | undefined;
  webhookSecret: string | undefined;
}) {
  const webhookSecret = input.webhookSecret?.trim();
  if (!webhookSecret) {
    throw new Error("Stripe webhook secret is not configured");
  }

  if (!input.signatureHeader) {
    throw new Error("Missing Stripe-Signature header");
  }

  const { timestamp, signatures } = parseStripeSignatureHeader(
    input.signatureHeader
  );
  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid Stripe-Signature header");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const signedAtSeconds = Number(timestamp);
  if (!Number.isFinite(signedAtSeconds)) {
    throw new Error("Invalid Stripe signature timestamp");
  }

  if (
    Math.abs(nowSeconds - signedAtSeconds) > STRIPE_SIGNATURE_TOLERANCE_SECONDS
  ) {
    throw new Error("Stripe signature timestamp is out of tolerance");
  }

  const payloadToSign = `${timestamp}.${input.rawBody.toString("utf8")}`;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(payloadToSign, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  const matched = signatures.some(signature => {
    const receivedBuffer = Buffer.from(signature, "utf8");
    if (receivedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
  });

  if (!matched) {
    throw new Error("Stripe signature verification failed");
  }
}

export function parseStripeWebhookEvent(rawBody: Buffer): StripeWebhookEvent {
  const payload = JSON.parse(rawBody.toString("utf8")) as StripeWebhookEvent;
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Stripe webhook payload");
  }
  if (!payload.id || !payload.type || !payload.data?.object) {
    throw new Error("Malformed Stripe webhook payload");
  }
  return payload;
}

export function extractSessionIdFromWebhookEvent(
  event: StripeWebhookEvent
): string | null {
  const metadata =
    event.data.object?.metadata &&
    typeof event.data.object.metadata === "object"
      ? (event.data.object.metadata as Record<string, unknown>)
      : {};
  const directObjectId =
    typeof event.data.object.id === "string" &&
    event.data.object.id.trim().length > 0
      ? event.data.object.id.trim()
      : null;
  const metadataSessionId =
    typeof metadata.stripeSessionId === "string"
      ? metadata.stripeSessionId.trim()
      : null;
  const nestedCheckoutSessionId =
    typeof event.data.object.checkout_session === "string"
      ? event.data.object.checkout_session.trim()
      : null;

  return metadataSessionId || nestedCheckoutSessionId || directObjectId || null;
}

export async function captureOrFinalizeStripeSession(input: {
  providerSessionId: string;
}) {
  if (!input.providerSessionId) {
    throw new Error("Missing session id");
  }
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    if (process.env.NODE_ENV === "production") {
      getStripeSecretKey();
    }
    return {
      provider: STRIPE_PROVIDER,
      providerSessionId: input.providerSessionId,
      providerTransactionId: input.providerSessionId,
      paymentStatus: "paid" as const,
    };
  }

  const response = await axios.get(
    `${getStripeApiBase()}/v1/checkout/sessions/${encodeURIComponent(
      input.providerSessionId
    )}`,
    {
      headers: {
        Authorization: `Bearer ${getStripeSecretKey()}`,
      },
      timeout: 12_000,
    }
  );
  const paymentStatus = String(
    response.data?.payment_status || ""
  ).toLowerCase();
  const transactionId = String(response.data?.payment_intent || "").trim();
  return {
    provider: STRIPE_PROVIDER,
    providerSessionId: input.providerSessionId,
    providerTransactionId: transactionId || null,
    paymentStatus:
      paymentStatus === "paid" ? ("paid" as const) : ("unpaid" as const),
  };
}

export async function refundStripePayment(input: {
  resource?: StripeResource;
  providerSessionId: string;
  providerTransactionId?: string | null;
  amount: number;
  currency: string;
  idempotencyKey: string;
}) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    if (process.env.NODE_ENV === "production") {
      getStripeSecretKey();
    }
    return {
      provider: STRIPE_PROVIDER,
      providerRefundId: `re_test_${crypto.randomBytes(18).toString("hex")}`,
      status: "succeeded" as const,
    };
  }

  let transactionId = input.providerTransactionId?.trim() ?? "";
  if (!transactionId) {
    const checkout = await captureOrFinalizeStripeSession({
      providerSessionId: input.providerSessionId,
    });
    transactionId = checkout.providerTransactionId ?? "";
  }
  if (!transactionId) {
    throw new Error("Stripe Payment Intent is required for refund");
  }

  const form = new URLSearchParams({
    payment_intent: transactionId,
    amount: String(input.amount),
    "metadata[resourceType]": input.resource?.type ?? "",
    "metadata[resourceId]": String(input.resource?.id ?? ""),
  });
  const response = await axios.post(
    `${getStripeApiBase()}/v1/refunds`,
    form.toString(),
    {
      headers: {
        Authorization: `Bearer ${getStripeSecretKey()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey,
      },
      timeout: 12_000,
    }
  );
  const refundId = String(response.data?.id || "").trim();
  if (!refundId) {
    throw new Error("Stripe refund API returned no refund id");
  }
  const status = String(response.data?.status || "").toLowerCase();
  return {
    provider: STRIPE_PROVIDER,
    providerRefundId: refundId,
    status:
      status === "succeeded" ? ("succeeded" as const) : ("pending" as const),
  };
}

export const stripeAdapter = {
  provider: STRIPE_PROVIDER,
  createSession: createStripeCheckoutSession,
  parseWebhookEvent: parseStripeWebhookEvent,
  verifyWebhook: (payload: {
    rawBody: Buffer;
    headers: Record<string, string | undefined>;
    webhookSecret?: string;
  }) => {
    verifyStripeWebhookSignature({
      rawBody: payload.rawBody,
      signatureHeader: payload.headers["stripe-signature"],
      webhookSecret: payload.webhookSecret,
    });
  },
  extractSessionId: extractSessionIdFromWebhookEvent,
  captureOrFinalize: captureOrFinalizeStripeSession,
  refund: refundStripePayment,
} as const;
