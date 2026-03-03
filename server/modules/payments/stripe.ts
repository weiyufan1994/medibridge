import crypto from "crypto";

const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type StripeCheckoutSessionLike = {
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

export function createStripeCheckoutSession(input: {
  appointmentId: number;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): StripeCheckoutSessionLike {
  const configuredCheckoutBase = process.env.STRIPE_CHECKOUT_BASE_URL?.trim();
  const id = buildMockSessionId();

  // This is a server-side integration seam.
  // Replace with official Stripe SDK call in production.
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
        urlObj.searchParams.set("mockPaid", "1");
        return urlObj.toString();
      })();

  return { id, url };
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

  const { timestamp, signatures } = parseStripeSignatureHeader(input.signatureHeader);
  if (!timestamp || signatures.length === 0) {
    throw new Error("Invalid Stripe-Signature header");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const signedAtSeconds = Number(timestamp);
  if (!Number.isFinite(signedAtSeconds)) {
    throw new Error("Invalid Stripe signature timestamp");
  }

  if (Math.abs(nowSeconds - signedAtSeconds) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
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
    throw new Error("Malformed Stripe webhook event");
  }
  return payload;
}
