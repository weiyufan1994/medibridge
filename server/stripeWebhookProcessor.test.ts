import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { clearMetricsForTests, getMetricsSnapshot } from "./_core/metrics";
import * as appointmentsRepo from "./modules/appointments/repo";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./modules/appointments/stateMachine";
import {
  publishReferralPaymentSettlement,
  settleReferralPaymentTransition,
} from "./modules/referrals/paymentSettlement";
import { finalizeReferralRefund } from "./modules/referrals/refunds";
import * as referralRepo from "./modules/referrals/repo";
import * as schedulingRepo from "./modules/scheduling/repo";
import { processStripeWebhookEvent } from "./stripeWebhookProcessor";
import { settleStripePaymentBySessionId } from "./workflows/appointmentPayments/publicApi";

function db() {
  const tx = { tx: true };
  return {
    tx,
    value: {
      transaction: async (callback: (executor: unknown) => Promise<void>) =>
        callback(tx),
    } as never,
  };
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    stripeSessionId: "cs-1",
    metadataResourceType: "appointment",
    metadataResourceId: 41,
    appointmentIdFromMetadata: 41,
    referralOrderBySession: null,
    referralOrderByRefund: null,
    isReferralCheckout: false,
    isRefundEvent: false,
    providerRefundId: null,
    referralReconciliation: {},
    ...overrides,
  } as never;
}

function event(type: string) {
  return { id: `evt-${type}`, type, data: { object: {} } } as never;
}

async function process(type: string, overrides: Record<string, unknown> = {}) {
  const database = db();
  const result = await processStripeWebhookEvent({
    db: database.value,
    event: event(type),
    context: context(overrides),
    payloadHash: "payload-hash",
  });
  return { result, tx: database.tx };
}

describe("Stripe webhook transaction processor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMetricsForTests();
    vi.mocked(
      appointmentsRepo.getAppointmentByStripeSessionId
    ).mockResolvedValue({
      id: 41,
    } as never);
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockResolvedValue(
      undefined as never
    );
    vi.mocked(
      appointmentsRepo.tryTransitionAppointmentByStripeSessionId
    ).mockResolvedValue({ ok: true, reason: "updated" } as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(referralRepo.markOrderPaymentFailed).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    vi.mocked(settleReferralPaymentTransition).mockResolvedValue({
      orderId: 701,
      alreadySettled: false,
    });
  });

  it.each([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
  ])("records and settles appointment event %s", async type => {
    const { tx } = await process(type);
    expect(appointmentsRepo.insertStripeWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: `evt-${type}`,
        appointmentId: 41,
        resourceType: "appointment",
        resourceId: 41,
        dbExecutor: tx,
      })
    );
    expect(settleStripePaymentBySessionId).toHaveBeenCalledWith({
      stripeSessionId: "cs-1",
      source: "webhook",
      eventId: `evt-${type}`,
      dbExecutor: tx,
    });
  });

  it("treats duplicate insertion as idempotent and skips mutations", async () => {
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue({
      code: "ER_DUP_ENTRY",
    } as never);
    const { result } = await process("checkout.session.completed");
    expect(result).toEqual({ duplicatedEvent: true });
    expect(settleStripePaymentBySessionId).not.toHaveBeenCalled();
    expect(getMetricsSnapshot()).toContainEqual(
      expect.objectContaining({
        key: "stripe_webhook_duplicate_total",
        value: 1,
      })
    );
  });

  it("propagates non-duplicate persistence errors", async () => {
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockRejectedValue(
      new Error("write failed")
    );
    await expect(process("checkout.session.completed")).rejects.toThrow(
      "write failed"
    );
  });

  it("publishes referral settlement outside the transaction", async () => {
    await process("checkout.session.completed", {
      isReferralCheckout: true,
      referralOrderBySession: { id: 701 },
      referralReconciliation: {
        settlement: {
          paymentSessionId: "cs-referral",
          paymentProviderTransactionId: "pi-referral",
        },
      },
    });
    expect(settleStripePaymentBySessionId).not.toHaveBeenCalled();
    expect(settleReferralPaymentTransition).toHaveBeenCalledWith({
      paymentSessionId: "cs-referral",
      paymentProviderTransactionId: "pi-referral",
      actorType: "webhook",
      reason: "stripe_webhook_paid",
    });
    expect(publishReferralPaymentSettlement).toHaveBeenCalledWith(701);
  });

  it("marks referral checkout expiry and records an operation", async () => {
    const { tx } = await process("checkout.session.expired", {
      isReferralCheckout: true,
      referralOrderBySession: { id: 702 },
    });
    expect(referralRepo.markOrderPaymentFailed).toHaveBeenCalledWith({
      orderId: 702,
      reason: "checkout_session_expired",
      actorType: "webhook",
      dbExecutor: tx,
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 702, actionType: "payment_failed" })
    );
  });

  it("does not record referral operation when expiry transition is unchanged", async () => {
    vi.mocked(referralRepo.markOrderPaymentFailed).mockResolvedValue({
      ok: false,
      reason: "already_failed",
    } as never);
    await process("checkout.session.expired", {
      isReferralCheckout: true,
      referralOrderBySession: null,
      metadataResourceId: 702,
    });
    expect(referralRepo.insertOperation).not.toHaveBeenCalled();
  });

  it("expires an appointment and releases its held slot", async () => {
    const { tx } = await process("checkout.session.expired");
    expect(
      appointmentsRepo.tryTransitionAppointmentByStripeSessionId
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeSessionId: "cs-1",
        toStatus: "expired",
        toPaymentStatus: "expired",
      })
    );
    expect(schedulingRepo.releaseHeldSlotByAppointmentId).toHaveBeenCalledWith({
      appointmentId: 41,
      dbExecutor: tx,
    });
  });

  it("does not release a slot when expiry transition loses a race", async () => {
    vi.mocked(
      appointmentsRepo.tryTransitionAppointmentByStripeSessionId
    ).mockResolvedValue({ ok: false, reason: "conflict" } as never);
    await process("checkout.session.expired");
    expect(
      schedulingRepo.releaseHeldSlotByAppointmentId
    ).not.toHaveBeenCalled();
  });

  it("marks referral payment-intent failure", async () => {
    await process("payment_intent.payment_failed", {
      isReferralCheckout: true,
      metadataResourceId: 703,
    });
    expect(referralRepo.markOrderPaymentFailed).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 703, reason: "payment_intent_failed" })
    );
    expect(referralRepo.insertOperation).toHaveBeenCalled();
  });

  it("fails appointments by session or metadata id and releases slots", async () => {
    await process("payment_intent.payment_failed");
    expect(
      appointmentsRepo.tryTransitionAppointmentByStripeSessionId
    ).toHaveBeenCalled();
    expect(schedulingRepo.releaseHeldSlotByAppointmentId).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 41 })
    );

    vi.clearAllMocks();
    vi.mocked(appointmentsRepo.insertStripeWebhookEvent).mockResolvedValue(
      undefined as never
    );
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);
    await process("payment_intent.payment_failed", {
      stripeSessionId: null,
      appointmentIdFromMetadata: 44,
    });
    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 44, toPaymentStatus: "failed" })
    );
    expect(schedulingRepo.releaseHeldSlotByAppointmentId).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: 44 })
    );
  });

  it("finalizes referral refunds without mutating appointments", async () => {
    await process("charge.refunded", {
      isRefundEvent: true,
      referralOrderByRefund: { id: 704 },
      providerRefundId: "re-704",
      referralReconciliation: {
        refund: { orderId: 704, providerRefundId: "re-704" },
      },
    });
    expect(
      appointmentsRepo.tryTransitionAppointmentById
    ).not.toHaveBeenCalled();
    expect(finalizeReferralRefund).toHaveBeenCalledWith({
      orderId: 704,
      providerRefundId: "re-704",
      actorType: "webhook",
      reason: "stripe_refund_webhook_succeeded",
    });
  });

  it("refunds appointments and revokes active tokens", async () => {
    const { tx } = await process("charge.refunded", { isRefundEvent: true });
    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 41,
        toStatus: "refunded",
        toPaymentStatus: "refunded",
      })
    );
    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith({
      appointmentId: 41,
      reason: "payment_refunded",
      dbExecutor: tx,
    });
  });

  it("rejects illegal refund transitions", async () => {
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: false,
      reason: "illegal_transition",
    } as never);
    await expect(
      process("charge.refunded", { isRefundEvent: true })
    ).rejects.toThrow(APPOINTMENT_INVALID_TRANSITION_ERROR);
    expect(appointmentsRepo.revokeAppointmentTokens).not.toHaveBeenCalled();
  });

  it("ignores an unresolvable appointment refund", async () => {
    vi.mocked(
      appointmentsRepo.getAppointmentByStripeSessionId
    ).mockResolvedValue(null as never);
    await process("charge.refunded", {
      isRefundEvent: true,
      appointmentIdFromMetadata: null,
    });
    expect(
      appointmentsRepo.tryTransitionAppointmentById
    ).not.toHaveBeenCalled();
    expect(appointmentsRepo.revokeAppointmentTokens).not.toHaveBeenCalled();
  });
});
