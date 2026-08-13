import { beforeEach, describe, expect, it, vi } from "vitest";
import { appointmentMessages, patientSessions } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { reassignVisitAssetsFromGuest } from "./guestAssetRepo";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

describe("visit guest asset repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reassigns patient sessions and messages to the formal user", async () => {
    const sessionWhere = vi.fn(async () => undefined);
    const messageWhere = vi.fn(async () => undefined);
    const sessionSet = vi.fn(() => ({ where: sessionWhere }));
    const messageSet = vi.fn(() => ({ where: messageWhere }));
    const update = vi
      .fn()
      .mockReturnValueOnce({ set: sessionSet })
      .mockReturnValueOnce({ set: messageSet });
    vi.mocked(getDb).mockResolvedValue({ update } as never);

    await expect(
      reassignVisitAssetsFromGuest({ guestUserId: 41, formalUserId: 501 })
    ).resolves.toBeUndefined();

    expect(update.mock.calls).toEqual([
      [patientSessions],
      [appointmentMessages],
    ]);
    expect(sessionSet).toHaveBeenCalledWith({ userId: 501 });
    expect(messageSet).toHaveBeenCalledWith({ userId: 501 });
    expect(sessionWhere).toHaveBeenCalledTimes(1);
    expect(messageWhere).toHaveBeenCalledTimes(1);
  });

  it("fails before writing when the database is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(
      reassignVisitAssetsFromGuest({ guestUserId: 41, formalUserId: 501 })
    ).rejects.toThrow("Database not available");
  });

  it("does not update messages when session reassignment fails", async () => {
    const sessionWhere = vi.fn(async () => {
      throw new Error("session update failed");
    });
    const update = vi.fn(() => ({
      set: vi.fn(() => ({ where: sessionWhere })),
    }));
    vi.mocked(getDb).mockResolvedValue({ update } as never);

    await expect(
      reassignVisitAssetsFromGuest({ guestUserId: 41, formalUserId: 501 })
    ).rejects.toThrow("session update failed");

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(patientSessions);
  });
});
