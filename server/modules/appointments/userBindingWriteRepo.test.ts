import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { bindAppointmentsToUserByEmail } from "./userBindingWriteRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("appointment user binding repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("binds every appointment matching the verified email to the user", async () => {
    const where = vi.fn(async () => undefined);
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    vi.mocked(getDb).mockResolvedValue({ update } as never);

    await expect(
      bindAppointmentsToUserByEmail("patient@example.com", 501)
    ).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith(expect.anything());
    expect(set).toHaveBeenCalledWith({ userId: 501 });
    expect(where).toHaveBeenCalledTimes(1);
  });

  it("fails without attempting a write when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(
      bindAppointmentsToUserByEmail("patient@example.com", 501)
    ).rejects.toThrow("Database not available");
  });
});
