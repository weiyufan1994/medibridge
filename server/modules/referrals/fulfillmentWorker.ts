import * as referralRepo from "./repo";
import {
  initiateAutomaticReferralRefund,
  processReferralRefund,
} from "./refunds";
import { createLogger } from "../../_core/logger";

const logger = createLogger("referral-fulfillment-worker");

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const BATCH_LIMIT = 100;

async function refundExpiredOrders(now: Date) {
  const orders = await referralRepo.listExpiredReferralSlaOrders({
    now,
    limit: BATCH_LIMIT,
  });

  for (const order of orders) {
    try {
      await initiateAutomaticReferralRefund({
        orderId: order.id,
        reasonCode: "sla_expired",
        reasonDetail:
          "No arrangeable consultation response was confirmed within two business days.",
        actor: { type: "system", id: null },
      });
    } catch (error) {
      logger.warn("sla_refund_failed", {
        orderId: order.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}

async function retryProcessingRefunds() {
  const orders = await referralRepo.listRefundProcessingOrders(BATCH_LIMIT);
  for (const order of orders) {
    try {
      await processReferralRefund({
        orderId: order.id,
        actor: { type: "system", id: null },
      });
    } catch (error) {
      logger.warn("refund_retry_failed", {
        orderId: order.id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}

export async function processReferralFulfillment(now = new Date()) {
  await refundExpiredOrders(now);
  await retryProcessingRefunds();
}

export function startReferralFulfillmentWorker(options?: {
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
      await processReferralFulfillment();
    } catch (error) {
      logger.warn("tick_failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
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
