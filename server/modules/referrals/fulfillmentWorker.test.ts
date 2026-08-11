import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  listExpiredReferralSlaOrders: vi.fn(),
  listRefundProcessingOrders: vi.fn(),
}));

vi.mock("./refunds", () => ({
  initiateAutomaticReferralRefund: vi.fn(),
  processReferralRefund: vi.fn(),
}));

import * as referralRepo from "./repo";
import {
  initiateAutomaticReferralRefund,
  processReferralRefund,
} from "./refunds";
import {
  processReferralFulfillment,
  startReferralFulfillmentWorker,
} from "./fulfillmentWorker";

describe("referral fulfillment worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralRepo.listExpiredReferralSlaOrders).mockResolvedValue(
      [] as never
    );
    vi.mocked(referralRepo.listRefundProcessingOrders).mockResolvedValue(
      [] as never
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts automatic full refunds for orders returned by the SLA query", async () => {
    const now = new Date("2026-08-04T08:00:00.000Z");
    vi.mocked(referralRepo.listExpiredReferralSlaOrders).mockResolvedValue([
      { id: 701, status: "booking_in_progress", paymentStatus: "paid" },
    ] as never);

    await processReferralFulfillment(now);

    expect(referralRepo.listExpiredReferralSlaOrders).toHaveBeenCalledWith({
      now,
      limit: 100,
    });
    expect(initiateAutomaticReferralRefund).toHaveBeenCalledWith({
      orderId: 701,
      reasonCode: "sla_expired",
      reasonDetail:
        "No arrangeable consultation response was confirmed within two business days.",
      actor: { type: "system", id: null },
    });
  });

  it("retries provider calls for refunds that remain processing", async () => {
    vi.mocked(referralRepo.listRefundProcessingOrders).mockResolvedValue([
      { id: 702, status: "refund_processing", paymentStatus: "paid" },
    ] as never);

    await processReferralFulfillment();

    expect(processReferralRefund).toHaveBeenCalledWith({
      orderId: 702,
      actor: { type: "system", id: null },
    });
  });

  it("logs per-order failures without exception details", async () => {
    vi.mocked(referralRepo.listExpiredReferralSlaOrders).mockResolvedValue([
      { id: 701, status: "booking_in_progress", paymentStatus: "paid" },
    ] as never);
    vi.mocked(referralRepo.listRefundProcessingOrders).mockResolvedValue([
      { id: 702, status: "refund_processing", paymentStatus: "paid" },
    ] as never);
    vi.mocked(initiateAutomaticReferralRefund).mockRejectedValue(
      new Error("private order detail")
    );
    vi.mocked(processReferralRefund).mockRejectedValue(
      new Error("private provider detail")
    );
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    await processReferralFulfillment();

    const logs = consoleWarn.mock.calls.map(call =>
      JSON.parse(String(call[0]))
    );
    expect(logs).toEqual([
      expect.objectContaining({
        component: "referral-fulfillment-worker",
        event: "sla_refund_failed",
        orderId: 701,
        errorName: "Error",
      }),
      expect.objectContaining({
        component: "referral-fulfillment-worker",
        event: "refund_retry_failed",
        orderId: 702,
        errorName: "Error",
      }),
    ]);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain("private order detail");
    expect(serialized).not.toContain("private provider detail");
  });

  it("logs tick failure without exception details", async () => {
    vi.mocked(referralRepo.listExpiredReferralSlaOrders).mockRejectedValue(
      new Error("private worker detail")
    );
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const stop = startReferralFulfillmentWorker({
      intervalMs: 1_000_000,
      runOnStart: true,
    });
    await vi.waitFor(() => expect(consoleWarn).toHaveBeenCalled());
    stop();

    const serialized = String(consoleWarn.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "referral-fulfillment-worker",
      event: "tick_failed",
      errorName: "Error",
    });
    expect(serialized).not.toContain("private worker detail");
  });
});
