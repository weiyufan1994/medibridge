import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  findLatestAppointmentIdByLookup,
  getAppointmentById,
  getAppointmentByStripeSessionId,
  getCheckoutResultByStripeSessionId,
} from "./coreReadRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

function buildExecutor(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ limit, orderBy }));

  return {
    executor: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where })),
      })),
      insert: vi.fn(),
      update: vi.fn(),
    },
    limit,
  };
}

describe("appointment core read repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an appointment by id", async () => {
    const appointment = { id: 401, status: "paid" };
    const { executor, limit } = buildExecutor([appointment]);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(getAppointmentById(401)).resolves.toEqual(appointment);
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("uses an injected executor for Stripe session lookup", async () => {
    const appointment = { id: 402, stripeSessionId: "cs_402" };
    const { executor } = buildExecutor([appointment]);

    await expect(
      getAppointmentByStripeSessionId("cs_402", executor as never)
    ).resolves.toEqual(appointment);
    expect(getDb).not.toHaveBeenCalled();
  });

  it("preserves the checkout result projection", async () => {
    const checkout = {
      id: 403,
      paymentStatus: "paid",
      status: "paid",
      email: "patient@example.com",
      lastAccessAt: null,
      paidAt: new Date("2026-01-02T03:04:05.000Z"),
    };
    const { executor } = buildExecutor([checkout]);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(getCheckoutResultByStripeSessionId("cs_403")).resolves.toEqual(
      checkout
    );
  });

  it("returns the newest matching appointment id", async () => {
    const { executor, limit } = buildExecutor([{ id: 404 }]);

    await expect(
      findLatestAppointmentIdByLookup({
        slotId: 12,
        doctorId: 8,
        email: "patient@example.com",
        scheduledAt: new Date("2026-02-03T04:05:06.000Z"),
        triageSessionId: 33,
        status: "draft",
        paymentStatus: "unpaid",
        dbExecutor: executor as never,
      })
    ).resolves.toBe(404);
    expect(limit).toHaveBeenCalledWith(1);
  });
});
