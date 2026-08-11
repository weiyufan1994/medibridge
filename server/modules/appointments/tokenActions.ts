import type { RequestMetadata } from "@shared/requestMetadata";
import {
  revokeAppointmentAccessToken,
  validateAppointmentAccessToken,
} from "./tokenValidation";

export async function validateAccessTokenContext(input: {
  token: string;
  requestMetadata?: RequestMetadata;
}) {
  const result = await validateAppointmentAccessToken({
    token: input.token,
    requestMetadata: input.requestMetadata,
  });

  return {
    appointmentId: result.appointmentId,
    role: result.role,
    tokenId: result.tokenId,
    tokenHash: result.tokenHash,
    expiresAt: result.expiresAt,
    displayInfo: result.displayInfo,
  };
}

export async function revokeAccessTokenByInput(input: {
  appointmentId?: number;
  role?: "patient" | "doctor";
  token?: string;
  revokeReason?: string;
}) {
  const revokedCount = await revokeAppointmentAccessToken({
    appointmentId: input.appointmentId,
    role: input.role,
    token: input.token,
    reason: input.revokeReason,
  });

  return { ok: true as const, revokedCount };
}
