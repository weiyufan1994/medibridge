import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/payments/stripe", () => ({
  verifyStripeWebhookSignature: vi.fn(),
  parseStripeWebhookEvent: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentByStripeSessionId: vi.fn(),
  insertStripeWebhookEvent: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
  tryTransitionAppointmentByStripeSessionId: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));

vi.mock("./modules/scheduling/repo", () => ({
  releaseHeldSlotByAppointmentId: vi.fn(),
}));

vi.mock("./workflows/appointmentPayments/publicApi", () => ({
  settleStripePaymentBySessionId: vi.fn(),
}));

vi.mock("./modules/referrals/repo", () => ({
  getReferralOrderByPaymentSessionId: vi.fn(),
  getReferralOrderByProviderReference: vi.fn(),
  markOrderPaymentFailed: vi.fn(),
  insertOperation: vi.fn(),
}));

vi.mock("./modules/referrals/paymentSettlement", () => ({
  settleReferralPaymentTransition: vi.fn(),
  publishReferralPaymentSettlement: vi.fn(),
}));

vi.mock("./modules/referrals/refunds", () => ({
  finalizeReferralRefund: vi.fn(),
}));

import {
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./modules/payments/stripe";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import * as referralRepo from "./modules/referrals/repo";
import {
  publishReferralPaymentSettlement,
  settleReferralPaymentTransition,
} from "./modules/referrals/paymentSettlement";
import { clearMetricsForTests, getMetricsSnapshot } from "./_core/metrics";
import { handleStripeWebhook } from "./stripeWebhookRoute";

function createReqRes(rawPayload: string) {
  const req = {
    body: Buffer.from(rawPayload, "utf8"),
    headers: {
      "stripe-signature": "t=123,v1=sig",
      "x-request-id": "request-stripe-webhook",
    },
  } as never;

  const resPayload: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      resPayload.status = code;
      return this;
    },
    setHeader() {
      return this;
    },
    send(body: string) {
      resPayload.body = JSON.parse(body);
      return this;
    },
  } as never;

  return { req, res, resPayload };
}

describe("stripeWebhookRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetricsForTests();
    vi.mocked(verifyStripeWebhookSignature).mockImplementation(() => undefined);
    vi.mocked(getDb).mockResolvedValue({
      transaction: async (fn: (tx: object) => Promise<void>) => {
        await fn({});
      },
    } as never);
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockResolvedValue(
      undefined as never
    );
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue(null as never);
    vi.mocked(
      referralRepo.getReferralOrderByProviderReference
    ).mockResolvedValue(null as never);
    vi.mocked(referralRepo.markOrderPaymentFailed).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(settleReferralPaymentTransition).mockResolvedValue({
      orderId: 701,
      alreadySettled: false,
    });
  });

  it("refund webhook marks refunded and revokes appointment tokens", async () => {
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt_ref_1",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_1",
          metadata: {
            appointmentId: "123",
          },
        },
      },
    } as never);

    const { req, res, resPayload } = createReqRes('{"id":"evt_ref_1"}');
    await handleStripeWebhook(req, res);

    expect(verifyStripeWebhookSignature).toHaveBeenCalled();
    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 123,
        toStatus: "refunded",
        toPaymentStatus: "refunded",
      })
    );
    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 123,
        reason: "payment_refunded",
      })
    );
    expect(resPayload.status).toBe(200);
    expect(resPayload.body).toMatchObject({ ok: true });
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "stripe_webhook_processed_total{result=ok}",
          value: 1,
        }),
      ])
    );
  });

  it("signature failure records classified failure metric", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(verifyStripeWebhookSignature).mockImplementation(() => {
      throw new Error(
        "Missing Stripe-Signature header token=must-not-appear-in-log"
      );
    });

    const { req, res, resPayload } = createReqRes('{"id":"evt_bad_sig"}');
    await handleStripeWebhook(req, res);

    expect(resPayload.status).toBe(400);
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "stripe_webhook_failure_total{type=signature_invalid}",
          value: 1,
        }),
      ])
    );
    const log = JSON.parse(String(consoleError.mock.calls.at(-1)?.[0]));
    expect(log).toMatchObject({
      component: "stripe-webhook",
      event: "processing_failed",
      requestId: "request-stripe-webhook",
      failureType: "signature_invalid",
      errorName: "Error",
    });
    expect(JSON.stringify(log)).not.toContain("must-not-appear-in-log");
    consoleError.mockRestore();
  });

  it("duplicate webhook event increments duplicate metric and returns ok", async () => {
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt_dup_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_dup_1",
          metadata: {
            appointmentId: "123",
            stripeSessionId: "cs_dup_1",
          },
        },
      },
    } as never);
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue({
      code: "ER_DUP_ENTRY",
    } as never);

    const { req, res, resPayload } = createReqRes('{"id":"evt_dup_1"}');
    await handleStripeWebhook(req, res);

    expect(resPayload.status).toBe(200);
    expect(resPayload.body).toMatchObject({ ok: true });
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "stripe_webhook_duplicate_total",
          value: 1,
        }),
      ])
    );
  });

  it("settles a paid referral checkout and can reconcile it on a duplicate event", async () => {
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt_referral_paid_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_referral_paid_1",
          payment_status: "paid",
          payment_intent: "pi_referral_paid_1",
          metadata: {
            resourceType: "referral_order",
            resourceId: "701",
          },
        },
      },
    } as never);
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue({
      id: 701,
    } as never);
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue({
      code: "ER_DUP_ENTRY",
    } as never);

    const { req, res, resPayload } = createReqRes(
      '{"id":"evt_referral_paid_1"}'
    );
    await handleStripeWebhook(req, res);

    expect(settleReferralPaymentTransition).toHaveBeenCalledWith({
      paymentSessionId: "cs_referral_paid_1",
      paymentProviderTransactionId: "pi_referral_paid_1",
      actorType: "webhook",
      reason: "stripe_webhook_paid",
    });
    expect(publishReferralPaymentSettlement).toHaveBeenCalledWith(701);
    expect(resPayload.status).toBe(200);
  });

  it("does not settle a referral checkout until Stripe reports it paid", async () => {
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt_referral_unpaid_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_referral_unpaid_1",
          payment_status: "unpaid",
          metadata: {
            resourceType: "referral_order",
            resourceId: "702",
          },
        },
      },
    } as never);

    const { req, res, resPayload } = createReqRes(
      '{"id":"evt_referral_unpaid_1"}'
    );
    await handleStripeWebhook(req, res);

    expect(settleReferralPaymentTransition).not.toHaveBeenCalled();
    expect(resPayload.status).toBe(200);
  });

  it("marks a referral payment failed using generic resource metadata", async () => {
    vi.mocked(parseStripeWebhookEvent).mockReturnValue({
      id: "evt_referral_failed_1",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: "pi_referral_failed_1",
          metadata: {
            resourceType: "referral_order",
            resourceId: "703",
          },
        },
      },
    } as never);

    const { req, res, resPayload } = createReqRes(
      '{"id":"evt_referral_failed_1"}'
    );
    await handleStripeWebhook(req, res);

    expect(referralRepo.markOrderPaymentFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 703,
        reason: "payment_intent_failed",
        actorType: "webhook",
      })
    );
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 703,
        actionType: "payment_failed",
      })
    );
    expect(resPayload.status).toBe(200);
  });
});
