import { desc, eq } from "drizzle-orm";
import {
  retentionCleanupAudits,
  visitRetentionPolicies,
} from "../../../drizzle/schema";
import { getDb } from "../../db";

export const DEFAULT_RETENTION_DAYS = {
  free: 7,
  paid: 180,
} as const;

export type RetentionTier = keyof typeof DEFAULT_RETENTION_DAYS;

export async function listRetentionPolicies() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(visitRetentionPolicies)
    .orderBy(visitRetentionPolicies.tier);
}

export async function ensureDefaultRetentionPolicies() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .insert(visitRetentionPolicies)
    .values([
      {
        tier: "free",
        retentionDays: DEFAULT_RETENTION_DAYS.free,
        enabled: 1,
      },
      {
        tier: "paid",
        retentionDays: DEFAULT_RETENTION_DAYS.paid,
        enabled: 1,
      },
    ])
    .onConflictDoNothing();

  return listRetentionPolicies();
}

export async function upsertRetentionPolicy(input: {
  tier: RetentionTier;
  retentionDays: number;
  enabled: boolean;
  updatedBy?: number | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .insert(visitRetentionPolicies)
    .values({
      tier: input.tier,
      retentionDays: input.retentionDays,
      enabled: input.enabled ? 1 : 0,
      updatedBy: input.updatedBy ?? null,
    })
    .onConflictDoUpdate({
      target: visitRetentionPolicies.tier,
      set: {
        retentionDays: input.retentionDays,
        enabled: input.enabled ? 1 : 0,
        updatedBy: input.updatedBy ?? null,
        updatedAt: new Date(),
      },
    });

  const rows = await db
    .select()
    .from(visitRetentionPolicies)
    .where(eq(visitRetentionPolicies.tier, input.tier))
    .limit(1);

  return rows[0] ?? null;
}

export async function listRetentionCleanupAudits(limit = 20) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(retentionCleanupAudits)
    .orderBy(
      desc(retentionCleanupAudits.createdAt),
      desc(retentionCleanupAudits.id)
    )
    .limit(limit);
}
