import crypto from "node:crypto";
import type {
  PaymentCheckoutInput,
  PaymentProviderWebhookAdapter,
} from "../providerManager";

export const MOCK_PAYMENT_PROVIDER = "mock" as const;

function buildStableMockId(prefix: string, value: string) {
  const digest = crypto.createHash("sha256").update(value).digest("hex");
  return `${prefix}_${digest.slice(0, 32)}`;
}

function createMockCheckoutSession(input: PaymentCheckoutInput) {
  const resource = input.resource;
  if (!resource) {
    throw new Error("Mock payment resource is required");
  }
  if (!input.mockCheckoutUrl) {
    throw new Error("Mock checkout URL is required");
  }

  return {
    provider: MOCK_PAYMENT_PROVIDER,
    id: `mock_${resource.type}_session_${crypto.randomBytes(16).toString("hex")}`,
    url: input.mockCheckoutUrl,
  };
}

function assertMockSessionId(providerSessionId: string) {
  if (
    !/^mock_(appointment|referral_order)_session_[0-9a-f]{32}$/.test(
      providerSessionId
    )
  ) {
    throw new Error("Invalid mock payment session id");
  }
}

async function captureOrFinalizeMockSession(input: {
  providerSessionId: string;
}) {
  assertMockSessionId(input.providerSessionId);
  return {
    provider: MOCK_PAYMENT_PROVIDER,
    providerSessionId: input.providerSessionId,
    providerTransactionId: buildStableMockId(
      "mock_transaction",
      input.providerSessionId
    ),
    paymentStatus: "paid" as const,
  };
}

async function refundMockPayment(input: {
  providerSessionId: string;
  idempotencyKey: string;
}) {
  assertMockSessionId(input.providerSessionId);
  if (!input.idempotencyKey.trim()) {
    throw new Error("Mock refund idempotency key is required");
  }
  return {
    provider: MOCK_PAYMENT_PROVIDER,
    providerRefundId: buildStableMockId("mock_refund", input.idempotencyKey),
    status: "succeeded" as const,
  };
}

function rejectMockWebhook(): never {
  throw new Error("Mock payments do not support webhooks");
}

export const mockAdapter = {
  provider: MOCK_PAYMENT_PROVIDER,
  createSession: createMockCheckoutSession,
  parseWebhookEvent: rejectMockWebhook,
  verifyWebhook: rejectMockWebhook,
  extractSessionIdFromWebhookEvent: () => null,
  captureOrFinalize: captureOrFinalizeMockSession,
  refund: refundMockPayment,
  getEventType: () => "",
} satisfies PaymentProviderWebhookAdapter;
