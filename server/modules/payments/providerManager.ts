import { stripeAdapter } from "./providers/stripeAdapter";
import { paypalAdapter } from "./providers/paypalAdapter";

export type PaymentProvider = "stripe" | "paypal";

export type PaymentCheckoutInput = {
  appointmentId: number;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
};

export type PaymentCheckoutSession = {
  provider: PaymentProvider;
  id: string;
  url: string;
};

export type ProviderWebhookEvent = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type PaymentProviderWebhookAdapter = {
  provider: PaymentProvider;
  createSession: (input: PaymentCheckoutInput) => Promise<PaymentCheckoutSession> | PaymentCheckoutSession;
  parseWebhookEvent: (rawBody: Buffer) => unknown;
  verifyWebhook: (input: {
    rawBody: Buffer;
    headers: Record<string, string | undefined>;
    webhookSecret?: string;
  }) => Promise<void> | void;
  extractSessionIdFromWebhookEvent: (event: unknown) => string | null;
  captureOrFinalize: (input: {
    providerSessionId: string;
  }) => Promise<{ provider: PaymentProvider; providerSessionId: string }>;
  getEventType: (event: unknown) => string;
  getResourceId?: (event: unknown) => string | null;
};

function assertPaymentProvider(value: string): PaymentProvider {
  if (value === "paypal") {
    return "paypal";
  }
  if (!value || value === "stripe") {
    return "stripe";
  }
  throw new Error(`Unsupported PAYMENT_PROVIDER: ${value}`);
}

function resolveRawProvider(): string {
  return (process.env.PAYMENT_PROVIDER || "stripe").trim().toLowerCase();
}

const ADAPTERS: Record<PaymentProvider, PaymentProviderWebhookAdapter> = {
  stripe: {
    ...stripeAdapter,
    createSession: stripeAdapter.createSession,
    parseWebhookEvent: stripeAdapter.parseWebhookEvent,
    verifyWebhook: (input) => {
      stripeAdapter.verifyWebhook({
        rawBody: input.rawBody,
        headers: input.headers,
        webhookSecret: input.webhookSecret,
      });
    },
    extractSessionIdFromWebhookEvent: event =>
      stripeAdapter.extractSessionId(event as never),
    captureOrFinalize: stripeAdapter.captureOrFinalize,
    getEventType: event => {
      if (!event || typeof event !== "object" || !("type" in event)) {
        return "";
      }
      return String((event as Record<string, unknown>).type || "");
    },
  },
  paypal: {
    ...paypalAdapter,
    createSession: paypalAdapter.createSession,
    parseWebhookEvent: paypalAdapter.parseWebhookEvent,
    verifyWebhook: input => {
      paypalAdapter.verifyWebhook({
        rawBody: input.rawBody,
        headers: input.headers,
      });
    },
    extractSessionIdFromWebhookEvent: event =>
      paypalAdapter.extractSessionId(event as never),
    captureOrFinalize: paypalAdapter.captureOrFinalize,
    getEventType: event => {
      if (!event || typeof event !== "object" || !("event_type" in event)) {
        return "";
      }
      return String((event as Record<string, unknown>).event_type || "");
    },
  },
};

export function resolvePaymentProvider(): PaymentProvider {
  return assertPaymentProvider(resolveRawProvider());
}

export function resolvePaymentAdapter(): PaymentProviderWebhookAdapter {
  return ADAPTERS[resolvePaymentProvider()];
}

export async function createPaymentCheckoutSession(
  input: PaymentCheckoutInput
): Promise<PaymentCheckoutSession> {
  const adapter = resolvePaymentAdapter();
  return await Promise.resolve(adapter.createSession(input));
}
