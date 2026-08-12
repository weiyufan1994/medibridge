import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../../db";
import { getAppointmentTokenById } from "./tokenReadRepo";

function fakeDb(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select }, select, from, where, limit };
}

describe("appointment token read repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the source token row by its immutable id", async () => {
    const row = {
      id: 8,
      appointmentId: 42,
      role: "doctor",
      tokenHash: "a".repeat(64),
      expiresAt: new Date("2026-08-13T01:00:00.000Z"),
      revokedAt: null,
    };
    const executor = fakeDb([row]);
    vi.mocked(getDb).mockResolvedValue(executor.db as never);

    await expect(getAppointmentTokenById(8)).resolves.toEqual(row);
    expect(executor.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when the source token id is unknown", async () => {
    vi.mocked(getDb).mockResolvedValue(fakeDb([]).db as never);
    await expect(getAppointmentTokenById(404)).resolves.toBeNull();
  });

  it("fails closed when token storage is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(getAppointmentTokenById(8)).rejects.toThrow(
      "Database not available"
    );
  });
});
