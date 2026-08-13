import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

import { getDb } from "../../db";
import {
  getActiveAppointmentTokenByHash,
  getAppointmentTokenByHash,
  getAppointmentTokenById,
  getAppointmentTokenCooldownRemainingSeconds,
  getLatestAppointmentTokenIssuedAt,
  listActiveAppointmentTokens,
} from "./tokenReadRepo";

function limitedDb(rows: unknown[]) {
  const limit = vi.fn(async () => rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ limit, orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select }, select, from, where, orderBy, limit };
}

function listDb(rows: unknown[]) {
  const where = vi.fn(async () => rows);
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return { db: { select }, select, from, where };
}

function tokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 8,
    appointmentId: 42,
    role: "doctor",
    tokenHash: "a".repeat(64),
    expiresAt: new Date("2026-08-13T01:00:00.000Z"),
    lastUsedAt: null,
    useCount: 0,
    maxUses: 100,
    revokedAt: null,
    revokeReason: null,
    ipFirstSeen: null,
    uaFirstSeen: null,
    ...overrides,
  };
}

describe("appointment token read repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists active tokens using the supplied expiry boundary", async () => {
    const now = new Date("2026-08-13T00:00:00.000Z");
    const rows = [tokenRow()];
    const executor = listDb(rows);
    vi.mocked(getDb).mockResolvedValue(executor.db as never);

    await expect(
      listActiveAppointmentTokens({ appointmentId: 42, now })
    ).resolves.toBe(rows);

    expect(executor.select).toHaveBeenCalledTimes(1);
    expect(executor.where).toHaveBeenCalledTimes(1);
  });

  it("uses the current time when listing without an explicit boundary", async () => {
    const executor = listDb([]);
    vi.mocked(getDb).mockResolvedValue(executor.db as never);

    await expect(
      listActiveAppointmentTokens({ appointmentId: 42 })
    ).resolves.toEqual([]);
  });

  it("loads an active token by hash with and without a role filter", async () => {
    const row = tokenRow();
    const withRole = limitedDb([row]);
    const withoutRole = limitedDb([row]);
    vi.mocked(getDb)
      .mockResolvedValueOnce(withRole.db as never)
      .mockResolvedValueOnce(withoutRole.db as never);

    await expect(
      getActiveAppointmentTokenByHash({
        tokenHash: "a".repeat(64),
        role: "doctor",
        now: new Date("2026-08-13T00:00:00.000Z"),
      })
    ).resolves.toBe(row);
    await expect(
      getActiveAppointmentTokenByHash({ tokenHash: "a".repeat(64) })
    ).resolves.toBe(row);

    expect(withRole.limit).toHaveBeenCalledWith(1);
    expect(withoutRole.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when no active token matches", async () => {
    vi.mocked(getDb).mockResolvedValue(limitedDb([]).db as never);

    await expect(
      getActiveAppointmentTokenByHash({ tokenHash: "missing" })
    ).resolves.toBeNull();
  });

  it("loads a token by hash regardless of lifecycle state", async () => {
    const row = tokenRow({ revokedAt: new Date("2026-08-13T00:30:00.000Z") });
    const executor = limitedDb([row]);
    vi.mocked(getDb).mockResolvedValue(executor.db as never);

    await expect(getAppointmentTokenByHash("a".repeat(64))).resolves.toBe(row);
    expect(executor.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when a token hash is unknown", async () => {
    vi.mocked(getDb).mockResolvedValue(limitedDb([]).db as never);
    await expect(getAppointmentTokenByHash("missing")).resolves.toBeNull();
  });

  it("loads the source token row by its immutable id", async () => {
    const row = tokenRow();
    const executor = limitedDb([row]);
    vi.mocked(getDb).mockResolvedValue(executor.db as never);

    await expect(getAppointmentTokenById(8)).resolves.toBe(row);
    expect(executor.limit).toHaveBeenCalledWith(1);
  });

  it("returns null when the source token id is unknown", async () => {
    vi.mocked(getDb).mockResolvedValue(limitedDb([]).db as never);
    await expect(getAppointmentTokenById(404)).resolves.toBeNull();
  });

  it("returns the latest token issue timestamp or null", async () => {
    const createdAt = new Date("2026-08-13T00:15:00.000Z");
    const found = limitedDb([{ createdAt }]);
    const missing = limitedDb([]);
    vi.mocked(getDb)
      .mockResolvedValueOnce(found.db as never)
      .mockResolvedValueOnce(missing.db as never);

    await expect(
      getLatestAppointmentTokenIssuedAt({ appointmentId: 42, role: "patient" })
    ).resolves.toBe(createdAt);
    await expect(
      getLatestAppointmentTokenIssuedAt({ appointmentId: 42, role: "patient" })
    ).resolves.toBeNull();

    expect(found.orderBy).toHaveBeenCalledTimes(1);
    expect(found.limit).toHaveBeenCalledWith(1);
  });

  it("normalizes cooldown query values and missing rows to numbers", async () => {
    const found = limitedDb([{ remainingSeconds: "45" }]);
    const missing = limitedDb([]);
    vi.mocked(getDb)
      .mockResolvedValueOnce(found.db as never)
      .mockResolvedValueOnce(missing.db as never);
    const input = {
      appointmentId: 42,
      role: "doctor" as const,
      cooldownSeconds: 60,
    };

    await expect(
      getAppointmentTokenCooldownRemainingSeconds(input)
    ).resolves.toBe(45);
    await expect(
      getAppointmentTokenCooldownRemainingSeconds(input)
    ).resolves.toBe(0);
  });

  it.each([
    ["list", () => listActiveAppointmentTokens({ appointmentId: 42 })],
    [
      "active hash",
      () => getActiveAppointmentTokenByHash({ tokenHash: "a".repeat(64) }),
    ],
    ["hash", () => getAppointmentTokenByHash("a".repeat(64))],
    ["id", () => getAppointmentTokenById(8)],
    [
      "latest issue",
      () =>
        getLatestAppointmentTokenIssuedAt({
          appointmentId: 42,
          role: "patient",
        }),
    ],
    [
      "cooldown",
      () =>
        getAppointmentTokenCooldownRemainingSeconds({
          appointmentId: 42,
          role: "patient",
          cooldownSeconds: 60,
        }),
    ],
  ])(
    "fails closed for %s queries when storage is unavailable",
    async (_, query) => {
      vi.mocked(getDb).mockResolvedValue(null);
      await expect(query()).rejects.toThrow("Database not available");
    }
  );
});
