import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { appointmentTokens } from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";
import {
  resolveAppointmentRepoExecutor,
  type AppointmentRepoExecutor,
} from "./repoExecutor";
import type { AppointmentTokenRole } from "./tokenReadRepo";

const ACTIVE_TOKEN_LIMIT_PER_ROLE = 5;

export async function updateActiveAppointmentTokenExpiry(input: {
  appointmentId: number;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  await db
    .update(appointmentTokens)
    .set({
      expiresAt: input.expiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      )
    );
}

export async function createAppointmentTokenIfMissing(input: {
  appointmentId: number;
  role: AppointmentTokenRole;
  tokenHash: string;
  expiresAt: Date;
  maxUses?: number;
  createdBy?: string | null;
  revokedAt?: Date | null;
  dbExecutor?: AppointmentRepoExecutor;
}) {
  const db = await resolveAppointmentRepoExecutor(input.dbExecutor);

  const existing = await db
    .select({ id: appointmentTokens.id })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        eq(appointmentTokens.role, input.role),
        eq(appointmentTokens.tokenHash, input.tokenHash)
      )
    )
    .limit(1);

  if (existing[0]) {
    await revokeOldActiveTokensBeyondLimit({
      db,
      appointmentId: input.appointmentId,
      role: input.role,
    });
    return;
  }

  await db.insert(appointmentTokens).values({
    appointmentId: input.appointmentId,
    role: input.role,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    maxUses: input.maxUses ?? 1,
    createdBy: input.createdBy ?? null,
    revokedAt: input.revokedAt ?? null,
  });

  await revokeOldActiveTokensBeyondLimit({
    db,
    appointmentId: input.appointmentId,
    role: input.role,
  });
}

export async function updateTokenUsageIfAllowed(input: {
  tokenId: number;
  now?: Date;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const now = input.now ?? new Date();
  const result = await db
    .update(appointmentTokens)
    .set({
      useCount: sql`${appointmentTokens.useCount} + 1`,
      lastUsedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(appointmentTokens.id, input.tokenId),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now),
        lt(appointmentTokens.useCount, appointmentTokens.maxUses)
      )
    );

  return extractAffectedRows(result);
}

export async function saveTokenFirstSeen(input: {
  tokenId: number;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const updates: Record<string, unknown> = {};
  if (input.ip && input.ip.trim().length > 0) {
    updates.ipFirstSeen = input.ip.trim().slice(0, 64);
  }
  if (input.userAgent && input.userAgent.trim().length > 0) {
    updates.uaFirstSeen = input.userAgent.trim().slice(0, 512);
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  await db
    .update(appointmentTokens)
    .set(updates)
    .where(
      and(
        eq(appointmentTokens.id, input.tokenId),
        or(
          isNull(appointmentTokens.ipFirstSeen),
          isNull(appointmentTokens.uaFirstSeen)
        )
      )
    );
}

export async function revokeAppointmentTokens(input: {
  appointmentId?: number;
  role?: AppointmentTokenRole;
  tokenHash?: string;
  reason?: string | null;
  now?: Date;
  dbExecutor?: AppointmentRepoExecutor;
}) {
  const db = await resolveAppointmentRepoExecutor(input.dbExecutor);

  const now = input.now ?? new Date();
  const clauses = [isNull(appointmentTokens.revokedAt)];
  if (typeof input.appointmentId === "number") {
    clauses.push(eq(appointmentTokens.appointmentId, input.appointmentId));
  }
  if (input.role) {
    clauses.push(eq(appointmentTokens.role, input.role));
  }
  if (input.tokenHash) {
    clauses.push(eq(appointmentTokens.tokenHash, input.tokenHash));
  }

  const result = await db
    .update(appointmentTokens)
    .set({
      revokedAt: now,
      revokeReason: input.reason ?? "manual_revoke",
      updatedAt: now,
    })
    .where(and(...clauses));

  return extractAffectedRows(result);
}

async function revokeOldActiveTokensBeyondLimit(input: {
  db: AppointmentRepoExecutor;
  appointmentId: number;
  role: AppointmentTokenRole;
}) {
  const db = input.db;
  if (!db) {
    throw new Error("Database not available");
  }

  const now = new Date();
  const activeRows = await db
    .select({
      id: appointmentTokens.id,
      createdAt: appointmentTokens.createdAt,
    })
    .from(appointmentTokens)
    .where(
      and(
        eq(appointmentTokens.appointmentId, input.appointmentId),
        eq(appointmentTokens.role, input.role),
        isNull(appointmentTokens.revokedAt),
        gt(appointmentTokens.expiresAt, now)
      )
    )
    .orderBy(desc(appointmentTokens.createdAt), desc(appointmentTokens.id));

  if (activeRows.length <= ACTIVE_TOKEN_LIMIT_PER_ROLE) {
    return;
  }

  const revokeIds = activeRows
    .slice(ACTIVE_TOKEN_LIMIT_PER_ROLE)
    .map(row => row.id);

  if (revokeIds.length === 0) {
    return;
  }

  await db
    .update(appointmentTokens)
    .set({
      revokedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(appointmentTokens.id, revokeIds),
        isNull(appointmentTokens.revokedAt)
      )
    );
}
