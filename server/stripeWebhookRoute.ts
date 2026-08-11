import crypto from "crypto";
import type { Request, Response } from "express";
import { createLogger } from "./_core/logger";
import { incrementMetric } from "./_core/metrics";
import { getRequestMetadata } from "./_core/requestMetadata";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import {
  parseStripeWebhookEvent,
  verifyStripeWebhookSignature,
} from "./modules/payments/stripe";
import { buildStripeWebhookContext } from "./stripeWebhookContext";
import { processStripeWebhookEvent } from "./stripeWebhookProcessor";

const logger = createLogger("stripe-webhook");

function sendJson(
  res: Response,
  status: number,
  payload: Record<string, unknown>
) {
  res.status(status).setHeader("content-type", "application/json");
  res.send(JSON.stringify(payload));
}

function readRawBody(req: Request) {
  return Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === "string" ? req.body : "", "utf8");
}

async function recordStripeWebhookFailure(input: {
  type: string;
  stripeSessionId?: string | null;
  payloadHash?: string | null;
  requestId?: string | null;
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
    logger.warn("failure_audit_persist_failed", {
      requestId: input.requestId,
      failureType: input.type,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
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
  const requestId = getRequestMetadata(req).requestId;
  try {
    const rawBody = readRawBody(req);

    verifyStripeWebhookSignature({
      rawBody,
      signatureHeader:
        typeof req.headers["stripe-signature"] === "string"
          ? req.headers["stripe-signature"]
          : undefined,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const event = parseStripeWebhookEvent(rawBody);
    const context = await buildStripeWebhookContext(event);

    if (
      (event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded") &&
      !context.stripeSessionId
    ) {
      await recordStripeWebhookFailure({
        type: "webhook_error_missing_session_id",
        stripeSessionId: null,
        payloadHash: crypto.createHash("sha256").update(rawBody).digest("hex"),
        requestId,
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

    const payloadHash = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex");
    const { duplicatedEvent } = await processStripeWebhookEvent({
      db,
      event,
      context,
      payloadHash,
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
    const failureType = classifyWebhookError(error);
    logger.error("processing_failed", {
      requestId,
      failureType,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    const rawBody = readRawBody(req);
    const payloadHash =
      rawBody.length > 0
        ? crypto.createHash("sha256").update(rawBody).digest("hex")
        : null;
    await recordStripeWebhookFailure({
      type: failureType,
      stripeSessionId: null,
      payloadHash,
      requestId,
    });
    return sendJson(res, 400, {
      ok: false,
      error: message,
    });
  }
}
