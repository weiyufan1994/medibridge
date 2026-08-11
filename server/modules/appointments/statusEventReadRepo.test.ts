import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  countStatusEventsByAppointment,
  hasAppointmentStatusReason,
  listAppointmentStatusEventsForAdmin,
  listStatusEventsByAppointment,
} from "./statusEventReadRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("appointment status event read repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizes the persisted event count to a number", async () => {
    const where = vi.fn(async () => [{ count: "3" }]);
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where })),
      })),
    } as never);

    await expect(countStatusEventsByAppointment(301)).resolves.toBe(3);
  });

  it("uses the caller-provided appointment history limit", async () => {
    const events = [{ id: 1 }, { id: 2 }];
    const limit = vi.fn(async () => events);
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
      listStatusEventsByAppointment({ appointmentId: 302, limit: 25 })
    ).resolves.toEqual(events);
    expect(limit).toHaveBeenCalledWith(25);
  });

  it("reports whether the requested audit reason exists", async () => {
    const limit = vi.fn(async () => [{ count: 1 }]);
    vi.mocked(getDb).mockResolvedValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
    } as never);

    await expect(
      hasAppointmentStatusReason({
        appointmentId: 303,
        reason: "admin_refund",
      })
    ).resolves.toBe(true);
  });

  it("paginates and maps admin audit events without exposing query fields", async () => {
    const event = {
      id: 4,
      appointmentId: 304,
      fromStatus: "paid",
      toStatus: "refunded",
      operatorType: "admin",
      operatorId: 12,
      reason: "admin_refund",
      payloadJson: { source: "console" },
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      internal: "not-returned",
    };
    const offset = vi.fn(async () => [event]);
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({ offset })),
            })),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ count: "51" }]),
        })),
      });
    vi.mocked(getDb).mockResolvedValue({ select } as never);

    await expect(
      listAppointmentStatusEventsForAdmin({
        page: 2,
        pageSize: 25,
        operatorId: 12,
        actionType: "refund",
        from: new Date("2026-01-01T00:00:00.000Z"),
        to: new Date("2026-01-02T00:00:00.000Z"),
      })
    ).resolves.toEqual({
      page: 2,
      pageSize: 25,
      total: 51,
      totalPages: 3,
      items: [
        {
          id: 4,
          appointmentId: 304,
          fromStatus: "paid",
          toStatus: "refunded",
          operatorType: "admin",
          operatorId: 12,
          reason: "admin_refund",
          payloadJson: { source: "console" },
          createdAt: new Date("2026-01-02T03:04:05.000Z"),
        },
      ],
    });
    expect(offset).toHaveBeenCalledWith(25);
  });
});
