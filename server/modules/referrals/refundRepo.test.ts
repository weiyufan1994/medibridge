import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  createRefundRequest,
  getLatestRefundRequestByOrderId,
  listRefundProcessingOrders,
  updateRefundRequestById,
} from "./refundRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("referral refund repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the refund worker batch limit", async () => {
    const orders = [{ id: 51 }, { id: 52 }];
    const limit = vi.fn(async () => orders);
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({ limit })),
          })),
        })),
      })),
    } as never);

    await expect(listRefundProcessingOrders(20)).resolves.toEqual(orders);
    expect(limit).toHaveBeenCalledWith(20);
  });

  it("returns the latest refund request selected by the repository", async () => {
    const request = { id: 53, orderId: 7, status: "processing" };
    const limit = vi.fn(async () => [request]);
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({ limit })),
          })),
        })),
      })),
    } as never);

    await expect(getLatestRefundRequestByOrderId(7)).resolves.toEqual(request);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("creates a refund request through the supplied transaction executor", async () => {
    const returning = vi.fn(async () => [{ id: 54 }]);
    const values = vi.fn(() => ({ returning }));
    const dbExecutor = { insert: vi.fn(() => ({ values })) } as never;

    await expect(
      createRefundRequest({
        values: {
          orderId: 8,
          reasonCode: "service_unavailable",
          reasonDetail: "No specialist available",
          status: "pending_review",
          requestedBy: 11,
        },
        dbExecutor,
      })
    ).resolves.toBe(54);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("updates retry state through the supplied executor and returns affected rows", async () => {
    const where = vi.fn(async () => ({ rowCount: 1 }));
    const set = vi.fn(() => ({ where }));
    const dbExecutor = { update: vi.fn(() => ({ set })) } as never;

    await expect(
      updateRefundRequestById({
        refundRequestId: 55,
        update: { status: "failed", failureReason: "provider timeout" },
        dbExecutor,
      })
    ).resolves.toBe(1);
    expect(set).toHaveBeenCalledWith({
      status: "failed",
      failureReason: "provider timeout",
      updatedAt: expect.any(Date),
    });
    expect(getDb).not.toHaveBeenCalled();
  });
});
