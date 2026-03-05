import type { Request, Response } from "express";
import crypto from "crypto";
import {
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./modules/payments/stripe";
import { settleStripePaymentBySessionId } from "./paymentsRouter";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./modules/appointments/stateMachine";
import { incrementMetric } from "./_core/metrics";

function sendJson(res: Response, status: number, payload: Record<string, unknown>) {
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
      stripeSessionId: input.stripeSessionId ?? null,
      appointmentId: null,
      payloadHash: input.payloadHash ?? null,
      dbExecutor: db,
    });
  } catch (error) {
    console.warn("[StripeWebhook] failed to persist webhook failure audit:", error);
  }
}

function classifyWebhookError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
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
    const isDuplicateKeyError = (error: unknown) =>
      ((error as { cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code) === "ER_DUP_ENTRY";
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
      typeof metadata.stripeSessionId === "string" ? metadata.stripeSessionId.trim() : null;
    const nestedCheckoutSessionId =
      typeof object.checkout_session === "string" ? object.checkout_session.trim() : null;
    const stripeSessionId =
      event.type === "checkout.session.completed" || event.type === "checkout.session.expired"
        ? directObjectId
        : metadataStripeSessionId || nestedCheckoutSessionId;
    const metadataAppointmentId = Number(metadata.appointmentId ?? NaN);
    const appointmentIdFromMetadata =
      Number.isInteger(metadataAppointmentId) && metadataAppointmentId > 0
        ? metadataAppointmentId
        : null;

    if (event.type === "checkout.session.completed" && !stripeSessionId) {
      await recordStripeWebhookFailure({
        type: "webhook_error_missing_session_id",
        stripeSessionId: null,
        payloadHash: crypto
          .createHash("sha256")
          .update(rawBody)
          .digest("hex"),
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
      if (stripeSessionId) {
        const appointment = await appointmentsRepo.getAppointmentByStripeSessionId(
          stripeSessionId,
          tx
        );
        appointmentId = appointment?.id ?? null;
      }

      try {
        await appointmentsRepo.insertStripeWebhookEvent({
          eventId: event.id,
          type: event.type,
          stripeSessionId,
          appointmentId,
          payloadHash,
          dbExecutor: tx,
        });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          duplicatedEvent = true;
          incrementMetric("stripe_webhook_duplicate_total");
          return;
        }
        throw error;
      }

      if (event.type === "checkout.session.completed") {
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
        return;
      }

      if (event.type === "payment_intent.payment_failed" && stripeSessionId) {
        await appointmentsRepo.tryTransitionAppointmentByStripeSessionId({
          stripeSessionId,
          allowedFrom: ["pending_payment"],
          toStatus: "canceled",
          toPaymentStatus: "failed",
          operatorType: "webhook",
          reason: "payment_failed",
          payloadJson: { eventId: event.id },
          dbExecutor: tx,
        });
        return;
      }

      const isRefundEvent =
        event.type === "charge.refunded" ||
        (event.type === "refund.updated" &&
          (String(object.status ?? "").toLowerCase() === "succeeded" ||
            String(object.status ?? "").toLowerCase() === "successful"));
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

        const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
          appointmentId: targetAppointment,
          allowedFrom: ["paid", "active", "ended"],
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
