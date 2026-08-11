import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { listAppointmentsForAdmin } from "./adminListReadRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("appointment admin list read repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves pagination limits and maps operational risk flags", async () => {
    const row = {
      id: 701,
      userId: 44,
      email: "patient@example.com",
      doctorId: 8,
      triageSessionId: 91,
      appointmentType: "video",
      status: "paid",
      paymentStatus: "paid",
      amount: 12000,
      currency: "cny",
      stripeSessionId: "cs_701",
      scheduledAt: new Date("2026-02-02T03:00:00.000Z"),
      paidAt: new Date("2026-02-01T03:00:00.000Z"),
      createdAt: new Date("2026-02-01T02:00:00.000Z"),
      updatedAt: new Date("2026-02-01T03:00:00.000Z"),
      hasPendingPaymentTimeout: false,
      hasWebhookFailure: true,
      hasTokenExpiringSoon: true,
      hasTokenUsageExhausted: false,
    };
    const offset = vi.fn(async () => [row]);
    const limit = vi.fn(() => ({ offset }));
    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({ limit })),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ count: "401" }]),
        })),
      });
    vi.mocked(getDb).mockResolvedValue({ select } as never);

    await expect(
      listAppointmentsForAdmin({
        page: 2,
        pageSize: 500,
        status: "paid",
        hasRisk: true,
        sortBy: "amount",
        sortDirection: "asc",
      })
    ).resolves.toEqual({
      page: 2,
      pageSize: 200,
      total: 401,
      totalPages: 3,
      items: [
        {
          id: 701,
          userId: 44,
          email: "patient@example.com",
          doctorId: 8,
          triageSessionId: 91,
          appointmentType: "video",
          status: "paid",
          paymentStatus: "paid",
          amount: 12000,
          currency: "cny",
          stripeSessionId: "cs_701",
          scheduledAt: new Date("2026-02-02T03:00:00.000Z"),
          paidAt: new Date("2026-02-01T03:00:00.000Z"),
          createdAt: new Date("2026-02-01T02:00:00.000Z"),
          updatedAt: new Date("2026-02-01T03:00:00.000Z"),
          riskCodes: ["WEBHOOK_FAILURE", "TOKEN_EXPIRING_SOON"],
          hasRisk: true,
        },
      ],
      riskSummary: {
        total: 1,
        pendingPaymentTimeout: 0,
        webhookFailure: 1,
        tokenExpiringSoon: 1,
        tokenUsageExhausted: 0,
      },
    });
    expect(limit).toHaveBeenCalledWith(200);
    expect(offset).toHaveBeenCalledWith(200);
  });

  it("preserves the database-unavailable error", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(listAppointmentsForAdmin({})).rejects.toThrow(
      "Database not available"
    );
  });
});
