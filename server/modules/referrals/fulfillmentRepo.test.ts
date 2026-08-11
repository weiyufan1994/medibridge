import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { listExpiredReferralSlaOrders } from "./fulfillmentRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("referral fulfillment repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the SLA worker query, ordering, and batch limit", async () => {
    const orders = [{ id: 71 }, { id: 72 }];
    const limit = vi.fn(async () => orders);
    const orderBy = vi.fn(() => ({ limit }));
    const where = vi.fn(() => ({ orderBy }));
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where })),
      })),
    } as never);
    const now = new Date("2026-08-04T08:00:00.000Z");

    await expect(
      listExpiredReferralSlaOrders({ now, limit: 100 })
    ).resolves.toEqual(orders);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
    expect(limit).toHaveBeenCalledWith(100);
  });
});
