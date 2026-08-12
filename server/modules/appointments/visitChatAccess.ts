import type { RequestMetadata } from "@shared/requestMetadata";
import { createLogger } from "../../_core/logger";
import { incrementMetric } from "../../_core/metrics";
import * as appointmentsRepo from "./repo";
import { checkIpFailureRateLimit, recordIpFailure } from "./rateLimit";
import { validateAppointmentAccessToken } from "./tokenValidation";
import { throwTokenError, type TokenErrorCode } from "./tokenErrors";
import { issueVisitChatToken, verifyVisitChatToken } from "./visitChatToken";
import {
  getVisitAccessPolicyFailure,
  type VisitAccessAction,
} from "./visitAccessPolicy";

const logger = createLogger("visit-chat-token");

async function handleVisitChatFailure(input: {
  reason: TokenErrorCode;
  requestMetadata?: RequestMetadata;
}) {
  const clientIp = input.requestMetadata?.clientIp ?? null;
  recordIpFailure(clientIp);
  incrementMetric("visit_chat_token_validation_failed_total", {
    reason: input.reason,
  });
  if (process.env.NODE_ENV !== "test") {
    logger.warn("validation_failed", {
      reason: input.reason,
      clientIp,
      requestId: input.requestMetadata?.requestId ?? null,
    });
  }
}

async function failVisitChatValidation(input: {
  reason: TokenErrorCode;
  requestMetadata?: RequestMetadata;
}): Promise<never> {
  await handleVisitChatFailure(input);
  throwTokenError(input.reason);
}

export async function validateVisitChatAccessToken(input: {
  token: string;
  action?: VisitAccessAction;
  expectedRole?: "patient" | "doctor";
  expectedAppointmentId?: number;
  requestMetadata?: RequestMetadata;
}) {
  const token = input.token.trim();
  if (!token) {
    throwTokenError("TOKEN_MISSING");
  }

  const clientIp = input.requestMetadata?.clientIp ?? null;
  if (checkIpFailureRateLimit(clientIp)) {
    await failVisitChatValidation({
      reason: "RATE_LIMITED",
      requestMetadata: input.requestMetadata,
    });
  }

  const verified = await verifyVisitChatToken(token);
  if (!verified.ok) {
    return failVisitChatValidation({
      reason: verified.reason,
      requestMetadata: input.requestMetadata,
    });
  }

  const { claims } = verified;
  if (
    (typeof input.expectedAppointmentId === "number" &&
      claims.appointmentId !== input.expectedAppointmentId) ||
    (input.expectedRole && claims.actorRole !== input.expectedRole)
  ) {
    await failVisitChatValidation({
      reason: "TOKEN_INVALID",
      requestMetadata: input.requestMetadata,
    });
  }

  const sourceToken = await appointmentsRepo.getAppointmentTokenById(
    claims.sourceTokenId
  );
  if (
    !sourceToken ||
    sourceToken.appointmentId !== claims.appointmentId ||
    sourceToken.role !== claims.actorRole
  ) {
    await failVisitChatValidation({
      reason: "TOKEN_INVALID",
      requestMetadata: input.requestMetadata,
    });
  }

  const now = new Date();
  if (sourceToken.revokedAt) {
    await failVisitChatValidation({
      reason: "TOKEN_REVOKED",
      requestMetadata: input.requestMetadata,
    });
  }
  if (sourceToken.expiresAt.getTime() <= now.getTime()) {
    await failVisitChatValidation({
      reason: "TOKEN_EXPIRED",
      requestMetadata: input.requestMetadata,
    });
  }

  const appointment = await appointmentsRepo.getAppointmentById(
    claims.appointmentId
  );
  if (!appointment) {
    await failVisitChatValidation({
      reason: "APPOINTMENT_NOT_FOUND",
      requestMetadata: input.requestMetadata,
    });
  }

  const policyFailure = getVisitAccessPolicyFailure({
    appointment,
    action: input.action ?? "join_room",
    now,
  });
  if (policyFailure) {
    await failVisitChatValidation({
      reason: policyFailure,
      requestMetadata: input.requestMetadata,
    });
  }

  incrementMetric("visit_chat_token_validation_success_total");
  if (process.env.NODE_ENV !== "test") {
    logger.info("validation_succeeded", {
      appointmentId: appointment.id,
      role: claims.actorRole,
      sourceTokenId: sourceToken.id,
      clientIp,
      requestId: input.requestMetadata?.requestId ?? null,
    });
  }

  return {
    appointmentId: appointment.id,
    role: claims.actorRole,
    sourceTokenId: sourceToken.id,
    sourceExpiresAt: sourceToken.expiresAt,
    expiresAt: claims.expiresAt,
    appointment,
  };
}

function toExchangeResult(
  token: string,
  input: {
    appointmentId: number;
    role: "patient" | "doctor";
    expiresAt: Date;
  }
) {
  return {
    token,
    appointmentId: input.appointmentId,
    role: input.role,
    purpose: "visit_chat" as const,
    expiresAt: input.expiresAt,
  };
}

export async function exchangeAppointmentTokenForVisitChat(input: {
  appointmentId: number;
  token: string;
  requestMetadata?: RequestMetadata;
}) {
  const source = await validateAppointmentAccessToken({
    token: input.token,
    action: "join_room",
    expectedAppointmentId: input.appointmentId,
    requestMetadata: input.requestMetadata,
  });
  const issued = await issueVisitChatToken({
    appointmentId: source.appointmentId,
    actorRole: source.role,
    sourceTokenId: source.tokenId,
    sourceExpiresAt: source.expiresAt,
  });
  return toExchangeResult(issued.token, {
    appointmentId: source.appointmentId,
    role: source.role,
    expiresAt: issued.expiresAt,
  });
}

export async function refreshVisitChatAccessToken(input: {
  appointmentId: number;
  token: string;
  requestMetadata?: RequestMetadata;
}) {
  const current = await validateVisitChatAccessToken({
    token: input.token,
    action: "read_history",
    expectedAppointmentId: input.appointmentId,
    requestMetadata: input.requestMetadata,
  });
  const issued = await issueVisitChatToken({
    appointmentId: current.appointmentId,
    actorRole: current.role,
    sourceTokenId: current.sourceTokenId,
    sourceExpiresAt: current.sourceExpiresAt,
  });
  return toExchangeResult(issued.token, {
    appointmentId: current.appointmentId,
    role: current.role,
    expiresAt: issued.expiresAt,
  });
}

export async function validateVisitChatTokenForAppointment(
  appointmentId: number,
  token: string,
  action: VisitAccessAction = "join_room",
  requestMetadata?: RequestMetadata
) {
  const validated = await validateVisitChatAccessToken({
    token,
    action,
    expectedAppointmentId: appointmentId,
    requestMetadata,
  });
  const touchedAt = new Date();
  if (validated.role === "patient") {
    await appointmentsRepo.updateAppointmentById(appointmentId, {
      lastAccessAt: touchedAt,
    });
    return {
      role: "patient" as const,
      appointment: { ...validated.appointment, lastAccessAt: touchedAt },
    };
  }

  await appointmentsRepo.updateAppointmentById(appointmentId, {
    doctorLastAccessAt: touchedAt,
  });
  return {
    role: "doctor" as const,
    appointment: {
      ...validated.appointment,
      doctorLastAccessAt: touchedAt,
    },
  };
}
