import type { parseStripeWebhookEvent } from "./modules/payments/stripe";
import * as referralRepo from "./modules/referrals/repo";

type StripeWebhookEvent = ReturnType<typeof parseStripeWebhookEvent>;

export async function buildStripeWebhookContext(event: StripeWebhookEvent) {
  const object = event.data.object;
  const directObjectId =
    typeof object.id === "string" && object.id.trim().length > 0
      ? object.id.trim()
      : null;
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? (object.metadata as Record<string, unknown>)
      : {};
  const metadataStripeSessionId =
    typeof metadata.stripeSessionId === "string"
      ? metadata.stripeSessionId.trim()
      : null;
  const nestedCheckoutSessionId =
    typeof object.checkout_session === "string"
      ? object.checkout_session.trim()
      : null;
  const stripeSessionId =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.expired"
      ? directObjectId
      : metadataStripeSessionId || nestedCheckoutSessionId;
  const metadataResourceType =
    typeof metadata.resourceType === "string"
      ? metadata.resourceType.trim()
      : null;
  const metadataResourceIdRaw = Number(metadata.resourceId ?? NaN);
  const metadataResourceId =
    Number.isInteger(metadataResourceIdRaw) && metadataResourceIdRaw > 0
      ? metadataResourceIdRaw
      : null;
  const metadataAppointmentId = Number(
    metadata.appointmentId ??
      (metadataResourceType === "appointment" ? metadataResourceId : NaN)
  );
  const appointmentIdFromMetadata =
    Number.isInteger(metadataAppointmentId) && metadataAppointmentId > 0
      ? metadataAppointmentId
      : null;
  const paymentIntentId =
    typeof object.payment_intent === "string"
      ? object.payment_intent.trim()
      : null;
  const nestedRefunds =
    object.refunds &&
    typeof object.refunds === "object" &&
    Array.isArray((object.refunds as { data?: unknown }).data)
      ? (object.refunds as { data: unknown[] }).data
      : [];
  const chargeRefundId =
    nestedRefunds.length > 0 &&
    nestedRefunds[0] &&
    typeof nestedRefunds[0] === "object" &&
    typeof (nestedRefunds[0] as { id?: unknown }).id === "string"
      ? String((nestedRefunds[0] as { id: string }).id).trim()
      : null;
  const providerRefundId =
    event.type === "refund.updated" ? directObjectId : chargeRefundId;
  const isRefundEvent =
    event.type === "charge.refunded" ||
    (event.type === "refund.updated" &&
      (String(object.status ?? "").toLowerCase() === "succeeded" ||
        String(object.status ?? "").toLowerCase() === "successful"));
  const referralOrderBySession = stripeSessionId
    ? metadataResourceType === "referral_order" ||
      appointmentIdFromMetadata === null
      ? await referralRepo.getReferralOrderByPaymentSessionId(stripeSessionId)
      : null
    : null;
  const referralOrderByRefund = isRefundEvent
    ? await referralRepo.getReferralOrderByProviderReference({
        providerRefundId,
        providerTransactionId: paymentIntentId,
      })
    : null;
  const isReferralCheckout =
    metadataResourceType === "referral_order" ||
    Boolean(referralOrderBySession);
  const referralReconciliation: {
    settlement?: {
      paymentSessionId: string;
      paymentProviderTransactionId: string | null;
    };
    refund?: {
      orderId: number;
      providerRefundId: string;
    };
  } = {};
  const checkoutPaymentSucceeded =
    String(object.payment_status ?? "").toLowerCase() === "paid";

  if (
    (event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded") &&
    stripeSessionId &&
    isReferralCheckout &&
    checkoutPaymentSucceeded
  ) {
    referralReconciliation.settlement = {
      paymentSessionId: stripeSessionId,
      paymentProviderTransactionId: paymentIntentId,
    };
  }
  if (isRefundEvent && referralOrderByRefund && providerRefundId) {
    referralReconciliation.refund = {
      orderId: referralOrderByRefund.id,
      providerRefundId,
    };
  }

  return {
    stripeSessionId,
    metadataResourceType,
    metadataResourceId,
    appointmentIdFromMetadata,
    referralOrderBySession,
    referralOrderByRefund,
    isReferralCheckout,
    isRefundEvent,
    providerRefundId,
    referralReconciliation,
  };
}

export type StripeWebhookContext = Awaited<
  ReturnType<typeof buildStripeWebhookContext>
>;
