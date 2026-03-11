import type { Request } from "express";
import * as appointmentsRepo from "./repo";
import { checkIpFailureRateLimit, recordIpFailure } from "./rateLimit";
import { hashToken } from "../../_core/appointmentToken";
import { getTokenAutoRevokeThreshold } from "./tokenService";
import { throwTokenError, type TokenErrorCode } from "./tokenErrors";
import { canJoinRoom, canSendMessage } from "./chatPolicy";
import { incrementMetric } from "../../_core/metrics";

export type VisitAccessAction = "join_room" | "read_history" | "send_message";

export type AppointmentAccessContext = {
  appointmentId: number;
  role: "patient" | "doctor";
  tokenId: number;
  tokenHash: string;
  expiresAt: Date;
  appointment: Awaited<ReturnType<typeof appointmentsRepo.getAppointmentById>> extends infer T
    ? NonNullable<T>
    : never;
  displayInfo: {
    patientEmail?: string | null;
    doctorId?: number | null;
  };
};

const tokenFailureCounts = new Map<string, number>();
const JOIN_REUSE_WINDOW_MS = 10 * 60 * 1000;

function isVisitRoomTestModeEnabled() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const raw = (process.env.VISIT_ROOM_TEST_MODE ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function hasConsultationStarted(scheduledAt: Date | null, now: Date) {
  if (isVisitRoomTestModeEnabled()) {
    return true;
  }
  if (!(scheduledAt instanceof Date) || Number.isNaN(scheduledAt.getTime())) {
    return true;
  }
  return now.getTime() >= scheduledAt.getTime();
}

function canReuseJoinWithoutIncrement(input: {
  action: VisitAccessAction;
  useCount: number;
  maxUses: number;
  lastUsedAt: Date | null;
  now: Date;
}) {
  if (input.action !== "join_room") {
    return false;
  }
  if (input.useCount <= 0 || input.maxUses <= 0) {
    return false;
  }
  if (!input.lastUsedAt) {
    return false;
  }
  return input.now.getTime() - input.lastUsedAt.getTime() <= JOIN_REUSE_WINDOW_MS;
}

function getClientIp(req?: Request): string | null {
  if (!req) {
    return null;
  }

  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0].trim();
  }

  if (Array.isArray(forwarded) && forwarded[0]?.trim()) {
    return forwarded[0].split(",")[0].trim();
  }

  return req.ip || null;
}

function getUserAgent(req?: Request): string | null {
  if (!req) {
    return null;
  }

  const raw = req.headers["user-agent"];
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim();
  }
  if (Array.isArray(raw) && raw[0]?.trim()) {
    return raw[0].trim();
  }

  return null;
}

async function handleFailedAttempt(input: {
  tokenHash?: string;
  reason: TokenErrorCode;
  req?: Request;
}) {
  const ip = getClientIp(input.req);
  recordIpFailure(ip);
  incrementMetric("appointment_token_validation_failed_total", {
    reason: input.reason,
  });

  if (input.tokenHash) {
    const current = tokenFailureCounts.get(input.tokenHash) ?? 0;
    const next = current + 1;
    tokenFailureCounts.set(input.tokenHash, next);

    if (next >= getTokenAutoRevokeThreshold()) {
      incrementMetric("appointment_token_auto_revoked_total", {
        reason: "too_many_failed_attempts",
      });
      await appointmentsRepo.revokeAppointmentTokens({
        tokenHash: input.tokenHash,
        reason: "too_many_failed_attempts",
      });
    }
  }

  if (process.env.NODE_ENV !== "test") {
    console.warn("[AppointmentToken] validation failed", {
      reason: input.reason,
      ip,
      tokenHashPrefix: input.tokenHash?.slice(0, 8) ?? null,
    });
  }
}

export async function validateAppointmentAccessToken(input: {
  token: string;
  action?: VisitAccessAction;
  expectedRole?: "patient" | "doctor";
  expectedAppointmentId?: number;
  req?: Request;
}): Promise<AppointmentAccessContext> {
  const action = input.action ?? "join_room";
  const token = input.token.trim();
  if (!token) {
    throwTokenError("TOKEN_MISSING");
  }

  const ip = getClientIp(input.req);
  if (checkIpFailureRateLimit(ip)) {
    await handleFailedAttempt({ reason: "RATE_LIMITED", req: input.req });
    throwTokenError("RATE_LIMITED");
  }

  const tokenHash = hashToken(token);
  const tokenRow = await appointmentsRepo.getAppointmentTokenByHash(tokenHash);
  if (!tokenRow) {
    await handleFailedAttempt({ tokenHash, reason: "TOKEN_INVALID", req: input.req });
    throwTokenError("TOKEN_INVALID");
  }

  const now = new Date();
  if (tokenRow.revokedAt) {
    await handleFailedAttempt({ tokenHash, reason: "TOKEN_REVOKED", req: input.req });
    throwTokenError("TOKEN_REVOKED");
  }

  if (tokenRow.expiresAt.getTime() <= now.getTime()) {
    await handleFailedAttempt({ tokenHash, reason: "TOKEN_EXPIRED", req: input.req });
    throwTokenError("TOKEN_EXPIRED");
  }

  const isJoinReuseAllowed = canReuseJoinWithoutIncrement({
    action,
    useCount: tokenRow.useCount,
    maxUses: tokenRow.maxUses,
    lastUsedAt: tokenRow.lastUsedAt ?? null,
    now,
  });

  if (action === "join_room" && tokenRow.useCount >= tokenRow.maxUses && !isJoinReuseAllowed) {
    await handleFailedAttempt({ tokenHash, reason: "TOKEN_MAX_USES", req: input.req });
    throwTokenError("TOKEN_MAX_USES");
  }

  if (input.expectedRole && tokenRow.role !== input.expectedRole) {
    await handleFailedAttempt({ tokenHash, reason: "TOKEN_INVALID", req: input.req });
    throwTokenError("TOKEN_INVALID");
  }

  if (
    typeof input.expectedAppointmentId === "number" &&
    tokenRow.appointmentId !== input.expectedAppointmentId
  ) {
    await handleFailedAttempt({ tokenHash, reason: "TOKEN_INVALID", req: input.req });
    throwTokenError("TOKEN_INVALID");
  }

  const appointment = await appointmentsRepo.getAppointmentById(tokenRow.appointmentId);
  if (!appointment) {
    await handleFailedAttempt({
      tokenHash,
      reason: "APPOINTMENT_NOT_FOUND",
      req: input.req,
    });
    throwTokenError("APPOINTMENT_NOT_FOUND");
  }

  if (!hasConsultationStarted(appointment.scheduledAt, now)) {
    await handleFailedAttempt({
      tokenHash,
      reason: "APPOINTMENT_NOT_STARTED",
      req: input.req,
    });
    throwTokenError("APPOINTMENT_NOT_STARTED");
  }

  if (
    !canJoinRoom({
      status: appointment.status,
      paymentStatus: appointment.paymentStatus,
    }) ||
    (action === "send_message" &&
      !canSendMessage({
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
      }))
  ) {
    await handleFailedAttempt({
      tokenHash,
      reason: "APPOINTMENT_NOT_ALLOWED",
      req: input.req,
    });
    throwTokenError("APPOINTMENT_NOT_ALLOWED");
  }

  if (action === "join_room" && !isJoinReuseAllowed) {
    const touched = await appointmentsRepo.updateTokenUsageIfAllowed({
      tokenId: tokenRow.id,
      now,
    });
    if (touched !== 1) {
      await handleFailedAttempt({ tokenHash, reason: "TOKEN_MAX_USES", req: input.req });
      throwTokenError("TOKEN_MAX_USES");
    }
  }

  await appointmentsRepo.saveTokenFirstSeen({
    tokenId: tokenRow.id,
    ip,
    userAgent: getUserAgent(input.req),
  });

  tokenFailureCounts.delete(tokenHash);
  incrementMetric("appointment_token_validation_success_total");
  if (process.env.NODE_ENV !== "test") {
    console.info("[AppointmentToken] validation success", {
      appointmentId: appointment.id,
      role: tokenRow.role,
      tokenId: tokenRow.id,
      ip,
    });
  }

  return {
    appointmentId: appointment.id,
    role: tokenRow.role,
    tokenId: tokenRow.id,
    tokenHash,
    expiresAt: tokenRow.expiresAt,
    appointment,
    displayInfo: {
      patientEmail: appointment.email ?? null,
      doctorId: appointment.doctorId ?? null,
    },
  };
}

export async function revokeAppointmentAccessToken(input: {
  appointmentId?: number;
  role?: "patient" | "doctor";
  token?: string;
  reason?: string;
}) {
  const tokenHash = input.token ? hashToken(input.token) : undefined;
  return appointmentsRepo.revokeAppointmentTokens({
    appointmentId: input.appointmentId,
    role: input.role,
    tokenHash,
    reason: input.reason ?? "manual_revoke",
  });
}

export function clearTokenValidationStateForTests() {
  tokenFailureCounts.clear();
}
