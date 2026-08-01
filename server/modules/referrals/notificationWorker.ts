import { sendTransactionalEmail } from "../../_core/mailer";
import * as referralRepo from "./repo";

const DEFAULT_INTERVAL_MS = 60_000;
const BATCH_LIMIT = 50;
const MAX_ATTEMPTS = 5;
const STALE_PROCESSING_MS = 15 * 60 * 1000;
const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  15 * 60_000,
  60 * 60_000,
  6 * 60 * 60_000,
] as const;

function readPayload(payload: Record<string, unknown>): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = typeof payload.subject === "string" ? payload.subject : "";
  const text = typeof payload.text === "string" ? payload.text : "";
  const html = typeof payload.html === "string" ? payload.html : "";
  if (!subject || !text || !html) {
    throw new Error("Referral notification payload is invalid");
  }
  return { subject, text, html };
}

function getRetryDelay(attemptCount: number): number {
  const index = Math.max(
    0,
    Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)
  );
  return RETRY_DELAYS_MS[index];
}

async function deliverNotification(notificationId: number, now: Date) {
  const staleProcessingBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const notification = await referralRepo.claimReferralNotification({
    notificationId,
    now,
    staleProcessingBefore,
  });
  if (!notification) {
    return;
  }

  try {
    const payload = readPayload(notification.payload);
    await sendTransactionalEmail({
      to: notification.recipient,
      ...payload,
    });
    await referralRepo.markReferralNotificationSent({
      notificationId: notification.id,
      sentAt: new Date(),
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Unknown notification delivery error";
    const terminal = notification.attemptCount >= MAX_ATTEMPTS;
    await referralRepo.markReferralNotificationFailed({
      notificationId: notification.id,
      error: message,
      terminal,
      nextAttemptAt: new Date(
        now.getTime() + getRetryDelay(notification.attemptCount)
      ),
    });
  }
}

export async function processReferralNotificationOutbox(now = new Date()) {
  const staleProcessingBefore = new Date(now.getTime() - STALE_PROCESSING_MS);
  const notificationIds = await referralRepo.listDueReferralNotificationIds({
    now,
    staleProcessingBefore,
    limit: BATCH_LIMIT,
  });

  for (const notificationId of notificationIds) {
    await deliverNotification(notificationId, now);
  }
}

export function startReferralNotificationWorker(options?: {
  intervalMs?: number;
  runOnStart?: boolean;
}) {
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const runOnStart = options?.runOnStart ?? true;
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      await processReferralNotificationOutbox();
    } catch (error) {
      console.warn("[ReferralNotificationWorker] tick failed:", error);
    } finally {
      running = false;
    }
  };

  if (runOnStart) {
    void tick();
  }
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);

  return () => clearInterval(timer);
}
