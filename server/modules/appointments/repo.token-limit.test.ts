import { beforeEach, describe, expect, it, vi } from "vitest";

type TokenRow = {
  id: number;
  appointmentId: number;
  role: "patient" | "doctor";
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const tokenRows: TokenRow[] = [];
let tokenIdSeq = 1;
let clock = 1;
let pendingRevokeIds: number[] = [];
let selectCallIndex = 0;

function buildFakeDb() {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            // First select in createAppointmentTokenIfMissing: duplicate check.
            return [] as Array<{ id: number }>;
          }),
          orderBy: vi.fn(async () => {
            // Second select: active rows ordered desc by createdAt/id.
            const active = tokenRows
              .filter(row => row.revokedAt === null && row.expiresAt.getTime() > Date.now())
              .sort((a, b) => {
                const byCreatedAt = b.createdAt.getTime() - a.createdAt.getTime();
                if (byCreatedAt !== 0) {
                  return byCreatedAt;
                }
                return b.id - a.id;
              })
              .map(row => ({ id: row.id, createdAt: row.createdAt }));
            pendingRevokeIds = active.slice(5).map(row => row.id);
            selectCallIndex += 1;
            return active;
          }),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: {
        appointmentId: number;
        role: "patient" | "doctor";
        tokenHash: string;
        expiresAt: Date;
        revokedAt: Date | null;
      }) => {
        const now = new Date(1_700_000_000_000 + clock * 1000);
        clock += 1;
        tokenRows.push({
          id: tokenIdSeq++,
          appointmentId: values.appointmentId,
          role: values.role,
          tokenHash: values.tokenHash,
          expiresAt: values.expiresAt,
          revokedAt: values.revokedAt,
          createdAt: now,
          updatedAt: now,
        });
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((setValues: { revokedAt: Date; updatedAt: Date }) => ({
        where: vi.fn(async () => {
          for (const row of tokenRows) {
            if (pendingRevokeIds.includes(row.id) && row.revokedAt === null) {
              row.revokedAt = setValues.revokedAt;
              row.updatedAt = setValues.updatedAt;
            }
          }
        }),
      })),
    })),
  };
}

const fakeDb = buildFakeDb();

vi.mock("../../db", () => ({
  getDb: vi.fn(async () => fakeDb),
}));

import { createAppointmentTokenIfMissing } from "./repo";

describe("appointment token limit", () => {
  beforeEach(() => {
    tokenRows.length = 0;
    tokenIdSeq = 1;
    clock = 1;
    pendingRevokeIds = [];
    selectCallIndex = 0;
    vi.clearAllMocks();
  });

  it("keeps at most 5 active tokens per appointment+role and revokes oldest overflow", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    for (let i = 1; i <= 20; i += 1) {
      await createAppointmentTokenIfMissing({
        appointmentId: 101,
        role: "patient",
        tokenHash: `hash_${i}`,
        expiresAt,
      });
    }

    const active = tokenRows.filter(
      row => row.appointmentId === 101 && row.role === "patient" && row.revokedAt === null
    );
    const revoked = tokenRows.filter(
      row => row.appointmentId === 101 && row.role === "patient" && row.revokedAt !== null
    );

    expect(active).toHaveLength(5);
    expect(revoked).toHaveLength(15);

    // Most recent 5 remain active.
    expect(active.map(row => row.tokenHash).sort()).toEqual(
      ["hash_16", "hash_17", "hash_18", "hash_19", "hash_20"].sort()
    );
    // Older tokens are revoked and no longer active.
    expect(active.some(row => row.tokenHash === "hash_1")).toBe(false);
    expect(revoked.some(row => row.tokenHash === "hash_1")).toBe(true);
  });
});
