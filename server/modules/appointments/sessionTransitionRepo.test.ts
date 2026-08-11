import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import { markAppointmentInSessionIfNeeded } from "./sessionTransitionRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

function buildExecutor(status: string | undefined, affectedRows = 1) {
  const limit = vi.fn(async () => (status ? [{ status }] : []));
  const updateWhere = vi.fn(async () => ({ rowCount: affectedRows }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));

  return {
    executor: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit })),
        })),
      })),
      update: vi.fn(() => ({ set: updateSet })),
    },
    updateSet,
  };
}

describe("appointment in-session transition repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves a paid appointment to active and returns the prior status", async () => {
    const { executor, updateSet } = buildExecutor("paid");
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(markAppointmentInSessionIfNeeded(201)).resolves.toBe("paid");
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", updatedAt: expect.any(Date) })
    );
  });

  it("does not update an appointment outside the paid state", async () => {
    const { executor, updateSet } = buildExecutor("active");
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(markAppointmentInSessionIfNeeded(202)).resolves.toBeNull();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("returns null when a concurrent state change prevents the update", async () => {
    const { executor } = buildExecutor("paid", 0);
    vi.mocked(getDb).mockResolvedValue(executor as never);

    await expect(markAppointmentInSessionIfNeeded(203)).resolves.toBeNull();
  });
});
