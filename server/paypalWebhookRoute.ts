import type { Request, Response } from "express";
import crypto from "crypto";
import { captureOrFinalizePaypalSession, parsePaypalWebhookEvent, verifyPaypalWebhookSignature } from "./modules/payments/providers/paypalAdapter";
import { settleStripePaymentBySessionId } from "./modules/payments/settlement";
import { getDb } from "./db";
import * as appointmentsRepo from "./modules/appointments/repo";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./modules/appointments/stateMachine";
import { incrementMetric } from "./_core/metrics";
import { isDuplicateDbError } from "./_core/dbCompat";

function sendJson(res: Response, status: number, payload: Record<string, unknown>) {
  res.status(status).setHeader("content-type", "application/json");
  res.send(JSON.stringify(payload));
}

async function recordPaypalWebhookFailure(input: {
  type: string;
  sessionId?: string | null;
  payloadHash?: string | null;
  error: string;
}) {
  incrementMetric("paypal_webhook_failure_total", {
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
      provider: "paypal",
      stripeSessionId: input.sessionId ?? null,
      appointmentId: null,
      payloadHash: input.payloadHash ?? null,
      dbExecutor: db,
    });
  } catch (error) {
    console.warn("[PayPalWebhook] failed to persist webhook failure audit:", error);
  }
}

function normalizeType(rawType: unknown) {
  return typeof rawType === "string" ? rawType.trim().toUpperCase() : "";
}

function extractAppointmentIdFromPaypalEvent(event: {
  resource?: Record<string, unknown>;
  [key: string]: unknown;
}) {
  const resource = event.resource;
  if (!resource || typeof resource !== "object") {
    return null;
  }

  const purchaseUnits =
    typeof resource.purchase_units === "object" && Array.isArray((resource as { purchase_units?: unknown }).purchase_units)
      ? ((resource as { purchase_units?: unknown[] }).purchase_units ?? [])
      : [];
  const firstUnit = purchaseUnits.length > 0 ? purchaseUnits[0] : null;
  const firstUnitReferenceId =
    firstUnit && typeof (firstUnit as Record<string, unknown>).reference_id === "string"
      ? ((firstUnit as Record<string, unknown>).reference_id as string).trim()
      : "";
  if (firstUnitReferenceId.length > 0) {
    const rawId = firstUnitReferenceId;
    const numericId = Number(rawId);
    if (Number.isInteger(numericId) && numericId > 0) {
      return numericId;
    }
  }

  const customId =
    typeof resource.custom_id === "string" && resource.custom_id.trim().length > 0
      ? resource.custom_id.trim()
      : null;
  const maybeNumeric = customId ? Number(customId) : Number.NaN;
  return Number.isInteger(maybeNumeric) && maybeNumeric > 0 ? maybeNumeric : null;
}

function classifyWebhookError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("paypal signature") || message.includes("paypal-transmission")) {
    return "signature_verification_failed";
  }
  if (message.includes("missing session id") || message.includes("no provider session id")) {
    return "missing_session_id";
  }
  if (message.includes("malformed paypal webhook payload")) {
    return "malformed_event";
  }
  if (message.includes("database not available")) {
    return "db_unavailable";
  }
  return "processing_error";
}

function isSettlementEvent(eventType: string) {
  return (
    eventType === "CHECKOUT.ORDER.APPROVED" ||
    eventType === "CHECKOUT.ORDER.COMPLETED" ||
    eventType === "PAYMENT.CAPTURE.COMPLETED"
  );
}

function isExpiredOrFailedEvent(eventType: string) {
  return (
    eventType === "CHECKOUT.ORDER.CANCELLED" ||
    eventType === "PAYMENT.CAPTURE.DENIED"
  );
}

function isRefundEvent(eventType: string) {
  return (
    eventType === "PAYMENT.CAPTURE.REVERSED" ||
    eventType === "PAYMENT.CAPTURE.REFUNDED" ||
    eventType === "RISK.DISPUTE.CREATED" ||
    eventType === "RISK.DISPUTE.RESOLVED"
  );
}

export async function handlePaypalWebhook(req: Request, res: Response) {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "", "utf8");

    await verifyPaypalWebhookSignature({
      rawBody,
      headers: req.headers as Record<string, string | string[] | undefined>,
    });

    const event = parsePaypalWebhookEvent(rawBody);
    const eventType = normalizeType(event.event_type);
    const isSettlementLikeEvent = isSettlementEvent(eventType);
    const requiresSessionId =
      isSettlementLikeEvent ||
      isExpiredOrFailedEvent(eventType) ||
      isRefundEvent(eventType) ||
      eventType === "CHECKOUT.ORDER.COMPLETED";

    const sessionId =
      typeof event.resource?.id === "string"
        ? event.resource.id.trim()
        : null;

    const appointmentIdFromMetadata = extractAppointmentIdFromPaypalEvent(event);

    if (requiresSessionId && !sessionId) {
      await recordPaypalWebhookFailure({
        type: "webhook_error_missing_session_id",
        sessionId: null,
        payloadHash: crypto
          .createHash("sha256")
          .update(rawBody)
          .digest("hex"),
        error: "required session id missing from PayPal webhook",
      });
      return sendJson(res, 400, {
        ok: false,
        error: "PayPal webhook missing session id",
      });
    }

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    let duplicatedEvent = false;
    const payloadHash = crypto.createHash("sha256").update(rawBody).digest("hex");
    let appointmentIdFromLookup: number | null = appointmentIdFromMetadata;

    await db.transaction(async tx => {
      if (sessionId) {
        const appointment = await appointmentsRepo.getAppointmentByStripeSessionId(sessionId, tx);
        appointmentIdFromLookup = appointment?.id ?? appointmentIdFromLookup;
      }

      try {
        await appointmentsRepo.insertStripeWebhookEvent({
          eventId: event.id,
          type: eventType,
          provider: "paypal",
          stripeSessionId: sessionId,
          appointmentId: appointmentIdFromLookup,
          payloadHash,
          dbExecutor: tx,
        });
      } catch (error) {
        if (isDuplicateDbError(error)) {
          duplicatedEvent = true;
          incrementMetric("paypal_webhook_duplicate_total");
          return;
        }
        throw error;
      }

      if (isSettlementLikeEvent) {
        const resolvedSessionId = sessionId!;

        await captureOrFinalizePaypalSession({
          providerSessionId: resolvedSessionId,
        });

        await settleStripePaymentBySessionId({
          stripeSessionId: resolvedSessionId,
          source: "webhook",
          eventId: event.id,
          req,
          dbExecutor: tx,
        });
        return;
      }

      if (isExpiredOrFailedEvent(eventType) && sessionId) {
        await appointmentsRepo.tryTransitionAppointmentByStripeSessionId({
          stripeSessionId: sessionId,
          allowedFrom: ["pending_payment"],
          toStatus: "canceled",
          toPaymentStatus: "failed",
          operatorType: "webhook",
          reason: "payment_failed",
          payloadJson: { eventType },
          dbExecutor: tx,
        });
        return;
      }

      if (isRefundEvent(eventType) && sessionId) {
        const targetAppointment =
          appointmentIdFromLookup ??
          (await appointmentsRepo.getAppointmentByStripeSessionId(sessionId, tx))?.id ??
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
            stripeSessionId: sessionId ?? null,
            eventId: event.id,
            eventType,
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

    incrementMetric("paypal_webhook_processed_total", {
      result: "ok",
    });
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    console.error("[PayPalWebhook]", message);
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === "string" ? req.body : "", "utf8");
    const payloadHash =
      rawBody.length > 0 ? crypto.createHash("sha256").update(rawBody).digest("hex") : null;
    await recordPaypalWebhookFailure({
      type: classifyWebhookError(error),
      sessionId: null,
      payloadHash,
      error: message,
    });
    return sendJson(res, 400, {
      ok: false,
      error: message,
    });
  }
}
