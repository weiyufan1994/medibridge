import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { processReferralNotificationOutbox } from "./notificationWorker";

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
});
