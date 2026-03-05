import { and, desc, eq, lt, sql } from "drizzle-orm";
import {
  appointmentMessages,
  appointments,
  appointmentVisitSummaries,
  retentionCleanupAudits,
  visitRetentionPolicies,
} from "../../../drizzle/schema";
import { getDb } from "../../db";

const DEFAULT_RETENTION_DAYS = {
  free: 7,
  paid: 180,
} as const;

export type RetentionTier = keyof typeof DEFAULT_RETENTION_DAYS;

export async function getVisitSummaryByAppointmentId(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(appointmentVisitSummaries)
    .where(eq(appointmentVisitSummaries.appointmentId, appointmentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertVisitSummary(input: {
  appointmentId: number;
  summaryZh: string;
  summaryEn: string;
  source: "llm" | "fallback";
  generatedBy?: number | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .insert(appointmentVisitSummaries)
    .values({
      appointmentId: input.appointmentId,
      summaryZh: input.summaryZh,
      summaryEn: input.summaryEn,
      source: input.source,
      generatedBy: input.generatedBy ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        summaryZh: input.summaryZh,
        summaryEn: input.summaryEn,
        source: input.source,
        generatedBy: input.generatedBy ?? null,
        updatedAt: new Date(),
      },
    });

  return getVisitSummaryByAppointmentId(input.appointmentId);
}

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
    .onDuplicateKeyUpdate({
      set: {
        tier: sql`values(${visitRetentionPolicies.tier})`,
      },
    });

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
    .onDuplicateKeyUpdate({
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
    .orderBy(desc(retentionCleanupAudits.createdAt), desc(retentionCleanupAudits.id))
    .limit(limit);
}

function toPolicyMap(rows: Awaited<ReturnType<typeof listRetentionPolicies>>) {
  const free = rows.find(item => item.tier === "free");
  const paid = rows.find(item => item.tier === "paid");

  return {
    freeRetentionDays: Math.max(1, Number(free?.retentionDays ?? DEFAULT_RETENTION_DAYS.free)),
    paidRetentionDays: Math.max(1, Number(paid?.retentionDays ?? DEFAULT_RETENTION_DAYS.paid)),
    freeEnabled: Number(free?.enabled ?? 1) === 1,
    paidEnabled: Number(paid?.enabled ?? 1) === 1,
  };
}

function toPaidTierPredicate() {
  return sql`(
    ${appointments.paymentStatus} = 'paid'
    OR ${appointments.paymentStatus} = 'refunded'
    OR ${appointments.paidAt} is not null
  )`;
}

function toFreeTierPredicate() {
  return sql`(
    ${appointments.paymentStatus} <> 'paid'
    AND ${appointments.paymentStatus} <> 'refunded'
    AND ${appointments.paidAt} is null
  )`;
}

export async function runRetentionCleanup(input: {
  dryRun?: boolean;
  createdBy?: number | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const policies = await ensureDefaultRetentionPolicies();
  const policyMap = toPolicyMap(policies);
  const now = new Date();
  const freeCutoff = new Date(now.getTime() - policyMap.freeRetentionDays * 24 * 60 * 60 * 1000);
  const paidCutoff = new Date(now.getTime() - policyMap.paidRetentionDays * 24 * 60 * 60 * 1000);

  const paidPredicate = toPaidTierPredicate();
  const freePredicate = toFreeTierPredicate();

  const scannedRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointmentMessages);
  const scannedMessages = Number(scannedRows[0]?.count ?? 0);

  const freeCandidateRows = policyMap.freeEnabled
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(appointmentMessages)
        .innerJoin(appointments, eq(appointmentMessages.appointmentId, appointments.id))
        .where(and(freePredicate, lt(appointmentMessages.createdAt, freeCutoff)))
    : [{ count: 0 }];

  const paidCandidateRows = policyMap.paidEnabled
    ? await db
        .select({ count: sql<number>`count(*)` })
        .from(appointmentMessages)
        .innerJoin(appointments, eq(appointmentMessages.appointmentId, appointments.id))
        .where(and(paidPredicate, lt(appointmentMessages.createdAt, paidCutoff)))
    : [{ count: 0 }];

  const freeCandidates = Number(freeCandidateRows[0]?.count ?? 0);
  const paidCandidates = Number(paidCandidateRows[0]?.count ?? 0);

  let deletedMessages = 0;
  if (!input.dryRun) {
    if (policyMap.freeEnabled) {
      const freeDelete = await db
        .delete(appointmentMessages)
        .where(
          and(
            lt(appointmentMessages.createdAt, freeCutoff),
            sql`exists (
              select 1
              from ${appointments}
              where ${appointments.id} = ${appointmentMessages.appointmentId}
              and ${freePredicate}
            )`
          )
        );
      deletedMessages += Number((freeDelete as { affectedRows?: number }).affectedRows ?? 0);
    }

    if (policyMap.paidEnabled) {
      const paidDelete = await db
        .delete(appointmentMessages)
        .where(
          and(
            lt(appointmentMessages.createdAt, paidCutoff),
            sql`exists (
              select 1
              from ${appointments}
              where ${appointments.id} = ${appointmentMessages.appointmentId}
              and ${paidPredicate}
            )`
          )
        );
      deletedMessages += Number((paidDelete as { affectedRows?: number }).affectedRows ?? 0);
    }
  }

  const totalCandidates = freeCandidates + paidCandidates;

  await db.insert(retentionCleanupAudits).values({
    dryRun: input.dryRun ? 1 : 0,
    freeRetentionDays: policyMap.freeRetentionDays,
    paidRetentionDays: policyMap.paidRetentionDays,
    scannedMessages,
    deletedMessages: input.dryRun ? 0 : deletedMessages,
    detailsJson: {
      freeEnabled: policyMap.freeEnabled,
      paidEnabled: policyMap.paidEnabled,
      freeCutoff: freeCutoff.toISOString(),
      paidCutoff: paidCutoff.toISOString(),
      freeCandidates,
      paidCandidates,
      totalCandidates,
    },
    createdBy: input.createdBy ?? null,
  });

  return {
    dryRun: Boolean(input.dryRun),
    scannedMessages,
    deletedMessages: input.dryRun ? 0 : deletedMessages,
    totalCandidates,
    freeCandidates,
    paidCandidates,
    freeRetentionDays: policyMap.freeRetentionDays,
    paidRetentionDays: policyMap.paidRetentionDays,
    generatedAt: now.toISOString(),
  } as const;
}
