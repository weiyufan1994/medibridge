import { and, desc, eq, lt, sql } from "drizzle-orm";
import {
  aiChatSessions,
  appointmentMessages,
  appointments,
  patientSessions,
  retentionCleanupAudits,
  users,
} from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";
import {
  DEFAULT_RETENTION_DAYS,
  ensureDefaultRetentionPolicies,
  type listRetentionPolicies,
} from "./retentionPolicyRepo";

const DEFAULT_GUEST_RETENTION_DAYS = 30;

function getGuestRetentionDays() {
  const raw = Number(
    process.env.GUEST_RETENTION_DAYS ?? DEFAULT_GUEST_RETENTION_DAYS
  );
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_GUEST_RETENTION_DAYS;
  }
  return Math.floor(raw);
}

function toPolicyMap(rows: Awaited<ReturnType<typeof listRetentionPolicies>>) {
  const free = rows.find(item => item.tier === "free");
  const paid = rows.find(item => item.tier === "paid");

  return {
    freeRetentionDays: Math.max(
      1,
      Number(free?.retentionDays ?? DEFAULT_RETENTION_DAYS.free)
    ),
    paidRetentionDays: Math.max(
      1,
      Number(paid?.retentionDays ?? DEFAULT_RETENTION_DAYS.paid)
    ),
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

  const now = new Date();
  const guestRetentionDays = getGuestRetentionDays();
  const buildEmptyFailureResult = (failureReason: string) =>
    ({
      dryRun: Boolean(input.dryRun),
      scannedMessages: 0,
      deletedMessages: 0,
      totalCandidates: 0,
      freeCandidates: 0,
      paidCandidates: 0,
      freeRetentionDays: 0,
      paidRetentionDays: 0,
      guestCandidates: 0,
      deletedGuests: 0,
      guestRetentionDays,
      freeSampleIds: [] as number[],
      paidSampleIds: [] as number[],
      guestSampleIds: [] as number[],
      failureReason,
      generatedAt: new Date().toISOString(),
      nextCleanupAt: new Date(
        now.getTime() + 24 * 60 * 60 * 1000
      ).toISOString(),
    }) as const;

  try {
    const policies = await ensureDefaultRetentionPolicies();
    const policyMap = toPolicyMap(policies);
    const freeCutoff = new Date(
      now.getTime() - policyMap.freeRetentionDays * 24 * 60 * 60 * 1000
    );
    const paidCutoff = new Date(
      now.getTime() - policyMap.paidRetentionDays * 24 * 60 * 60 * 1000
    );
    const guestCutoff = new Date(
      now.getTime() - guestRetentionDays * 24 * 60 * 60 * 1000
    );

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
          .innerJoin(
            appointments,
            eq(appointmentMessages.appointmentId, appointments.id)
          )
          .where(
            and(freePredicate, lt(appointmentMessages.createdAt, freeCutoff))
          )
      : [{ count: 0 }];

    const paidCandidateRows = policyMap.paidEnabled
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(appointmentMessages)
          .innerJoin(
            appointments,
            eq(appointmentMessages.appointmentId, appointments.id)
          )
          .where(
            and(paidPredicate, lt(appointmentMessages.createdAt, paidCutoff))
          )
      : [{ count: 0 }];

    const freeCandidates = Number(freeCandidateRows[0]?.count ?? 0);
    const paidCandidates = Number(paidCandidateRows[0]?.count ?? 0);

    const freeSampleRows = policyMap.freeEnabled
      ? await db
          .select({ id: appointmentMessages.id })
          .from(appointmentMessages)
          .innerJoin(
            appointments,
            eq(appointmentMessages.appointmentId, appointments.id)
          )
          .where(
            and(freePredicate, lt(appointmentMessages.createdAt, freeCutoff))
          )
          .orderBy(desc(appointmentMessages.id))
          .limit(10)
      : [];

    const paidSampleRows = policyMap.paidEnabled
      ? await db
          .select({ id: appointmentMessages.id })
          .from(appointmentMessages)
          .innerJoin(
            appointments,
            eq(appointmentMessages.appointmentId, appointments.id)
          )
          .where(
            and(paidPredicate, lt(appointmentMessages.createdAt, paidCutoff))
          )
          .orderBy(desc(appointmentMessages.id))
          .limit(10)
      : [];

    const freeSampleIds = freeSampleRows.map(row => row.id);
    const paidSampleIds = paidSampleRows.map(row => row.id);
    const guestCandidatePredicate = and(
      eq(users.isGuest, 1),
      lt(users.updatedAt, guestCutoff),
      sql`${users.email} is null`,
      sql`not exists (
        select 1
        from ${appointments}
        where ${appointments.userId} = ${users.id}
      )`,
      sql`not exists (
        select 1
        from ${patientSessions}
        where ${patientSessions.userId} = ${users.id}
      )`,
      sql`not exists (
        select 1
        from ${aiChatSessions}
        where ${aiChatSessions.userId} = ${users.id}
      )`,
      sql`not exists (
        select 1
        from ${appointmentMessages}
        where ${appointmentMessages.userId} = ${users.id}
      )`
    );

    const guestCandidateRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(guestCandidatePredicate);
    const guestCandidates = Number(guestCandidateRows[0]?.count ?? 0);

    const guestSampleRows = await db
      .select({ id: users.id })
      .from(users)
      .where(guestCandidatePredicate)
      .orderBy(desc(users.id))
      .limit(10);
    const guestSampleIds = guestSampleRows.map(row => row.id);

    let deletedMessages = 0;
    let deletedGuests = 0;
    if (!input.dryRun) {
      if (policyMap.freeEnabled) {
        const freeDelete = await db.delete(appointmentMessages).where(
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
        deletedMessages += extractAffectedRows(freeDelete);
      }

      if (policyMap.paidEnabled) {
        const paidDelete = await db.delete(appointmentMessages).where(
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
        deletedMessages += extractAffectedRows(paidDelete);
      }

      const guestDelete = await db.delete(users).where(guestCandidatePredicate);
      deletedGuests = extractAffectedRows(guestDelete);
    }

    const totalCandidates = freeCandidates + paidCandidates + guestCandidates;
    const nextCleanupAt = new Date(
      now.getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

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
        guestCandidates,
        totalCandidates,
        nextCleanupAt,
        freeSampleIds,
        paidSampleIds,
        guestSampleIds,
        guestRetentionDays,
        guestCutoff: guestCutoff.toISOString(),
        deletedGuests: input.dryRun ? 0 : deletedGuests,
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
      guestCandidates,
      deletedGuests: input.dryRun ? 0 : deletedGuests,
      guestRetentionDays,
      freeSampleIds,
      paidSampleIds,
      guestSampleIds,
      nextCleanupAt,
      generatedAt: now.toISOString(),
    } as const;
  } catch (error) {
    const failureReason =
      error instanceof Error ? error.message : "Unknown cleanup error";
    const nextCleanupAt = new Date(
      now.getTime() + 24 * 60 * 60 * 1000
    ).toISOString();

    try {
      await db.insert(retentionCleanupAudits).values({
        dryRun: input.dryRun ? 1 : 0,
        freeRetentionDays: 0,
        paidRetentionDays: 0,
        scannedMessages: 0,
        deletedMessages: 0,
        detailsJson: {
          failureReason,
          nextCleanupAt,
          freeCandidates: 0,
          paidCandidates: 0,
          guestCandidates: 0,
          totalCandidates: 0,
          guestRetentionDays,
        },
        createdBy: input.createdBy ?? null,
      });
    } catch {
      // audit persistence is best-effort and should not shadow original cleanup failure.
    }

    return buildEmptyFailureResult(failureReason);
  }
}
