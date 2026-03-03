import type { Request, Response } from "express";
import {
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./modules/payments/stripe";
import { settleStripePaymentBySessionId } from "./paymentsRouter";

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

    if (event.type === "checkout.session.completed") {
      const object = event.data.object;
      const stripeSessionId =
        typeof object.id === "string" && object.id.trim().length > 0
          ? object.id.trim()
          : null;

      if (!stripeSessionId) {
        return sendJson(res, 400, {
          ok: false,
          error: "checkout.session.completed missing session id",
        });
      }

      await settleStripePaymentBySessionId({
        stripeSessionId,
        source: "webhook",
        eventId: event.id,
      });
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
