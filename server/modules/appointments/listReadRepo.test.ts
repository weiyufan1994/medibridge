import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  listAppointmentsByDoctor,
  listAppointmentsByEmail,
  listAppointmentsByUserOrEmail,
  listAppointmentsByUserScope,
} from "./listReadRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

function buildLimitedExecutor(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  return {
    executor: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({ limit })),
          })),
        })),
      })),
    },
    limit,
  };
}

function buildUnboundedExecutor(rows: unknown[]) {
  const orderBy = vi.fn(async () => rows);
  return {
    executor: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ orderBy })),
        })),
      })),
    },
    orderBy,
  };
}

describe("appointment list read repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("limits the signed-in user scope query", async () => {
    const rows = [{ id: 501 }];
    const { executor, limit } = buildLimitedExecutor(rows);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(
      listAppointmentsByUserScope({
        userId: 31,
        email: "patient@example.com",
        limit: 20,
      })
    ).resolves.toEqual(rows);
    expect(limit).toHaveBeenCalledWith(20);
  });

  it("lists every appointment in the user-or-email scope", async () => {
    const rows = [{ id: 502 }];
    const { executor, orderBy } = buildUnboundedExecutor(rows);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(
      listAppointmentsByUserOrEmail({ userId: 32, email: null })
    ).resolves.toEqual(rows);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });

  it("lists appointments by exact email", async () => {
    const rows = [{ id: 503 }];
    const { executor } = buildUnboundedExecutor(rows);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(
      listAppointmentsByEmail("patient@example.com")
    ).resolves.toEqual(rows);
  });

  it("limits the doctor schedule query", async () => {
    const rows = [{ id: 504 }];
    const { executor, limit } = buildLimitedExecutor(rows);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(
      listAppointmentsByDoctor({ doctorId: 9, limit: 40 })
    ).resolves.toEqual(rows);
    expect(limit).toHaveBeenCalledWith(40);
  });
});
