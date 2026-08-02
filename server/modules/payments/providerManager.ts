import { mockAdapter } from "./providers/mockAdapter";
import { stripeAdapter } from "./providers/stripeAdapter";
import { paypalAdapter } from "./providers/paypalAdapter";

export type ExternalPaymentProvider = "stripe" | "paypal";
export type PaymentProvider = ExternalPaymentProvider | "mock";

export type PaymentResource = {
  type: "appointment" | "referral_order";
  id: number;
};

export type PaymentCheckoutInput = {
  appointmentId?: number;
  resource?: PaymentResource;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  mockCheckoutUrl?: string;
};

export type PaymentCheckoutSession<
  TProvider extends PaymentProvider = PaymentProvider,
> = {
  provider: TProvider;
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
  createSession: (
    input: PaymentCheckoutInput
  ) => Promise<PaymentCheckoutSession> | PaymentCheckoutSession;
  parseWebhookEvent: (rawBody: Buffer) => unknown;
  verifyWebhook: (input: {
    rawBody: Buffer;
    headers: Record<string, string | undefined>;
    webhookSecret?: string;
  }) => Promise<void> | void;
  extractSessionIdFromWebhookEvent: (event: unknown) => string | null;
  captureOrFinalize: (input: { providerSessionId: string }) => Promise<{
    provider: PaymentProvider;
    providerSessionId: string;
    providerTransactionId?: string | null;
    paymentStatus?: "paid" | "unpaid";
  }>;
  refund: (input: {
    resource?: PaymentResource;
    providerSessionId: string;
    providerTransactionId?: string | null;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }) => Promise<{
    provider: PaymentProvider;
    providerRefundId: string;
    status: "pending" | "succeeded";
  }>;
  getEventType: (event: unknown) => string;
  getResourceId?: (event: unknown) => string | null;
};

function assertPaymentProvider(value: string): ExternalPaymentProvider {
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
    verifyWebhook: input => {
      stripeAdapter.verifyWebhook({
        rawBody: input.rawBody,
        headers: input.headers,
        webhookSecret: input.webhookSecret,
      });
    },
    extractSessionIdFromWebhookEvent: event =>
      stripeAdapter.extractSessionId(event as never),
    captureOrFinalize: stripeAdapter.captureOrFinalize,
    refund: stripeAdapter.refund,
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
    refund: paypalAdapter.refund,
    getEventType: event => {
      if (!event || typeof event !== "object" || !("event_type" in event)) {
        return "";
      }
      return String((event as Record<string, unknown>).event_type || "");
    },
  },
  mock: mockAdapter,
};

export function resolvePaymentProvider(): ExternalPaymentProvider {
  return assertPaymentProvider(resolveRawProvider());
}

export function resolvePaymentAdapter(
  provider: PaymentProvider = resolvePaymentProvider()
): PaymentProviderWebhookAdapter {
  return ADAPTERS[provider];
}

export function createPaymentCheckoutSession(
  input: PaymentCheckoutInput
): Promise<PaymentCheckoutSession<ExternalPaymentProvider>>;
export function createPaymentCheckoutSession(
  input: PaymentCheckoutInput,
  provider: ExternalPaymentProvider
): Promise<PaymentCheckoutSession<ExternalPaymentProvider>>;
export function createPaymentCheckoutSession(
  input: PaymentCheckoutInput,
  provider: "mock"
): Promise<PaymentCheckoutSession<"mock">>;
export async function createPaymentCheckoutSession(
  input: PaymentCheckoutInput,
  provider: PaymentProvider = resolvePaymentProvider()
): Promise<PaymentCheckoutSession> {
  const adapter = resolvePaymentAdapter(provider);
  return await Promise.resolve(adapter.createSession(input));
}

export async function refundPayment(input: {
  provider: PaymentProvider;
  resource?: PaymentResource;
  providerSessionId: string;
  providerTransactionId?: string | null;
  amount: number;
  currency: string;
  idempotencyKey: string;
}) {
  return ADAPTERS[input.provider].refund(input);
}
