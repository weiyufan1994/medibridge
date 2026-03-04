import type { Request, Response } from "express";
import crypto from "crypto";
import {
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./modules/payments/stripe";
import { settleStripePaymentBySessionId } from "./paymentsRouter";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";

function sendJson(res: Response, status: number, payload: Record<string, unknown>) {
  res.status(status).setHeader("content-type", "application/json");
  res.send(JSON.stringify(payload));
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
    const stripeSessionId =
      event.type === "checkout.session.completed"
        ? (() => {
            const object = event.data.object;
            const rawSessionId =
              typeof object.id === "string" && object.id.trim().length > 0
                ? object.id.trim()
                : null;
            return rawSessionId;
          })()
        : null;

    if (event.type === "checkout.session.completed" && !stripeSessionId) {
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
      let appointmentId: number | null = null;
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
      }
    });

    if (duplicatedEvent) {
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    console.error("[StripeWebhook]", message);
    return sendJson(res, 400, {
      ok: false,
      error: message,
    });
  }
}
