import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  listActiveContactsByHospital,
  updateReferralContactActive,
  upsertHospital,
} from "./catalogRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("referral catalog repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists active contacts in the requested hospital and department", async () => {
    const rows = [{ id: 11 }];
    const orderBy = vi.fn(async () => rows);
    const where = vi.fn(() => ({ orderBy }));
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where })),
      })),
    } as never);

    await expect(
      listActiveContactsByHospital({ hospitalId: 2, departmentId: 3 })
    ).resolves.toEqual(rows);
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });

  it("normalizes contact active state and returns affected rows", async () => {
    const where = vi.fn(async () => ({ rowCount: 1 }));
    const set = vi.fn(() => ({ where }));
    vi.mocked(getDb).mockResolvedValue({
      update: vi.fn(() => ({ set })),
    } as never);

    await expect(
      updateReferralContactActive({ contactId: 12, isActive: false })
    ).resolves.toBe(1);
    expect(set).toHaveBeenCalledWith({
      isActive: 0,
      updatedAt: expect.any(Date),
    });
  });

  it("preserves hospital insert defaults and returns the inserted record", async () => {
    const hospital = { id: 13, name: "测试医院", city: "上海" };
    const returning = vi.fn(async () => [{ id: 13 }]);
    const values = vi.fn(() => ({ returning }));
    const limit = vi.fn(async () => [hospital]);
    vi.mocked(getDb).mockResolvedValue({
      insert: vi.fn(() => ({ values })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
    } as never);

    await expect(
      upsertHospital({ name: "测试医院", isActive: true })
    ).resolves.toEqual(hospital);
    expect(values).toHaveBeenCalledWith({
      name: "测试医院",
      nameEn: null,
      city: "上海",
      cityEn: null,
      isActive: 1,
    });
    expect(limit).toHaveBeenCalledWith(1);
  });
});
