import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/referrals/repo", () => ({
  getReferralOrderByPaymentSessionId: vi.fn(),
  getReferralOrderByProviderReference: vi.fn(),
}));

import * as referralRepo from "./modules/referrals/repo";
import { buildStripeWebhookContext } from "./stripeWebhookContext";

function event(type: string, object: Record<string, unknown>) {
  return { id: "evt-1", type, data: { object } } as never;
}

describe("Stripe webhook context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue(null as never);
    vi.mocked(
      referralRepo.getReferralOrderByProviderReference
    ).mockResolvedValue(null as never);
  });

  it.each([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.expired",
  ])("uses the direct checkout session id for %s", async type => {
    const context = await buildStripeWebhookContext(
      event(type, {
        id: " cs-direct ",
        metadata: {
          stripeSessionId: "cs-metadata",
          resourceType: "appointment",
          resourceId: "41",
        },
      })
    );
    expect(context).toMatchObject({
      stripeSessionId: "cs-direct",
      metadataResourceType: "appointment",
      metadataResourceId: 41,
      appointmentIdFromMetadata: 41,
      isReferralCheckout: false,
    });
    expect(
      referralRepo.getReferralOrderByPaymentSessionId
    ).not.toHaveBeenCalled();
  });

  it("uses metadata then nested session identifiers for non-checkout events", async () => {
    await expect(
      buildStripeWebhookContext(
        event("payment_intent.payment_failed", {
          id: "pi-1",
          checkout_session: "cs-nested",
          metadata: { stripeSessionId: " cs-metadata ", appointmentId: "42" },
        })
      )
    ).resolves.toMatchObject({ stripeSessionId: "cs-metadata" });

    await expect(
      buildStripeWebhookContext(
        event("payment_intent.payment_failed", {
          checkout_session: " cs-nested ",
          metadata: { appointmentId: "42" },
        })
      )
    ).resolves.toMatchObject({ stripeSessionId: "cs-nested" });
  });

  it("recognizes paid referral checkout settlement by metadata", async () => {
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue({
      id: 701,
    } as never);
    const context = await buildStripeWebhookContext(
      event("checkout.session.completed", {
        id: "cs-referral",
        payment_status: "PAID",
        payment_intent: " pi-referral ",
        metadata: { resourceType: "referral_order", resourceId: "701" },
      })
    );
    expect(context).toMatchObject({
      isReferralCheckout: true,
      referralOrderBySession: { id: 701 },
      referralReconciliation: {
        settlement: {
          paymentSessionId: "cs-referral",
          paymentProviderTransactionId: "pi-referral",
        },
      },
    });
  });

  it("can infer a referral from session lookup without referral metadata", async () => {
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue({
      id: 702,
    } as never);
    const context = await buildStripeWebhookContext(
      event("checkout.session.async_payment_succeeded", {
        id: "cs-referral",
        payment_status: "paid",
      })
    );
    expect(context.isReferralCheckout).toBe(true);
    expect(context.referralReconciliation.settlement).toEqual({
      paymentSessionId: "cs-referral",
      paymentProviderTransactionId: null,
    });
  });

  it("does not reconcile an unpaid referral checkout", async () => {
    const context = await buildStripeWebhookContext(
      event("checkout.session.completed", {
        id: "cs-referral",
        payment_status: "unpaid",
        metadata: { resourceType: "referral_order", resourceId: "bad" },
      })
    );
    expect(context).toMatchObject({
      metadataResourceId: null,
      appointmentIdFromMetadata: null,
      isReferralCheckout: true,
      referralReconciliation: {},
    });
  });

  it("maps a charge refund to a referral reconciliation", async () => {
    vi.mocked(
      referralRepo.getReferralOrderByProviderReference
    ).mockResolvedValue({
      id: 703,
    } as never);
    const context = await buildStripeWebhookContext(
      event("charge.refunded", {
        id: "ch-1",
        payment_intent: "pi-1",
        refunds: { data: [{ id: " re-1 " }] },
      })
    );
    expect(
      referralRepo.getReferralOrderByProviderReference
    ).toHaveBeenCalledWith({
      providerRefundId: "re-1",
      providerTransactionId: "pi-1",
    });
    expect(context).toMatchObject({
      isRefundEvent: true,
      providerRefundId: "re-1",
      referralReconciliation: {
        refund: { orderId: 703, providerRefundId: "re-1" },
      },
    });
  });

  it.each(["succeeded", "successful"])(
    "accepts refund.updated status %s",
    async status => {
      const context = await buildStripeWebhookContext(
        event("refund.updated", { id: " re-2 ", status })
      );
      expect(context).toMatchObject({
        isRefundEvent: true,
        providerRefundId: "re-2",
      });
    }
  );

  it("ignores pending or malformed refund data", async () => {
    const context = await buildStripeWebhookContext(
      event("refund.updated", {
        id: 4,
        status: "pending",
        refunds: { data: [null] },
        metadata: "invalid",
      })
    );
    expect(context).toMatchObject({
      stripeSessionId: null,
      metadataResourceType: null,
      providerRefundId: null,
      isRefundEvent: false,
      referralReconciliation: {},
    });
    expect(
      referralRepo.getReferralOrderByProviderReference
    ).not.toHaveBeenCalled();
  });
});
