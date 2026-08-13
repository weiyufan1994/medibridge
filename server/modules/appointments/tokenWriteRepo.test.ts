import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../../db";
import {
  createAppointmentTokenIfMissing,
  revokeAppointmentTokens,
  saveTokenFirstSeen,
  updateActiveAppointmentTokenExpiry,
  updateTokenUsageIfAllowed,
} from "./tokenWriteRepo";

const baseNow = new Date("2026-08-13T00:00:00.000Z");

function buildUpdateExecutor(result: unknown = { rowCount: 1 }) {
  const where = vi.fn(async () => result);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { executor: { update }, update, set, where };
}

function buildCreateExecutor(input: {
  existing?: Array<{ id: number }>;
  activeRows?: Array<{ id: number; createdAt: Date }>;
}) {
  const duplicateLimit = vi.fn(async () => input.existing ?? []);
  const activeOrderBy = vi.fn(async () => input.activeRows ?? []);
  const select = vi
    .fn()
    .mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: duplicateLimit })),
      })),
    }))
    .mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ orderBy: activeOrderBy })),
      })),
    }));
  const values = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values }));
  const updateWhere = vi.fn(async () => ({ rowCount: 1 }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  return {
    executor: { select, insert, update },
    select,
    duplicateLimit,
    activeOrderBy,
    insert,
    values,
    update,
    updateSet,
    updateWhere,
  };
}

describe("appointment token write repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates only active token expiry with a shared timestamp", async () => {
    const expiresAt = new Date("2026-08-14T00:00:00.000Z");
    const db = buildUpdateExecutor();
    vi.mocked(getDb).mockResolvedValue(db.executor as never);

    await updateActiveAppointmentTokenExpiry({ appointmentId: 42, expiresAt });

    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.set).toHaveBeenCalledWith({ expiresAt, updatedAt: baseNow });
    expect(db.where).toHaveBeenCalledTimes(1);
  });

  it("fails closed when expiry storage is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(
      updateActiveAppointmentTokenExpiry({
        appointmentId: 42,
        expiresAt: new Date("2026-08-14T00:00:00.000Z"),
      })
    ).rejects.toThrow("Database not available");
  });

  it("inserts a missing token with normalized optional values", async () => {
    const db = buildCreateExecutor({});
    const expiresAt = new Date("2026-08-14T00:00:00.000Z");

    await createAppointmentTokenIfMissing({
      appointmentId: 43,
      role: "patient",
      tokenHash: "token-hash",
      expiresAt,
      dbExecutor: db.executor as never,
    });

    expect(db.values).toHaveBeenCalledWith({
      appointmentId: 43,
      role: "patient",
      tokenHash: "token-hash",
      expiresAt,
      maxUses: 1,
      createdBy: null,
      revokedAt: null,
    });
    expect(db.activeOrderBy).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("preserves explicit token write values", async () => {
    const db = buildCreateExecutor({});
    const expiresAt = new Date("2026-08-14T00:00:00.000Z");
    const revokedAt = new Date("2026-08-13T01:00:00.000Z");

    await createAppointmentTokenIfMissing({
      appointmentId: 44,
      role: "doctor",
      tokenHash: "doctor-hash",
      expiresAt,
      maxUses: 30,
      createdBy: "staff:8",
      revokedAt,
      dbExecutor: db.executor as never,
    });

    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({ maxUses: 30, createdBy: "staff:8", revokedAt })
    );
  });

  it("does not insert a duplicate token and still enforces the active limit", async () => {
    const db = buildCreateExecutor({ existing: [{ id: 9 }] });

    await createAppointmentTokenIfMissing({
      appointmentId: 45,
      role: "patient",
      tokenHash: "existing-hash",
      expiresAt: new Date("2026-08-14T00:00:00.000Z"),
      dbExecutor: db.executor as never,
    });

    expect(db.insert).not.toHaveBeenCalled();
    expect(db.activeOrderBy).toHaveBeenCalledTimes(1);
  });

  it("revokes active tokens beyond the newest five", async () => {
    const activeRows = Array.from({ length: 7 }, (_, index) => ({
      id: 7 - index,
      createdAt: new Date(baseNow.getTime() - index * 1_000),
    }));
    const db = buildCreateExecutor({ activeRows });

    await createAppointmentTokenIfMissing({
      appointmentId: 46,
      role: "doctor",
      tokenHash: "new-hash",
      expiresAt: new Date("2026-08-14T00:00:00.000Z"),
      dbExecutor: db.executor as never,
    });

    expect(db.updateSet).toHaveBeenCalledWith({
      revokedAt: baseNow,
      updatedAt: baseNow,
    });
    expect(db.updateWhere).toHaveBeenCalledTimes(1);
  });

  it("fails closed when token creation storage is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);

    await expect(
      createAppointmentTokenIfMissing({
        appointmentId: 47,
        role: "patient",
        tokenHash: "hash",
        expiresAt: new Date("2026-08-14T00:00:00.000Z"),
      })
    ).rejects.toThrow("Database not available");
  });

  it("increments token usage at an explicit time and returns affected rows", async () => {
    const now = new Date("2026-08-13T01:00:00.000Z");
    const db = buildUpdateExecutor({ rowCount: 1 });
    vi.mocked(getDb).mockResolvedValue(db.executor as never);

    await expect(updateTokenUsageIfAllowed({ tokenId: 12, now })).resolves.toBe(
      1
    );
    expect(db.set).toHaveBeenCalledWith({
      useCount: expect.anything(),
      lastUsedAt: now,
      updatedAt: now,
    });
  });

  it("uses the current time and reports a rejected usage update", async () => {
    const db = buildUpdateExecutor({ rowCount: 0 });
    vi.mocked(getDb).mockResolvedValue(db.executor as never);

    await expect(updateTokenUsageIfAllowed({ tokenId: 13 })).resolves.toBe(0);
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ lastUsedAt: baseNow, updatedAt: baseNow })
    );
  });

  it("fails closed when usage storage is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(updateTokenUsageIfAllowed({ tokenId: 14 })).rejects.toThrow(
      "Database not available"
    );
  });

  it("trims and bounds first-seen metadata", async () => {
    const db = buildUpdateExecutor();
    vi.mocked(getDb).mockResolvedValue(db.executor as never);
    const longIp = `  ${"1".repeat(70)}  `;
    const longUserAgent = `  ${"a".repeat(520)}  `;

    await saveTokenFirstSeen({
      tokenId: 15,
      ip: longIp,
      userAgent: longUserAgent,
    });

    expect(db.set).toHaveBeenCalledWith({
      ipFirstSeen: "1".repeat(64),
      uaFirstSeen: "a".repeat(512),
    });
    expect(db.where).toHaveBeenCalledTimes(1);
  });

  it("stores either first-seen field independently", async () => {
    const ipDb = buildUpdateExecutor();
    const userAgentDb = buildUpdateExecutor();
    vi.mocked(getDb)
      .mockResolvedValueOnce(ipDb.executor as never)
      .mockResolvedValueOnce(userAgentDb.executor as never);

    await saveTokenFirstSeen({ tokenId: 16, ip: " 127.0.0.1 " });
    await saveTokenFirstSeen({ tokenId: 17, userAgent: " browser/1.0 " });

    expect(ipDb.set).toHaveBeenCalledWith({ ipFirstSeen: "127.0.0.1" });
    expect(userAgentDb.set).toHaveBeenCalledWith({
      uaFirstSeen: "browser/1.0",
    });
  });

  it("skips storage when first-seen metadata is empty", async () => {
    const db = buildUpdateExecutor();
    vi.mocked(getDb).mockResolvedValue(db.executor as never);

    await saveTokenFirstSeen({ tokenId: 18, ip: "  ", userAgent: null });

    expect(db.update).not.toHaveBeenCalled();
  });

  it("fails closed when first-seen storage is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(
      saveTokenFirstSeen({ tokenId: 19, ip: "127.0.0.1" })
    ).rejects.toThrow("Database not available");
  });

  it("revokes with every supplied scope and returns affected rows", async () => {
    const now = new Date("2026-08-13T02:00:00.000Z");
    const db = buildUpdateExecutor({ rowCount: 2 });

    await expect(
      revokeAppointmentTokens({
        appointmentId: 51,
        role: "doctor",
        tokenHash: "doctor-hash",
        reason: "reissued",
        now,
        dbExecutor: db.executor as never,
      })
    ).resolves.toBe(2);
    expect(db.set).toHaveBeenCalledWith({
      revokedAt: now,
      revokeReason: "reissued",
      updatedAt: now,
    });
  });

  it("uses current time and manual reason when revoking without filters", async () => {
    const db = buildUpdateExecutor({ affectedRows: 3 });

    await expect(
      revokeAppointmentTokens({ dbExecutor: db.executor as never })
    ).resolves.toBe(3);
    expect(db.set).toHaveBeenCalledWith({
      revokedAt: baseNow,
      revokeReason: "manual_revoke",
      updatedAt: baseNow,
    });
  });

  it("normalizes a null revoke reason to the manual reason", async () => {
    const db = buildUpdateExecutor({ rowCount: 1 });

    await revokeAppointmentTokens({
      appointmentId: 52,
      reason: null,
      dbExecutor: db.executor as never,
    });

    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ revokeReason: "manual_revoke" })
    );
  });

  it("fails closed when revoke storage is unavailable", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    await expect(
      revokeAppointmentTokens({ appointmentId: 53 })
    ).rejects.toThrow("Database not available");
  });
});
