import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  isOrderOwnedByUser,
  listMineReferralOrders,
  listReferralOrdersForAdmin,
  listStatusEventsByOrderId,
} from "./orderListReadRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("referral order list read repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status history in repository order", async () => {
    const rows = [{ id: 21 }, { id: 20 }];
    const orderBy = vi.fn(async () => rows);
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy })),
        })),
      })),
    } as never);

    await expect(listStatusEventsByOrderId(7)).resolves.toEqual(rows);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });

  it("preserves the caller limit for patient order history", async () => {
    const rows = [{ order: { id: 22 } }];
    const limit = vi.fn(async () => rows);
    const query = {
      leftJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit,
    };
    query.leftJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => query),
      })),
    } as never);

    await expect(
      listMineReferralOrders({ patientUserId: 9, limit: 30 })
    ).resolves.toEqual(rows);
    expect(limit).toHaveBeenCalledWith(30);
  });

  it("caps admin page size and returns normalized pagination", async () => {
    const rows = [{ order: { id: 23 }, urgencyMinutes: 4 }];
    const offset = vi.fn(async () => rows);
    const listQuery = {
      leftJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(),
      offset,
    };
    listQuery.leftJoin.mockReturnValue(listQuery);
    listQuery.where.mockReturnValue(listQuery);
    listQuery.orderBy.mockReturnValue(listQuery);
    listQuery.limit.mockReturnValue(listQuery);
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn(() => listQuery),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ count: "201" }]),
        })),
      });
    vi.mocked(getDb).mockResolvedValue({ select } as never);

    await expect(
      listReferralOrdersForAdmin({
        page: 2,
        pageSize: 500,
        status: "assigned",
        hospitalId: 5,
        sortDirection: "asc",
      })
    ).resolves.toEqual({
      page: 2,
      pageSize: 100,
      total: 201,
      totalPages: 3,
      items: rows,
    });
    expect(listQuery.limit).toHaveBeenCalledWith(100);
    expect(offset).toHaveBeenCalledWith(100);
  });

  it("checks order ownership without changing the order", () => {
    const order = { patientUserId: 15 } as never;

    expect(isOrderOwnedByUser(order, 15)).toBe(true);
    expect(isOrderOwnedByUser(order, 16)).toBe(false);
  });
});
