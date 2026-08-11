import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { updateAppointmentById } from "./updateWriteRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("appointment update write repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the exact requested appointment patch", async () => {
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    vi.mocked(getDb).mockResolvedValue({ update } as never);

    const patch = {
      scheduledAt: new Date("2026-05-06T07:08:09.000Z"),
      status: "paid" as const,
      paymentStatus: "paid" as const,
    };
    await updateAppointmentById(701, patch);

    expect(set).toHaveBeenCalledWith(patch);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("preserves the database unavailable error", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(updateAppointmentById(702, {})).rejects.toThrow(
      "Database not available"
    );
  });
});
