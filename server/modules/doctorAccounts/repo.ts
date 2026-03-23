import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import {
  doctorAccountInvites,
  doctorUserBindings,
  type DoctorAccountInvite,
  type DoctorUserBinding,
  type InsertDoctorAccountInvite,
  type InsertDoctorUserBinding,
} from "../../../drizzle/schema";
import { extractAffectedRows } from "../../_core/dbCompat";
import { getDb } from "../../db";

type BaseDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type DbExecutor = Pick<BaseDb, "select" | "insert" | "update">;

async function resolveDbExecutor(dbExecutor?: DbExecutor) {
  const db = dbExecutor ?? (await getDb());
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

export async function getActiveBindingByUserId(userId: number, dbExecutor?: DbExecutor) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(doctorUserBindings)
    .where(
      and(
        eq(doctorUserBindings.userId, userId),
        eq(doctorUserBindings.status, "active")
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getActiveBindingByDoctorId(doctorId: number, dbExecutor?: DbExecutor) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(doctorUserBindings)
    .where(
      and(
        eq(doctorUserBindings.doctorId, doctorId),
        eq(doctorUserBindings.status, "active")
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function getLatestInviteByDoctorId(doctorId: number, dbExecutor?: DbExecutor) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(doctorAccountInvites)
    .where(eq(doctorAccountInvites.doctorId, doctorId))
    .orderBy(desc(doctorAccountInvites.createdAt), desc(doctorAccountInvites.id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getInviteById(inviteId: number, dbExecutor?: DbExecutor) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(doctorAccountInvites)
    .where(eq(doctorAccountInvites.id, inviteId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getInviteByTokenHash(tokenHash: string, dbExecutor?: DbExecutor) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(doctorAccountInvites)
    .where(eq(doctorAccountInvites.tokenHash, tokenHash))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestOpenInviteByDoctorAndEmail(
  input: { doctorId: number; email: string; now?: Date },
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const now = input.now ?? new Date();
  const rows = await db
    .select()
    .from(doctorAccountInvites)
    .where(
      and(
        eq(doctorAccountInvites.doctorId, input.doctorId),
        eq(doctorAccountInvites.email, input.email),
        inArray(doctorAccountInvites.status, ["pending", "sent"]),
        gt(doctorAccountInvites.expiresAt, now)
      )
    )
    .orderBy(desc(doctorAccountInvites.createdAt), desc(doctorAccountInvites.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createInvite(
  input: InsertDoctorAccountInvite,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db.insert(doctorAccountInvites).values(input).returning();
  return rows[0] ?? null;
}

export async function updateInviteById(
  inviteId: number,
  update: Partial<InsertDoctorAccountInvite>,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .update(doctorAccountInvites)
    .set({
      ...update,
      updatedAt: new Date(),
    })
    .where(eq(doctorAccountInvites.id, inviteId))
    .returning();
  return rows[0] ?? null;
}

export async function expireInviteIfNeeded(
  invite: DoctorAccountInvite,
  dbExecutor?: DbExecutor
) {
  if (
    invite.status !== "pending" &&
    invite.status !== "sent"
  ) {
    return invite;
  }
  if (invite.expiresAt.getTime() > Date.now()) {
    return invite;
  }
  return updateInviteById(invite.id, { status: "expired" }, dbExecutor);
}

export async function cancelInviteById(inviteId: number, dbExecutor?: DbExecutor) {
  const db = await resolveDbExecutor(dbExecutor);
  const result = await db
    .update(doctorAccountInvites)
    .set({
      status: "canceled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(doctorAccountInvites.id, inviteId),
        inArray(doctorAccountInvites.status, ["pending", "sent"])
      )
    );
  return extractAffectedRows(result);
}

export async function markInviteAccepted(input: {
  inviteId: number;
  claimedByUserId: number;
  acceptedAt: Date;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .update(doctorAccountInvites)
    .set({
      status: "accepted",
      claimedByUserId: input.claimedByUserId,
      acceptedAt: input.acceptedAt,
      updatedAt: input.acceptedAt,
    })
    .where(eq(doctorAccountInvites.id, input.inviteId))
    .returning();
  return rows[0] ?? null;
}

export async function createBinding(
  input: InsertDoctorUserBinding,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db.insert(doctorUserBindings).values(input).returning();
  return rows[0] ?? null;
}

export async function updateBindingById(
  bindingId: number,
  update: Partial<InsertDoctorUserBinding>,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .update(doctorUserBindings)
    .set({
      ...update,
      updatedAt: new Date(),
    })
    .where(eq(doctorUserBindings.id, bindingId))
    .returning();
  return rows[0] ?? null;
}

export async function revokeActiveBindingByDoctorId(input: {
  doctorId: number;
  updatedByUserId?: number | null;
  revokedAt?: Date;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const revokedAt = input.revokedAt ?? new Date();
  const rows = await db
    .update(doctorUserBindings)
    .set({
      status: "revoked",
      revokedAt,
      updatedByUserId: input.updatedByUserId ?? null,
      updatedAt: revokedAt,
    })
    .where(
      and(
        eq(doctorUserBindings.doctorId, input.doctorId),
        eq(doctorUserBindings.status, "active")
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function revokeActiveBindingByUserId(input: {
  userId: number;
  updatedByUserId?: number | null;
  revokedAt?: Date;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const revokedAt = input.revokedAt ?? new Date();
  const rows = await db
    .update(doctorUserBindings)
    .set({
      status: "revoked",
      revokedAt,
      updatedByUserId: input.updatedByUserId ?? null,
      updatedAt: revokedAt,
    })
    .where(
      and(
        eq(doctorUserBindings.userId, input.userId),
        eq(doctorUserBindings.status, "active")
      )
    )
    .returning();
  return rows[0] ?? null;
}

export async function getDoctorAccountStatusByDoctorId(
  doctorId: number,
  dbExecutor?: DbExecutor
): Promise<{
  activeBinding: DoctorUserBinding | null;
  latestInvite: DoctorAccountInvite | null;
}> {
  const [activeBinding, latestInvite] = await Promise.all([
    getActiveBindingByDoctorId(doctorId, dbExecutor),
    getLatestInviteByDoctorId(doctorId, dbExecutor),
  ]);

  return {
    activeBinding,
    latestInvite: latestInvite ? await expireInviteIfNeeded(latestInvite, dbExecutor) : null,
  };
}

export async function clearPendingBindingsByDoctorId(
  doctorId: number,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const result = await db
    .update(doctorUserBindings)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(doctorUserBindings.doctorId, doctorId),
        eq(doctorUserBindings.status, "pending_invite"),
        isNull(doctorUserBindings.boundAt)
      )
    );
  return extractAffectedRows(result);
}
