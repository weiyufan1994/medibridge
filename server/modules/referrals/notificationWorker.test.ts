import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/mailer", () => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("./repo", () => ({
  listDueReferralNotificationIds: vi.fn(),
  claimReferralNotification: vi.fn(),
  markReferralNotificationSent: vi.fn(),
  markReferralNotificationFailed: vi.fn(),
}));

import { sendTransactionalEmail } from "../../_core/mailer";
import * as referralRepo from "./repo";
import {
  processReferralNotificationOutbox,
  startReferralNotificationWorker,
} from "./notificationWorker";

function createNotification(attemptCount: number) {
  return {
    id: 801,
    recipient: "patient@example.com",
    attemptCount,
    payload: {
      subject: "Referral update",
      text: "Your order changed.",
      html: "<p>Your order changed.</p>",
    },
  };
}

describe("referral notification worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralRepo.listDueReferralNotificationIds).mockResolvedValue([
      801,
    ] as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("claims and marks a delivered notification sent", async () => {
    vi.mocked(referralRepo.claimReferralNotification).mockResolvedValue(
      createNotification(1) as never
    );

    await processReferralNotificationOutbox(
      new Date("2026-08-01T00:00:00.000Z")
    );

    expect(sendTransactionalEmail).toHaveBeenCalledWith({
      to: "patient@example.com",
      subject: "Referral update",
      text: "Your order changed.",
      html: "<p>Your order changed.</p>",
    });
    expect(referralRepo.markReferralNotificationSent).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 801 })
    );
  });

  it("marks the fifth failed attempt terminal for operations visibility", async () => {
    vi.mocked(referralRepo.claimReferralNotification).mockResolvedValue(
      createNotification(5) as never
    );
    vi.mocked(sendTransactionalEmail).mockRejectedValue(
      new Error("mail provider unavailable")
    );

    await processReferralNotificationOutbox(
      new Date("2026-08-01T00:00:00.000Z")
    );

    expect(referralRepo.markReferralNotificationFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: 801,
        terminal: true,
        error: "mail provider unavailable",
      })
    );
    expect(referralRepo.markReferralNotificationSent).not.toHaveBeenCalled();
  });

  it("logs a safe structured event when a worker tick fails", async () => {
    vi.mocked(referralRepo.listDueReferralNotificationIds).mockRejectedValue(
      new Error("private recipient or payload detail")
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const stopWorker = startReferralNotificationWorker({
      intervalMs: 1_000_000,
      runOnStart: true,
    });

    try {
      await vi.waitFor(() => expect(consoleWarn).toHaveBeenCalledOnce());

      const logged = String(consoleWarn.mock.calls[0]?.[0]);
      expect(JSON.parse(logged)).toMatchObject({
        component: "referral-notification-worker",
        event: "tick_failed",
        errorName: "Error",
      });
      expect(logged).not.toContain("private recipient or payload detail");
      expect(logged).not.toContain("recipient");
      expect(logged).not.toContain("payload");
    } finally {
      stopWorker();
    }
  });
});
