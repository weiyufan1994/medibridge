import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  lt,
  or,
  sql,
} from "drizzle-orm";
import {
  appointmentMedicalSummaries,
  appointmentTokens,
  appointmentStatusEvents,
  appointments,
  stripeWebhookEvents,
  type InsertAppointment,
  type InsertAppointmentMedicalSummary,
} from "../../../drizzle/schema";
import { getDb } from "../../db";
import {
  type AppointmentStatus,
  type PaymentStatus,
  isAllowedPaymentStatusForAppointment,
  isAllowedStatusTransition,
} from "./stateMachine";

export type AppointmentTokenRole = "patient" | "doctor";
type PaymentProvider = "stripe" | "paypal";
const ACTIVE_TOKEN_LIMIT_PER_ROLE = 5;
type BaseDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type DbExecutor = Pick<BaseDb, "select" | "insert" | "update">;
export type AppointmentRepoExecutor = DbExecutor;

function extractAffectedRows(result: unknown): number {
  const header =
    Array.isArray(result) && result.length > 0
      ? (result[0] as { affectedRows?: unknown })
      : (result as { affectedRows?: unknown });
  const value = Number(header?.affectedRows ?? 0);
  return Number.isFinite(value) ? value : 0;
}

async function resolveDbExecutor(dbExecutor?: DbExecutor) {
  const db = dbExecutor ?? (await getDb());
  if (!db) {
    throw new Error("Database not available");
  }
  return db;
}

export async function getAppointmentById(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAppointmentByStripeSessionId(
  stripeSessionId: string,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);

  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.stripeSessionId, stripeSessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getCheckoutResultByStripeSessionId(stripeSessionId: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({
      id: appointments.id,
      paymentStatus: appointments.paymentStatus,
      status: appointments.status,
      email: appointments.email,
      lastAccessAt: appointments.lastAccessAt,
      paidAt: appointments.paidAt,
    })
    .from(appointments)
    .where(eq(appointments.stripeSessionId, stripeSessionId))
    .limit(1);

  return rows[0] ?? null;
}

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
      remainingSeconds:
        sql<number>`greatest(${input.cooldownSeconds} - timestampdiff(second, ${appointmentTokens.createdAt}, now()), 0)`,
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
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);

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
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);

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
  db: DbExecutor;
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

export async function createAppointmentDraft(input: {
  doctorId: number;
  triageSessionId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date;
  email: string;
  amount: number;
  currency: string;
  userId?: number | null;
  sessionId?: string;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.insert(appointments).values({
    doctorId: input.doctorId,
    triageSessionId: input.triageSessionId,
    appointmentType: input.appointmentType,
    scheduledAt: input.scheduledAt,
    status: "draft",
    paymentStatus: "unpaid",
    amount: input.amount,
    currency: input.currency,
    email: input.email,
    userId: input.userId ?? null,
    sessionId: input.sessionId,
    notes: input.notes ?? null,
    lastAccessAt: null,
    doctorLastAccessAt: null,
  });
}

export async function updateAppointmentById(
  appointmentId: number,
  update: Partial<InsertAppointment>
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(appointments)
    .set(update)
    .where(eq(appointments.id, appointmentId));
}

export async function updateAppointmentNotesIfMatch(input: {
  appointmentId: number;
  expectedNotes: string | null;
  nextNotes: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const expectedClause =
    input.expectedNotes === null
      ? isNull(appointments.notes)
      : eq(appointments.notes, input.expectedNotes);

  const result = await db
    .update(appointments)
    .set({
      notes: input.nextNotes,
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, input.appointmentId), expectedClause));

  return extractAffectedRows(result);
}

export async function getMedicalSummaryByAppointmentId(
  appointmentId: number,
  dbExecutor?: DbExecutor
) {
  const db = await resolveDbExecutor(dbExecutor);
  const rows = await db
    .select()
    .from(appointmentMedicalSummaries)
    .where(eq(appointmentMedicalSummaries.appointmentId, appointmentId))
    .limit(1);

  return rows[0] ?? null;
}

export async function upsertMedicalSummaryByAppointmentId(input: {
  appointmentId: number;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
  source: InsertAppointmentMedicalSummary["source"];
  signedBy?: number | null;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  await db
    .insert(appointmentMedicalSummaries)
    .values({
      appointmentId: input.appointmentId,
      chiefComplaint: input.chiefComplaint,
      historyOfPresentIllness: input.historyOfPresentIllness,
      pastMedicalHistory: input.pastMedicalHistory,
      assessmentDiagnosis: input.assessmentDiagnosis,
      planRecommendations: input.planRecommendations,
      source: input.source,
      signedBy: input.signedBy ?? null,
    })
    .onDuplicateKeyUpdate({
      set: {
        chiefComplaint: input.chiefComplaint,
        historyOfPresentIllness: input.historyOfPresentIllness,
        pastMedicalHistory: input.pastMedicalHistory,
        assessmentDiagnosis: input.assessmentDiagnosis,
        planRecommendations: input.planRecommendations,
        source: input.source,
        signedBy: input.signedBy ?? null,
        updatedAt: new Date(),
      },
    });

  return getMedicalSummaryByAppointmentId(input.appointmentId, db);
}

type TransitionOperator = "system" | "patient" | "doctor" | "admin" | "webhook";

async function readAppointmentStateById(input: {
  appointmentId: number;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      stripeSessionId: appointments.stripeSessionId,
    })
    .from(appointments)
    .where(eq(appointments.id, input.appointmentId))
    .limit(1);

  return rows[0] ?? null;
}

async function readAppointmentStateByStripeSessionId(input: {
  stripeSessionId: string;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      stripeSessionId: appointments.stripeSessionId,
    })
    .from(appointments)
    .where(eq(appointments.stripeSessionId, input.stripeSessionId))
    .limit(1);

  return rows[0] ?? null;
}

export async function recordIllegalStatusTransition(input: {
  appointmentId: number;
  fromStatus: AppointmentStatus;
  attemptedStatus: AppointmentStatus;
  attemptedPaymentStatus: PaymentStatus;
  operatorType: TransitionOperator;
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
  dbExecutor?: DbExecutor;
}) {
  await insertStatusEvent({
    appointmentId: input.appointmentId,
    fromStatus: input.fromStatus,
    toStatus: input.fromStatus,
    operatorType: input.operatorType,
    operatorId: input.operatorId ?? null,
    reason: input.reason ?? "illegal_transition_attempt",
    payloadJson: {
      attemptedStatus: input.attemptedStatus,
      attemptedPaymentStatus: input.attemptedPaymentStatus,
      ...(typeof input.payloadJson === "object" && input.payloadJson
        ? (input.payloadJson as Record<string, unknown>)
        : {}),
    },
    dbExecutor: input.dbExecutor,
  });
}

export async function tryTransitionAppointmentById(input: {
  appointmentId: number;
  allowedFrom: AppointmentStatus[];
  toStatus: AppointmentStatus;
  toPaymentStatus: PaymentStatus;
  operatorType: TransitionOperator;
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
  update?: Partial<InsertAppointment>;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const current = await readAppointmentStateById({
    appointmentId: input.appointmentId,
    dbExecutor: db,
  });
  if (!current) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const allowedFromState = input.allowedFrom.includes(current.status as AppointmentStatus);
  const allowedTransition = isAllowedStatusTransition(
    current.status as AppointmentStatus,
    input.toStatus
  );
  const allowedPair = isAllowedPaymentStatusForAppointment(
    input.toStatus,
    input.toPaymentStatus
  );

  if (!allowedFromState || !allowedTransition || !allowedPair) {
    await recordIllegalStatusTransition({
      appointmentId: current.id,
      fromStatus: current.status as AppointmentStatus,
      attemptedStatus: input.toStatus,
      attemptedPaymentStatus: input.toPaymentStatus,
      operatorType: input.operatorType,
      operatorId: input.operatorId,
      reason: input.reason ?? "illegal_transition_attempt",
      payloadJson: input.payloadJson,
      dbExecutor: db,
    });
    return { ok: false as const, reason: "illegal_transition" as const, current };
  }

  const now = new Date();
  const result = await db
    .update(appointments)
    .set({
      status: input.toStatus,
      paymentStatus: input.toPaymentStatus,
      updatedAt: now,
      ...(input.update ?? {}),
    })
    .where(
      and(
        eq(appointments.id, current.id),
        eq(appointments.status, current.status),
        eq(appointments.paymentStatus, current.paymentStatus)
      )
    );

  const affectedRows = extractAffectedRows(result);
  if (affectedRows !== 1) {
    return { ok: false as const, reason: "conflict" as const, current };
  }

  if (
    current.status !== input.toStatus ||
    current.paymentStatus !== input.toPaymentStatus
  ) {
    await insertStatusEvent({
      appointmentId: current.id,
      fromStatus: current.status,
      toStatus: input.toStatus,
      operatorType: input.operatorType,
      operatorId: input.operatorId ?? null,
      reason: input.reason ?? null,
      payloadJson: input.payloadJson,
      dbExecutor: db,
    });
  }

  return { ok: true as const, reason: "updated" as const, current };
}

export async function tryTransitionAppointmentByStripeSessionId(input: {
  stripeSessionId: string;
  allowedFrom: AppointmentStatus[];
  toStatus: AppointmentStatus;
  toPaymentStatus: PaymentStatus;
  operatorType: TransitionOperator;
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
  update?: Partial<InsertAppointment>;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);
  const current = await readAppointmentStateByStripeSessionId({
    stripeSessionId: input.stripeSessionId,
    dbExecutor: db,
  });
  if (!current) {
    return { ok: false as const, reason: "not_found" as const };
  }

  return tryTransitionAppointmentById({
    appointmentId: current.id,
    allowedFrom: input.allowedFrom,
    toStatus: input.toStatus,
    toPaymentStatus: input.toPaymentStatus,
    operatorType: input.operatorType,
    operatorId: input.operatorId,
    reason: input.reason,
    payloadJson: {
      stripeSessionId: input.stripeSessionId,
      ...(typeof input.payloadJson === "object" && input.payloadJson
        ? (input.payloadJson as Record<string, unknown>)
        : {}),
    },
    update: input.update,
    dbExecutor: db,
  });
}

export async function markAppointmentPendingPayment(input: {
  appointmentId: number;
  stripeSessionId: string;
  paymentProvider?: PaymentProvider;
}) {
  return tryTransitionAppointmentById({
    appointmentId: input.appointmentId,
    allowedFrom: ["draft", "pending_payment"],
    toStatus: "pending_payment",
    toPaymentStatus: "pending",
    operatorType: "system",
    reason: "checkout_session_created",
    payloadJson: {
      stripeSessionId: input.stripeSessionId,
    },
    update: {
      stripeSessionId: input.stripeSessionId,
      paymentProvider: input.paymentProvider ?? "stripe",
    },
  });
}

export async function tryMarkPaidByStripeSessionId(input: {
  stripeSessionId: string;
  paidAt?: Date;
  operatorType?: TransitionOperator;
  reason?: string | null;
  payloadJson?: unknown;
  dbExecutor?: DbExecutor;
}) {
  const transitioned = await tryTransitionAppointmentByStripeSessionId({
    stripeSessionId: input.stripeSessionId,
    allowedFrom: ["pending_payment"],
    toStatus: "paid",
    toPaymentStatus: "paid",
    operatorType: input.operatorType ?? "webhook",
    reason: input.reason ?? "stripe_webhook_paid",
    payloadJson: input.payloadJson,
    update: {
      paidAt: input.paidAt ?? new Date(),
    },
    dbExecutor: input.dbExecutor,
  });

  return transitioned.ok ? 1 : 0;
}
export async function findLatestAppointmentIdByLookup(lookup: {
  doctorId: number;
  email: string;
  scheduledAt: Date;
  triageSessionId: number;
  status?: AppointmentStatus;
  paymentStatus?: PaymentStatus;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  let whereClause = and(
    eq(appointments.doctorId, lookup.doctorId),
    eq(appointments.email, lookup.email),
    eq(appointments.scheduledAt, lookup.scheduledAt),
    eq(appointments.triageSessionId, lookup.triageSessionId)
  );
  if (lookup.status) {
    whereClause = and(whereClause, eq(appointments.status, lookup.status));
  }
  if (lookup.paymentStatus) {
    whereClause = and(
      whereClause,
      eq(appointments.paymentStatus, lookup.paymentStatus)
    );
  }

  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(whereClause)
    .orderBy(desc(appointments.id))
    .limit(1);

  return rows[0]?.id ?? null;
}

export async function bindAppointmentsToUserByEmail(
  email: string,
  userId: number
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  await db
    .update(appointments)
    .set({ userId })
    .where(eq(appointments.email, email));
}

export async function listAppointmentsByUserScope(input: {
  userId: number;
  email?: string | null;
  limit: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const hasEmail = Boolean(input.email && input.email.trim().length > 0);
  const whereClause = hasEmail
    ? or(eq(appointments.userId, input.userId), eq(appointments.email, input.email!))
    : eq(appointments.userId, input.userId);

  return db
    .select()
    .from(appointments)
    .where(whereClause)
    .orderBy(desc(appointments.createdAt), desc(appointments.id))
    .limit(input.limit);
}

export async function listAppointmentsByUserOrEmail(input: {
  userId: number;
  email?: string | null;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const hasEmail = Boolean(input.email && input.email.trim().length > 0);
  const whereClause = hasEmail
    ? or(eq(appointments.userId, input.userId), eq(appointments.email, input.email!))
    : eq(appointments.userId, input.userId);

  return db
    .select()
    .from(appointments)
    .where(whereClause)
    .orderBy(desc(appointments.createdAt), desc(appointments.id));
}

export async function listAppointmentsByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db
    .select()
    .from(appointments)
    .where(eq(appointments.email, email))
    .orderBy(desc(appointments.createdAt), desc(appointments.id));
}

export async function listAppointmentsForAdmin(input: {
  limit: number;
  status?: AppointmentStatus;
  paymentStatus?: PaymentStatus;
  emailQuery?: string;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const filters = [];
  if (input.status) {
    filters.push(eq(appointments.status, input.status));
  }
  if (input.paymentStatus) {
    filters.push(eq(appointments.paymentStatus, input.paymentStatus));
  }
  if (input.emailQuery && input.emailQuery.trim().length > 0) {
    filters.push(like(appointments.email, `%${input.emailQuery.trim()}%`));
  }

  return db
    .select({
      id: appointments.id,
      userId: appointments.userId,
      email: appointments.email,
      doctorId: appointments.doctorId,
      triageSessionId: appointments.triageSessionId,
      appointmentType: appointments.appointmentType,
      status: appointments.status,
      paymentStatus: appointments.paymentStatus,
      amount: appointments.amount,
      currency: appointments.currency,
      stripeSessionId: appointments.stripeSessionId,
      scheduledAt: appointments.scheduledAt,
      paidAt: appointments.paidAt,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
    })
    .from(appointments)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(appointments.createdAt), desc(appointments.id))
    .limit(input.limit);
}

export async function insertStatusEvent(input: {
  appointmentId: number;
  fromStatus: string | null;
  toStatus: string;
  operatorType: "system" | "patient" | "doctor" | "admin" | "webhook";
  operatorId?: number | null;
  reason?: string | null;
  payloadJson?: unknown;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);

  await db.insert(appointmentStatusEvents).values({
    appointmentId: input.appointmentId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    operatorType: input.operatorType,
    operatorId: input.operatorId ?? null,
    reason: input.reason ?? null,
    payloadJson:
      typeof input.payloadJson === "undefined"
        ? null
        : (input.payloadJson as Record<string, unknown>),
  });
}

export async function insertStripeWebhookEvent(input: {
  eventId: string;
  type: string;
  provider?: PaymentProvider;
  stripeSessionId?: string | null;
  appointmentId?: number | null;
  payloadHash?: string | null;
  dbExecutor?: DbExecutor;
}) {
  const db = await resolveDbExecutor(input.dbExecutor);

  await db.insert(stripeWebhookEvents).values({
    eventId: input.eventId,
    type: input.type,
    provider: input.provider ?? "stripe",
    stripeSessionId: input.stripeSessionId ?? null,
    appointmentId: input.appointmentId ?? null,
    payloadHash: input.payloadHash ?? null,
  });
}

export async function markAppointmentInSessionIfNeeded(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  const currentStatus = rows[0]?.status;
  if (currentStatus !== "paid") {
    return null;
  }

  const result = await db
    .update(appointments)
    .set({ status: "active", updatedAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.status, currentStatus)));

  const affectedRows = extractAffectedRows(result);
  return affectedRows > 0 ? currentStatus : null;
}

export async function countStatusEventsByAppointment(appointmentId: number) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(appointmentStatusEvents)
    .where(eq(appointmentStatusEvents.appointmentId, appointmentId));

  return Number(rows[0]?.count ?? 0);
}

export async function listStatusEventsByAppointment(input: {
  appointmentId: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = input.limit ?? 100;
  return db
    .select()
    .from(appointmentStatusEvents)
    .where(eq(appointmentStatusEvents.appointmentId, input.appointmentId))
    .orderBy(desc(appointmentStatusEvents.createdAt), desc(appointmentStatusEvents.id))
    .limit(limit);
}

export async function listStripeWebhookEventsForAppointment(input: {
  appointmentId: number;
  stripeSessionId?: string | null;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = input.limit ?? 100;
  const filters = [eq(stripeWebhookEvents.appointmentId, input.appointmentId)];
  if (input.stripeSessionId && input.stripeSessionId.trim().length > 0) {
    filters.push(eq(stripeWebhookEvents.stripeSessionId, input.stripeSessionId.trim()));
  }

  return db
    .select()
    .from(stripeWebhookEvents)
    .where(or(...filters))
    .orderBy(desc(stripeWebhookEvents.createdAt))
    .limit(limit);
}
