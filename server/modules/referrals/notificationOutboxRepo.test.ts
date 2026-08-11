import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  claimReferralNotification,
  listDueReferralNotificationIds,
  markReferralNotificationFailed,
} from "./notificationOutboxRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("referral notification outbox repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only due notification ids and preserves the worker limit", async () => {
    const limit = vi.fn(async () => [{ id: 41 }, { id: 42 }]);
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({ limit })),
          })),
        })),
      })),
    } as never);

    await expect(
      listDueReferralNotificationIds({
        now: new Date("2026-08-01T00:00:00.000Z"),
        staleProcessingBefore: new Date("2026-07-31T23:55:00.000Z"),
        limit: 25,
      })
    ).resolves.toEqual([41, 42]);
    expect(limit).toHaveBeenCalledWith(25);
  });

  it("does not read a notification when the compare-and-set claim loses", async () => {
    const select = vi.fn();
    const where = vi.fn(async () => ({ rowCount: 0 }));
    vi.mocked(getDb).mockResolvedValue({
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where })),
      })),
      select,
    } as never);

    await expect(
      claimReferralNotification({
        notificationId: 43,
        now: new Date("2026-08-01T00:00:00.000Z"),
        staleProcessingBefore: new Date("2026-07-31T23:55:00.000Z"),
      })
    ).resolves.toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("returns the claimed notification after a successful atomic update", async () => {
    const notification = { id: 44, status: "processing", attemptCount: 2 };
    const updateWhere = vi.fn(async () => ({ rowCount: 1 }));
    const limit = vi.fn(async () => [notification]);
    vi.mocked(getDb).mockResolvedValue({
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: updateWhere })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
    } as never);

    await expect(
      claimReferralNotification({
        notificationId: 44,
        now: new Date("2026-08-01T00:00:00.000Z"),
        staleProcessingBefore: new Date("2026-07-31T23:55:00.000Z"),
      })
    ).resolves.toEqual(notification);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("preserves terminal failure state and retry metadata", async () => {
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    vi.mocked(getDb).mockResolvedValue({
      update: vi.fn(() => ({ set })),
    } as never);
    const nextAttemptAt = new Date("2026-08-01T00:10:00.000Z");

    await markReferralNotificationFailed({
      notificationId: 45,
      error: "mail provider unavailable",
      nextAttemptAt,
      terminal: true,
    });

    expect(set).toHaveBeenCalledWith({
      status: "failed",
      lastError: "mail provider unavailable",
      nextAttemptAt,
      processingStartedAt: null,
      updatedAt: expect.any(Date),
    });
  });
});
