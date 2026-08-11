import type { getDb } from "./db";
import { isDuplicateDbError } from "./_core/dbCompat";
import { incrementMetric } from "./_core/metrics";
import * as appointmentsRepo from "./modules/appointments/repo";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./modules/appointments/stateMachine";
import type { parseStripeWebhookEvent } from "./modules/payments/stripe";
import {
  publishReferralPaymentSettlement,
  settleReferralPaymentTransition,
} from "./modules/referrals/paymentSettlement";
import { finalizeReferralRefund } from "./modules/referrals/refunds";
import * as referralRepo from "./modules/referrals/repo";
import * as schedulingRepo from "./modules/scheduling/repo";
import type { StripeWebhookContext } from "./stripeWebhookContext";
import { settleStripePaymentBySessionId } from "./workflows/appointmentPayments/publicApi";

type StripeWebhookEvent = ReturnType<typeof parseStripeWebhookEvent>;
type StripeWebhookDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function processStripeWebhookEvent(input: {
  db: StripeWebhookDb;
  event: StripeWebhookEvent;
  context: StripeWebhookContext;
  payloadHash: string;
}) {
  const { context, event } = input;
  let duplicatedEvent = false;

  await input.db.transaction(async tx => {
    let appointmentId: number | null = context.appointmentIdFromMetadata;
    if (context.stripeSessionId && !context.isReferralCheckout) {
      const appointment =
        await appointmentsRepo.getAppointmentByStripeSessionId(
          context.stripeSessionId,
          tx
        );
      appointmentId = appointment?.id ?? null;
    }

    try {
      await appointmentsRepo.insertStripeWebhookEvent({
        eventId: event.id,
        type: event.type,
        provider: "stripe",
        stripeSessionId: context.stripeSessionId,
        appointmentId,
        resourceType: context.isReferralCheckout
          ? "referral_order"
          : context.metadataResourceType,
        resourceId: context.isReferralCheckout
          ? (context.referralOrderBySession?.id ?? context.metadataResourceId)
          : context.metadataResourceId,
        payloadHash: input.payloadHash,
        dbExecutor: tx,
      });
    } catch (error) {
      if (isDuplicateDbError(error)) {
        duplicatedEvent = true;
        incrementMetric("stripe_webhook_duplicate_total");
        return;
      }
      throw error;
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      if (context.isReferralCheckout) {
        return;
      }
      await settleStripePaymentBySessionId({
        stripeSessionId: context.stripeSessionId!,
        source: "webhook",
        eventId: event.id,
        dbExecutor: tx,
      });
      return;
    }

    if (event.type === "checkout.session.expired" && context.stripeSessionId) {
      if (
        context.isReferralCheckout &&
        (context.referralOrderBySession?.id ?? context.metadataResourceId)
      ) {
        const orderId = (context.referralOrderBySession?.id ??
          context.metadataResourceId)!;
        const failed = await referralRepo.markOrderPaymentFailed({
          orderId,
          reason: "checkout_session_expired",
          actorType: "webhook",
          dbExecutor: tx,
        });
        if (failed.ok) {
          await referralRepo.insertOperation({
            orderId,
            operatorType: "webhook",
            actionType: "payment_failed",
            actionPayload: {
              eventId: event.id,
              eventType: event.type,
            },
            dbExecutor: tx,
          });
        }
        return;
      }
      const expired =
        await appointmentsRepo.tryTransitionAppointmentByStripeSessionId({
          stripeSessionId: context.stripeSessionId,
          allowedFrom: ["pending_payment"],
          toStatus: "expired",
          toPaymentStatus: "expired",
          operatorType: "webhook",
          reason: "checkout_session_expired",
          payloadJson: { eventId: event.id },
          dbExecutor: tx,
        });
      if (expired.ok) {
        const appointment =
          await appointmentsRepo.getAppointmentByStripeSessionId(
            context.stripeSessionId,
            tx
          );
        if (appointment) {
          await schedulingRepo.releaseHeldSlotByAppointmentId({
            appointmentId: appointment.id,
            dbExecutor: tx,
          });
        }
      }
      return;
    }

    if (
      event.type === "payment_intent.payment_failed" &&
      (context.stripeSessionId || appointmentId || context.isReferralCheckout)
    ) {
      if (context.isReferralCheckout && context.metadataResourceId) {
        const failed = await referralRepo.markOrderPaymentFailed({
          orderId: context.metadataResourceId,
          reason: "payment_intent_failed",
          actorType: "webhook",
          dbExecutor: tx,
        });
        if (failed.ok) {
          await referralRepo.insertOperation({
            orderId: context.metadataResourceId,
            operatorType: "webhook",
            actionType: "payment_failed",
            actionPayload: {
              eventId: event.id,
              eventType: event.type,
            },
            dbExecutor: tx,
          });
        }
        return;
      }
      const failed = context.stripeSessionId
        ? await appointmentsRepo.tryTransitionAppointmentByStripeSessionId({
            stripeSessionId: context.stripeSessionId,
            allowedFrom: ["pending_payment"],
            toStatus: "canceled",
            toPaymentStatus: "failed",
            operatorType: "webhook",
            reason: "payment_failed",
            payloadJson: { eventId: event.id },
            dbExecutor: tx,
          })
        : await appointmentsRepo.tryTransitionAppointmentById({
            appointmentId: appointmentId!,
            allowedFrom: ["pending_payment"],
            toStatus: "canceled",
            toPaymentStatus: "failed",
            operatorType: "webhook",
            reason: "payment_failed",
            payloadJson: { eventId: event.id },
            dbExecutor: tx,
          });
      if (failed.ok) {
        const appointment = context.stripeSessionId
          ? await appointmentsRepo.getAppointmentByStripeSessionId(
              context.stripeSessionId,
              tx
            )
          : { id: appointmentId! };
        if (appointment) {
          await schedulingRepo.releaseHeldSlotByAppointmentId({
            appointmentId: appointment.id,
            dbExecutor: tx,
          });
        }
      }
      return;
    }

    if (
      context.isRefundEvent &&
      context.referralOrderByRefund &&
      context.providerRefundId
    ) {
      return;
    }
    if (context.isRefundEvent && (context.stripeSessionId || appointmentId)) {
      const targetAppointment =
        appointmentId ??
        (
          await appointmentsRepo.getAppointmentByStripeSessionId(
            context.stripeSessionId!,
            tx
          )
        )?.id ??
        null;
      if (!targetAppointment) {
        return;
      }

      const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
        appointmentId: targetAppointment,
        allowedFrom: ["paid", "active", "ended", "completed"],
        toStatus: "refunded",
        toPaymentStatus: "refunded",
        operatorType: "webhook",
        reason: "payment_refunded",
        payloadJson: {
          stripeSessionId: context.stripeSessionId ?? null,
          eventId: event.id,
          eventType: event.type,
        },
        dbExecutor: tx,
      });
      if (!transitioned.ok && transitioned.reason === "illegal_transition") {
        throw new Error(APPOINTMENT_INVALID_TRANSITION_ERROR);
      }
      await appointmentsRepo.revokeAppointmentTokens({
        appointmentId: targetAppointment,
        reason: "payment_refunded",
        dbExecutor: tx,
      });
    }
  });

  if (context.referralReconciliation.settlement) {
    const settlement = await settleReferralPaymentTransition({
      paymentSessionId:
        context.referralReconciliation.settlement.paymentSessionId,
      paymentProviderTransactionId:
        context.referralReconciliation.settlement.paymentProviderTransactionId,
      actorType: "webhook",
      reason: "stripe_webhook_paid",
    });
    await publishReferralPaymentSettlement(settlement.orderId);
  }
  if (context.referralReconciliation.refund) {
    await finalizeReferralRefund({
      orderId: context.referralReconciliation.refund.orderId,
      providerRefundId: context.referralReconciliation.refund.providerRefundId,
      actorType: "webhook",
      reason: "stripe_refund_webhook_succeeded",
    });
  }

  return { duplicatedEvent };
}
