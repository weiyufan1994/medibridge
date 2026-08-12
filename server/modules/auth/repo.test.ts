import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

import {
  createFormalUser,
  createGuestUser,
  findOrCreateFormalUserByEmail,
  findOrCreateGuestUserByDeviceId,
  getFormalUserByEmail,
  getGuestUserByDeviceId,
  getUserById,
  getUserByOpenId,
  updateUserById,
  upsertUser,
} from "./repo";

function user(id = 1) {
  return {
    id,
    openId: `open-${id}`,
    email: `user-${id}@example.com`,
    isGuest: 0,
  };
}

function selectDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select }, select, from, where, limit };
}

function insertDb() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert }, insert, values, onConflictDoUpdate };
}

function updateDb() {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { db: { update }, update, set, where };
}

describe("auth repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates upserts and preserves explicit nullable fields", async () => {
    await expect(upsertUser({ openId: "" } as never)).rejects.toThrow(
      "User openId is required for upsert"
    );

    const executor = insertDb();
    vi.mocked(getDb).mockResolvedValue(executor.db as never);
    const lastSignedIn = new Date("2026-01-01T00:00:00.000Z");
    await upsertUser({
      openId: "oauth-user",
      name: null,
      email: "patient@example.com",
      loginMethod: "oauth",
      role: "pro",
      lastSignedIn,
    } as never);

    expect(executor.values).toHaveBeenCalledWith({
      openId: "oauth-user",
      name: null,
      email: "patient@example.com",
      loginMethod: "oauth",
      role: "pro",
      lastSignedIn,
    });
    expect(executor.onConflictDoUpdate).toHaveBeenCalledWith({
      target: expect.anything(),
      set: {
        name: null,
        email: "patient@example.com",
        loginMethod: "oauth",
        role: "pro",
        lastSignedIn,
      },
    });
  });

  it("uses a timestamp-only conflict update and handles unavailable storage", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    await expect(
      upsertUser({ openId: "no-db" } as never)
    ).resolves.toBeUndefined();

    const executor = insertDb();
    vi.mocked(getDb).mockResolvedValue(executor.db as never);
    await upsertUser({ openId: "minimal-user" } as never);
    expect(executor.values).toHaveBeenCalledWith({
      openId: "minimal-user",
      lastSignedIn: expect.any(Date),
    });
    expect(executor.onConflictDoUpdate).toHaveBeenCalledWith({
      target: expect.anything(),
      set: { lastSignedIn: expect.any(Date) },
    });
  });

  it("propagates an upsert database failure", async () => {
    const executor = insertDb();
    executor.onConflictDoUpdate.mockRejectedValue(new Error("write failed"));
    vi.mocked(getDb).mockResolvedValue(executor.db as never);
    await expect(upsertUser({ openId: "broken" } as never)).rejects.toThrow(
      "write failed"
    );
  });

  it.each([
    ["open id", getUserByOpenId, "open-4"],
    ["user id", getUserById, 4],
    ["guest device", getGuestUserByDeviceId, "device-4"],
    ["formal email", getFormalUserByEmail, "user-4@example.com"],
  ])(
    "returns the first %s match and undefined without storage",
    async (_label, lookup, value) => {
      const selected = selectDb([user(4)]);
      vi.mocked(getDb).mockResolvedValueOnce(selected.db as never);
      await expect(lookup(value as never)).resolves.toEqual(user(4));
      expect(selected.limit).toHaveBeenCalledWith(1);

      vi.mocked(getDb).mockResolvedValueOnce(null);
      await expect(lookup(value as never)).resolves.toBeUndefined();
    }
  );

  it("returns undefined for an empty lookup result", async () => {
    vi.mocked(getDb).mockResolvedValue(selectDb([]).db as never);
    await expect(getUserByOpenId("missing")).resolves.toBeUndefined();
  });

  it("creates guest and formal users, then reloads their identities", async () => {
    const guestInsert = insertDb();
    const guestSelect = selectDb([user(10)]);
    vi.mocked(getDb)
      .mockResolvedValueOnce(guestInsert.db as never)
      .mockResolvedValueOnce(guestSelect.db as never);
    await expect(createGuestUser("device-10")).resolves.toEqual(user(10));
    expect(guestInsert.values).toHaveBeenCalledWith({
      deviceId: "device-10",
      isGuest: 1,
      role: "free",
      loginMethod: "guest",
      lastSignedIn: expect.any(Date),
    });

    const formalInsert = insertDb();
    const formalSelect = selectDb([user(11)]);
    vi.mocked(getDb)
      .mockResolvedValueOnce(formalInsert.db as never)
      .mockResolvedValueOnce(formalSelect.db as never);
    await expect(
      createFormalUser({
        email: "formal@example.com",
        openId: "formal-open-id",
        loginMethod: "otp",
      })
    ).resolves.toEqual(user(11));
    expect(formalInsert.values).toHaveBeenCalledWith({
      email: "formal@example.com",
      openId: "formal-open-id",
      isGuest: 0,
      role: "free",
      loginMethod: "otp",
      lastSignedIn: expect.any(Date),
    });
  });

  it("requires storage for guest, formal, and update writes", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(createGuestUser("device")).rejects.toThrow(
      "Database not available"
    );
    await expect(
      createFormalUser({ email: "a@b.com", openId: "open", loginMethod: "otp" })
    ).rejects.toThrow("Database not available");
    await expect(updateUserById(1, { role: "pro" })).rejects.toThrow(
      "Database not available"
    );
  });

  it("updates a user by id", async () => {
    const executor = updateDb();
    vi.mocked(getDb).mockResolvedValue(executor.db as never);
    await updateUserById(7, { role: "ops" });
    expect(executor.set).toHaveBeenCalledWith({ role: "ops" });
    expect(executor.where).toHaveBeenCalledOnce();
  });

  it("returns an existing guest without inserting", async () => {
    vi.mocked(getDb).mockResolvedValue(selectDb([user(20)]).db as never);
    await expect(findOrCreateGuestUserByDeviceId("device-20")).resolves.toEqual(
      user(20)
    );
    expect(getDb).toHaveBeenCalledOnce();
  });

  it("recovers guest creation races and rethrows unrecoverable failures", async () => {
    const empty = selectDb([]);
    const failedInsert = insertDb();
    failedInsert.values.mockImplementation(() => {
      throw new Error("unique violation");
    });
    vi.mocked(getDb)
      .mockResolvedValueOnce(empty.db as never)
      .mockResolvedValueOnce(failedInsert.db as never)
      .mockResolvedValueOnce(selectDb([user(21)]).db as never);
    await expect(findOrCreateGuestUserByDeviceId("device-21")).resolves.toEqual(
      user(21)
    );

    vi.mocked(getDb)
      .mockResolvedValueOnce(selectDb([]).db as never)
      .mockResolvedValueOnce(failedInsert.db as never)
      .mockResolvedValueOnce(selectDb([]).db as never);
    await expect(findOrCreateGuestUserByDeviceId("device-22")).rejects.toThrow(
      "unique violation"
    );
  });

  it("updates existing formal identities with and without an open id", async () => {
    const updateMissing = updateDb();
    vi.mocked(getDb)
      .mockResolvedValueOnce(
        selectDb([{ ...user(30), openId: "" }]).db as never
      )
      .mockResolvedValueOnce(updateMissing.db as never)
      .mockResolvedValueOnce(selectDb([user(30)]).db as never);
    await expect(
      findOrCreateFormalUserByEmail({
        email: "user-30@example.com",
        openId: "open-30",
        loginMethod: "otp",
      })
    ).resolves.toEqual(user(30));
    expect(updateMissing.set).toHaveBeenCalledWith(
      expect.objectContaining({ openId: "open-30", isGuest: 0 })
    );

    const updateExisting = updateDb();
    vi.mocked(getDb)
      .mockResolvedValueOnce(selectDb([user(31)]).db as never)
      .mockResolvedValueOnce(updateExisting.db as never)
      .mockResolvedValueOnce(selectDb([]).db as never);
    await expect(
      findOrCreateFormalUserByEmail({
        email: "user-31@example.com",
        openId: "ignored",
        loginMethod: "magic_link",
      })
    ).resolves.toEqual(user(31));
    expect(updateExisting.set).toHaveBeenCalledWith(
      expect.objectContaining({ loginMethod: "magic_link", isGuest: 0 })
    );
  });

  it("recovers formal-user creation races", async () => {
    const failedInsert = insertDb();
    failedInsert.values.mockImplementation(() => {
      throw new Error("unique violation");
    });
    vi.mocked(getDb)
      .mockResolvedValueOnce(selectDb([]).db as never)
      .mockResolvedValueOnce(failedInsert.db as never)
      .mockResolvedValueOnce(selectDb([user(40)]).db as never);
    await expect(
      findOrCreateFormalUserByEmail({
        email: "user-40@example.com",
        openId: "open-40",
        loginMethod: "otp",
      })
    ).resolves.toEqual(user(40));
  });
});
