import axios from "axios";

export const PAYPAL_PROVIDER = "paypal" as const;

const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID?.trim();

type PayPalWebhookEvent = {
  id: string;
  event_type: string;
  resource?: Record<string, unknown>;
  [key: string]: unknown;
};

type CacheToken = {
  token: string;
  expiresAtMs: number;
};

let cachedToken: CacheToken | null = null;

function buildPayPalApiBase() {
  return (process.env.PAYPAL_API_BASE_URL ?? "https://api-m.sandbox.paypal.com").trim();
}

function buildAuthHeader() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
  }
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function parseAmount(input: { amount: number; currency: string }) {
  const currency = input.currency.toUpperCase();
  const numeric = Number.isFinite(input.amount) ? input.amount : 0;
  return {
    currency_code: currency,
    value: (numeric / 100).toFixed(2),
  };
}

async function getPaypalAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAtMs > Date.now()) {
    return cachedToken.token;
  }

  const requestToken = await axios.post(
    `${buildPayPalApiBase()}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: buildAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 10_000,
    }
  );

  const token = String(requestToken.data?.access_token || "");
  const expiresIn = Number(requestToken.data?.expires_in || 0);
  if (!token || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("Invalid PayPal OAuth response");
  }

  cachedToken = {
    token,
    expiresAtMs: Date.now() + Math.max(60_000, (expiresIn - 120) * 1000),
  };

  return token;
}

export async function createPaypalCheckoutSession(input: {
  appointmentId: number;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ provider: "paypal"; id: string; url: string }> {
  const accessToken = await getPaypalAccessToken();
  const amount = parseAmount({
    amount: input.amount,
    currency: input.currency,
  });

  const response = await axios.post(
    `${buildPayPalApiBase()}/v2/checkout/orders`,
    {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: String(input.appointmentId),
          amount,
        },
      ],
      application_context: {
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
        user_action: "PAY_NOW",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 12_000,
    }
  );

  const orderId = String(response.data?.id || "").trim();
  if (!orderId) {
    throw new Error("PayPal checkout API returned no order id");
  }

  const links = Array.isArray(response.data?.links) ? response.data.links : [];
  const approveLink = links.find((item: Record<string, unknown>) => item.rel === "approve");
  const approvalUrl =
    typeof approveLink?.href === "string"
      ? approveLink.href
      : `https://www.paypal.com/checkoutnow?token=${encodeURIComponent(orderId)}`;

  return {
    provider: PAYPAL_PROVIDER,
    id: orderId,
    url: approvalUrl,
  };
}

export function parsePaypalWebhookEvent(rawBody: Buffer): PayPalWebhookEvent {
  const payload = JSON.parse(rawBody.toString("utf8")) as PayPalWebhookEvent;
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid PayPal webhook payload");
  }
  if (typeof payload.id !== "string" || !payload.id.trim()) {
    throw new Error("Malformed PayPal webhook payload");
  }
  if (typeof payload.event_type !== "string" || !payload.event_type.trim()) {
    throw new Error("Malformed PayPal webhook payload");
  }
  return payload;
}

export function extractSessionIdFromWebhookEvent(event: PayPalWebhookEvent): string | null {
  if (typeof event.resource?.id === "string") {
    const id = event.resource.id.trim();
    if (id.length > 0) return id;
  }
  const purchaseUnits =
    typeof event.resource?.purchase_units === "object" && Array.isArray((event.resource as { purchase_units?: unknown }).purchase_units)
      ? ((event.resource as { purchase_units?: unknown[] }).purchase_units ?? [])
      : [];
  if (purchaseUnits.length > 0) {
    const unit = purchaseUnits[0] as Record<string, unknown>;
    const reference = typeof unit.reference_id === "string" ? unit.reference_id.trim() : "";
    if (reference.length > 0) return reference;
  }

  return null;
}

export function extractSessionIdFromParamsFromRedirect(query: URLSearchParams): string | null {
  return query.get("token")?.trim() || null;
}

export async function verifyPaypalWebhookSignature(input: {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}): Promise<PayPalWebhookEvent> {
  if (!PAYPAL_WEBHOOK_ID) {
    throw new Error("PAYPAL_WEBHOOK_ID is required");
  }

  const event = parsePaypalWebhookEvent(input.rawBody);
  const signature =
    typeof input.headers["paypal-transmission-sig"] === "string"
      ? input.headers["paypal-transmission-sig"]
      : Array.isArray(input.headers["paypal-transmission-sig"])
        ? input.headers["paypal-transmission-sig"]?.[0]
        : undefined;
  const transmissionId =
    typeof input.headers["paypal-transmission-id"] === "string"
      ? input.headers["paypal-transmission-id"]
      : Array.isArray(input.headers["paypal-transmission-id"])
        ? input.headers["paypal-transmission-id"]?.[0]
        : undefined;
  const transmissionTime =
    typeof input.headers["paypal-transmission-time"] === "string"
      ? input.headers["paypal-transmission-time"]
      : Array.isArray(input.headers["paypal-transmission-time"])
        ? input.headers["paypal-transmission-time"]?.[0]
        : undefined;
  const certUrl =
    typeof input.headers["paypal-cert-url"] === "string"
      ? input.headers["paypal-cert-url"]
      : Array.isArray(input.headers["paypal-cert-url"])
        ? input.headers["paypal-cert-url"]?.[0]
        : undefined;
  const authAlgo =
    typeof input.headers["paypal-auth-algo"] === "string"
      ? input.headers["paypal-auth-algo"]
      : Array.isArray(input.headers["paypal-auth-algo"])
        ? input.headers["paypal-auth-algo"]?.[0]
        : undefined;

  if (!signature || !transmissionId || !transmissionTime || !certUrl || !authAlgo) {
    throw new Error("Missing PayPal webhook headers");
  }

  const accessToken = await getPaypalAccessToken();
  const verification = await axios.post(
    `${buildPayPalApiBase()}/v1/notifications/verify-webhook-signature`,
    {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: signature,
      transmission_time: transmissionTime,
      webhook_id: PAYPAL_WEBHOOK_ID,
      webhook_event: event,
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 10_000,
    }
  );

  const status = String(verification.data?.verification_status || "").toLowerCase();
  if (status !== "success") {
    throw new Error("PayPal webhook signature verification failed");
  }

  return event;
}

export async function captureOrFinalizePaypalSession(input: {
  providerSessionId: string;
}): Promise<{ provider: "paypal"; providerSessionId: string }> {
  const accessToken = await getPaypalAccessToken();
  const response = await axios.post(
    `${buildPayPalApiBase()}/v2/checkout/orders/${encodeURIComponent(input.providerSessionId)}/capture`,
    {},
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 12_000,
    }
  );

  const status = String(response.data?.status || "").toLowerCase();
  if (status !== "completed" && status !== "approved") {
    throw new Error(`PayPal capture not completed: ${status || "unknown"}`);
  }

  return {
    provider: PAYPAL_PROVIDER,
    providerSessionId: input.providerSessionId,
  };
}

export const paypalAdapter = {
  provider: PAYPAL_PROVIDER,
  createSession: createPaypalCheckoutSession,
  parseWebhookEvent: parsePaypalWebhookEvent,
  verifyWebhook: verifyPaypalWebhookSignature,
  extractSessionId: extractSessionIdFromWebhookEvent,
  extractSessionIdFromParamsFromRedirect,
  captureOrFinalize: captureOrFinalizePaypalSession,
} as const;
