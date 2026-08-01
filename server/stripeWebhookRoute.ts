import type { Request, Response } from "express";
import crypto from "crypto";
import {
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./modules/payments/stripe";
import { settleStripePaymentBySessionId } from "./modules/payments/settlement";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import * as schedulingRepo from "./modules/scheduling/repo";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./modules/appointments/stateMachine";
import { incrementMetric } from "./_core/metrics";
import { isDuplicateDbError } from "./_core/dbCompat";
import * as referralRepo from "./modules/referrals/repo";
import {
  publishReferralPaymentSettlement,
  settleReferralPaymentTransition,
} from "./modules/referrals/paymentSettlement";
import { finalizeReferralRefund } from "./modules/referrals/refunds";

function sendJson(
  res: Response,
  status: number,
  payload: Record<string, unknown>
) {
  res.status(status).setHeader("content-type", "application/json");
  res.send(JSON.stringify(payload));
}

async function recordStripeWebhookFailure(input: {
  type: string;
  stripeSessionId?: string | null;
  payloadHash?: string | null;
  error: string;
}) {
  incrementMetric("stripe_webhook_failure_total", {
    type: input.type,
  });
  try {
    const db = await getDb();
    if (!db) {
      return;
    }
    const eventId = `failed_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    await appointmentsRepo.insertStripeWebhookEvent({
      eventId,
      type: input.type.slice(0, 100),
      provider: "stripe",
      stripeSessionId: input.stripeSessionId ?? null,
      appointmentId: null,
      payloadHash: input.payloadHash ?? null,
      dbExecutor: db,
    });
  } catch (error) {
    console.warn(
      "[StripeWebhook] failed to persist webhook failure audit:",
      error
    );
  }
}

function classifyWebhookError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();
  if (message.includes("stripe-signature")) {
    return "signature_invalid";
  }
  if (message.includes("signature")) {
    return "signature_verification_failed";
  }
  if (message.includes("missing session id")) {
    return "missing_session_id";
  }
  if (message.includes("malformed stripe webhook event")) {
    return "malformed_event";
  }
  if (message.includes("database not available")) {
    return "db_unavailable";
  }
  return "processing_error";
}

export async function handleStripeWebhook(req: Request, res: Response) {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "", "utf8");

    verifyStripeWebhookSignature({
      rawBody,
      signatureHeader:
        typeof req.headers["stripe-signature"] === "string"
          ? req.headers["stripe-signature"]
          : undefined,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const event = parseStripeWebhookEvent(rawBody);
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

    if (
      (event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded") &&
      !stripeSessionId
    ) {
      await recordStripeWebhookFailure({
        type: "webhook_error_missing_session_id",
        stripeSessionId: null,
        payloadHash: crypto.createHash("sha256").update(rawBody).digest("hex"),
        error: "checkout.session.completed missing session id",
      });
      return sendJson(res, 400, {
        ok: false,
        error: "checkout.session.completed missing session id",
      });
    }

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    let duplicatedEvent = false;
    const payloadHash = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex");

    await db.transaction(async tx => {
      let appointmentId: number | null = appointmentIdFromMetadata;
      if (stripeSessionId && !isReferralCheckout) {
        const appointment =
          await appointmentsRepo.getAppointmentByStripeSessionId(
            stripeSessionId,
            tx
          );
        appointmentId = appointment?.id ?? null;
      }

      try {
        await appointmentsRepo.insertStripeWebhookEvent({
          eventId: event.id,
          type: event.type,
          provider: "stripe",
          stripeSessionId,
          appointmentId,
          resourceType: isReferralCheckout
            ? "referral_order"
            : metadataResourceType,
          resourceId: isReferralCheckout
            ? (referralOrderBySession?.id ?? metadataResourceId)
            : metadataResourceId,
          payloadHash,
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
        if (isReferralCheckout) {
          return;
        }
        await settleStripePaymentBySessionId({
          stripeSessionId: stripeSessionId!,
          source: "webhook",
          eventId: event.id,
          req,
          dbExecutor: tx,
        });
        return;
      }

      if (event.type === "checkout.session.expired" && stripeSessionId) {
        if (
          isReferralCheckout &&
          (referralOrderBySession?.id ?? metadataResourceId)
        ) {
          const failed = await referralRepo.markOrderPaymentFailed({
            orderId: (referralOrderBySession?.id ?? metadataResourceId)!,
            reason: "checkout_session_expired",
            actorType: "webhook",
            dbExecutor: tx,
          });
          if (failed.ok) {
            await referralRepo.insertOperation({
              orderId: (referralOrderBySession?.id ?? metadataResourceId)!,
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
            stripeSessionId,
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
              stripeSessionId,
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
        (stripeSessionId || appointmentId || isReferralCheckout)
      ) {
        if (isReferralCheckout && metadataResourceId) {
          const failed = await referralRepo.markOrderPaymentFailed({
            orderId: metadataResourceId,
            reason: "payment_intent_failed",
            actorType: "webhook",
            dbExecutor: tx,
          });
          if (failed.ok) {
            await referralRepo.insertOperation({
              orderId: metadataResourceId,
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
        const failed = stripeSessionId
          ? await appointmentsRepo.tryTransitionAppointmentByStripeSessionId({
              stripeSessionId,
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
          const appointment = stripeSessionId
            ? await appointmentsRepo.getAppointmentByStripeSessionId(
                stripeSessionId,
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

      if (isRefundEvent && referralOrderByRefund && providerRefundId) {
        return;
      }
      if (isRefundEvent && (stripeSessionId || appointmentId)) {
        const targetAppointment =
          appointmentId ??
          (
            await appointmentsRepo.getAppointmentByStripeSessionId(
              stripeSessionId!,
              tx
            )
          )?.id ??
          null;
        if (!targetAppointment) {
          return;
        }

        const transitioned =
          await appointmentsRepo.tryTransitionAppointmentById({
            appointmentId: targetAppointment,
            allowedFrom: ["paid", "active", "ended", "completed"],
            toStatus: "refunded",
            toPaymentStatus: "refunded",
            operatorType: "webhook",
            reason: "payment_refunded",
            payloadJson: {
              stripeSessionId: stripeSessionId ?? null,
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

    if (referralReconciliation.settlement) {
      const settlement = await settleReferralPaymentTransition({
        paymentSessionId: referralReconciliation.settlement.paymentSessionId,
        paymentProviderTransactionId:
          referralReconciliation.settlement.paymentProviderTransactionId,
        actorType: "webhook",
        reason: "stripe_webhook_paid",
      });
      await publishReferralPaymentSettlement(settlement.orderId);
    }
    if (referralReconciliation.refund) {
      await finalizeReferralRefund({
        orderId: referralReconciliation.refund.orderId,
        providerRefundId: referralReconciliation.refund.providerRefundId,
        actorType: "webhook",
        reason: "stripe_refund_webhook_succeeded",
      });
    }

    if (duplicatedEvent) {
      return sendJson(res, 200, { ok: true });
    }

    incrementMetric("stripe_webhook_processed_total", {
      result: "ok",
    });
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    console.error("[StripeWebhook]", message);
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "", "utf8");
    const payloadHash =
      rawBody.length > 0
        ? crypto.createHash("sha256").update(rawBody).digest("hex")
        : null;
    await recordStripeWebhookFailure({
      type: classifyWebhookError(error),
      stripeSessionId: null,
      payloadHash,
      error: message,
    });
    return sendJson(res, 400, {
      ok: false,
      error: message,
    });
  }
}
