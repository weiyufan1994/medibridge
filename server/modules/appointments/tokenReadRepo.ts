import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { appointmentTokens } from "../../../drizzle/schema";
import { getDb } from "../../db";

export type AppointmentTokenRole = "patient" | "doctor";

export async function listActiveAppointmentTokens(input: {
  appointmentId: number;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = input.now ?? new Date();
  return db
    .select({
      id: appointmentTokens.id,
      appointmentId: appointmentTokens.appointmentId,
      role: appointmentTokens.role,
      tokenHash: appointmentTokens.tokenHash,
      expiresAt: appointmentTokens.expiresAt,
      lastUsedAt: appointmentTokens.lastUsedAt,
      useCount: appointmentTokens.useCount,
      maxUses: appointmentTokens.maxUses,
      revokedAt: appointmentTokens.revokedAt,
      revokeReason: appointmentTokens.revokeReason,
      ipFirstSeen: appointmentTokens.ipFirstSeen,
      uaFirstSeen: appointmentTokens.uaFirstSeen,
    })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      )
    );
}

export async function getActiveAppointmentTokenByHash(input: {
  tokenHash: string;
  role?: AppointmentTokenRole;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = input.now ?? new Date();
  const whereClause = input.role
    ? and(
        eq(appointmentTokens.tokenHash, input.tokenHash),
        eq(appointmentTokens.role, input.role),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      )
    : and(
        eq(appointmentTokens.tokenHash, input.tokenHash),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      );

  const rows = await db
    .select({
      id: appointmentTokens.id,
      appointmentId: appointmentTokens.appointmentId,
      role: appointmentTokens.role,
      tokenHash: appointmentTokens.tokenHash,
      expiresAt: appointmentTokens.expiresAt,
      lastUsedAt: appointmentTokens.lastUsedAt,
      useCount: appointmentTokens.useCount,
      maxUses: appointmentTokens.maxUses,
      revokedAt: appointmentTokens.revokedAt,
      revokeReason: appointmentTokens.revokeReason,
      ipFirstSeen: appointmentTokens.ipFirstSeen,
      uaFirstSeen: appointmentTokens.uaFirstSeen,
    })
    .from(appointmentTokens)
    .where(whereClause)
    .limit(1);

  return rows[0] ?? null;
}

export async function getAppointmentTokenByHash(tokenHash: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({
      id: appointmentTokens.id,
      appointmentId: appointmentTokens.appointmentId,
      role: appointmentTokens.role,
      tokenHash: appointmentTokens.tokenHash,
      expiresAt: appointmentTokens.expiresAt,
      lastUsedAt: appointmentTokens.lastUsedAt,
      useCount: appointmentTokens.useCount,
      maxUses: appointmentTokens.maxUses,
      revokedAt: appointmentTokens.revokedAt,
      revokeReason: appointmentTokens.revokeReason,
      ipFirstSeen: appointmentTokens.ipFirstSeen,
      uaFirstSeen: appointmentTokens.uaFirstSeen,
      createdAt: appointmentTokens.createdAt,
    })
    .from(appointmentTokens)
    .where(eq(appointmentTokens.tokenHash, tokenHash))
    .limit(1);

  return rows[0] ?? null;
}

export async function getLatestAppointmentTokenIssuedAt(input: {
  appointmentId: number;
  role: AppointmentTokenRole;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({
      createdAt: appointmentTokens.createdAt,
    })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        eq(appointmentTokens.role, input.role)
      )
    )
    .orderBy(desc(appointmentTokens.createdAt), desc(appointmentTokens.id))
    .limit(1);

  return rows[0]?.createdAt ?? null;
}

export async function getAppointmentTokenCooldownRemainingSeconds(input: {
  appointmentId: number;
  role: AppointmentTokenRole;
  cooldownSeconds: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({
      remainingSeconds: sql<number>`greatest(${input.cooldownSeconds} - cast(extract(epoch from (now() - ${appointmentTokens.createdAt})) as integer), 0)`,
    })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        eq(appointmentTokens.role, input.role)
      )
    )
    .orderBy(desc(appointmentTokens.createdAt), desc(appointmentTokens.id))
    .limit(1);

  return Number(rows[0]?.remainingSeconds ?? 0);
}
