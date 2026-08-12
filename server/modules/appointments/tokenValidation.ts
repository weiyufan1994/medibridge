import type { RequestMetadata } from "@shared/requestMetadata";
import * as appointmentsRepo from "./repo";
import { checkIpFailureRateLimit, recordIpFailure } from "./rateLimit";
import { hashToken } from "../../_core/appointmentToken";
import { getTokenAutoRevokeThreshold } from "./tokenService";
import { throwTokenError, type TokenErrorCode } from "./tokenErrors";
import { incrementMetric } from "../../_core/metrics";
import { createLogger } from "../../_core/logger";
import {
  getVisitAccessPolicyFailure,
  type VisitAccessAction,
} from "./visitAccessPolicy";

const logger = createLogger("appointment-token");

export type { VisitAccessAction } from "./visitAccessPolicy";

export type AppointmentAccessContext = {
  appointmentId: number;
  role: "patient" | "doctor";
  tokenId: number;
  tokenHash: string;
  expiresAt: Date;
  appointment: Awaited<
    ReturnType<typeof appointmentsRepo.getAppointmentById>
  > extends infer T
    ? NonNullable<T>
    : never;
  displayInfo: {
    patientEmail?: string | null;
    doctorId?: number | null;
  };
};

const tokenFailureCounts = new Map<string, number>();
const JOIN_REUSE_WINDOW_MS = 10 * 60 * 1000;

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
  return (
    input.now.getTime() - input.lastUsedAt.getTime() <= JOIN_REUSE_WINDOW_MS
  );
}

async function handleFailedAttempt(input: {
  tokenHash?: string;
  reason: TokenErrorCode;
  requestMetadata?: RequestMetadata;
}) {
  const ip = input.requestMetadata?.clientIp ?? null;
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
    logger.warn("validation_failed", {
      reason: input.reason,
      clientIp: ip,
      requestId: input.requestMetadata?.requestId ?? null,
    });
  }
}

export async function validateAppointmentAccessToken(input: {
  token: string;
  action?: VisitAccessAction;
  expectedRole?: "patient" | "doctor";
  expectedAppointmentId?: number;
  requestMetadata?: RequestMetadata;
}): Promise<AppointmentAccessContext> {
  const action = input.action ?? "join_room";
  const token = input.token.trim();
  if (!token) {
    throwTokenError("TOKEN_MISSING");
  }

  const ip = input.requestMetadata?.clientIp ?? null;
  if (checkIpFailureRateLimit(ip)) {
    await handleFailedAttempt({
      reason: "RATE_LIMITED",
      requestMetadata: input.requestMetadata,
    });
    throwTokenError("RATE_LIMITED");
  }

  const tokenHash = hashToken(token);
  const tokenRow = await appointmentsRepo.getAppointmentTokenByHash(tokenHash);
  if (!tokenRow) {
    await handleFailedAttempt({
      tokenHash,
      reason: "TOKEN_INVALID",
      requestMetadata: input.requestMetadata,
    });
    throwTokenError("TOKEN_INVALID");
  }

  const now = new Date();
  if (tokenRow.revokedAt) {
    await handleFailedAttempt({
      tokenHash,
      reason: "TOKEN_REVOKED",
      requestMetadata: input.requestMetadata,
    });
    throwTokenError("TOKEN_REVOKED");
  }

  if (tokenRow.expiresAt.getTime() <= now.getTime()) {
    await handleFailedAttempt({
      tokenHash,
      reason: "TOKEN_EXPIRED",
      requestMetadata: input.requestMetadata,
    });
    throwTokenError("TOKEN_EXPIRED");
  }

  const isJoinReuseAllowed = canReuseJoinWithoutIncrement({
    action,
    useCount: tokenRow.useCount,
    maxUses: tokenRow.maxUses,
    lastUsedAt: tokenRow.lastUsedAt ?? null,
    now,
  });

  if (
    action === "join_room" &&
    tokenRow.useCount >= tokenRow.maxUses &&
    !isJoinReuseAllowed
  ) {
    await handleFailedAttempt({
      tokenHash,
      reason: "TOKEN_MAX_USES",
      requestMetadata: input.requestMetadata,
    });
    throwTokenError("TOKEN_MAX_USES");
  }

  if (input.expectedRole && tokenRow.role !== input.expectedRole) {
    await handleFailedAttempt({
      tokenHash,
      reason: "TOKEN_INVALID",
      requestMetadata: input.requestMetadata,
    });
    throwTokenError("TOKEN_INVALID");
  }

  if (
    typeof input.expectedAppointmentId === "number" &&
    tokenRow.appointmentId !== input.expectedAppointmentId
  ) {
    await handleFailedAttempt({
      tokenHash,
      reason: "TOKEN_INVALID",
      requestMetadata: input.requestMetadata,
    });
    throwTokenError("TOKEN_INVALID");
  }

  const appointment = await appointmentsRepo.getAppointmentById(
    tokenRow.appointmentId
  );
  if (!appointment) {
    await handleFailedAttempt({
      tokenHash,
      reason: "APPOINTMENT_NOT_FOUND",
      requestMetadata: input.requestMetadata,
    });
    throwTokenError("APPOINTMENT_NOT_FOUND");
  }

  const policyFailure = getVisitAccessPolicyFailure({
    appointment,
    action,
    now,
  });
  if (policyFailure) {
    await handleFailedAttempt({
      tokenHash,
      reason: policyFailure,
      requestMetadata: input.requestMetadata,
    });
    throwTokenError(policyFailure);
  }

  if (action === "join_room" && !isJoinReuseAllowed) {
    const touched = await appointmentsRepo.updateTokenUsageIfAllowed({
      tokenId: tokenRow.id,
      now,
    });
    if (touched !== 1) {
      await handleFailedAttempt({
        tokenHash,
        reason: "TOKEN_MAX_USES",
        requestMetadata: input.requestMetadata,
      });
      throwTokenError("TOKEN_MAX_USES");
    }
  }

  await appointmentsRepo.saveTokenFirstSeen({
    tokenId: tokenRow.id,
    ip,
    userAgent: input.requestMetadata?.userAgent ?? null,
  });

  tokenFailureCounts.delete(tokenHash);
  incrementMetric("appointment_token_validation_success_total");
  if (process.env.NODE_ENV !== "test") {
    logger.info("validation_succeeded", {
      appointmentId: appointment.id,
      role: tokenRow.role,
      tokenId: tokenRow.id,
      clientIp: ip,
      requestId: input.requestMetadata?.requestId ?? null,
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
