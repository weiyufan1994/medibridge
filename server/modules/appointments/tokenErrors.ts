import { TRPCError } from "@trpc/server";

export const TOKEN_ERROR_CODES = [
  "TOKEN_MISSING",
  "TOKEN_INVALID",
  "TOKEN_EXPIRED",
  "TOKEN_REVOKED",
  "TOKEN_MAX_USES",
  "APPOINTMENT_NOT_FOUND",
  "APPOINTMENT_NOT_ALLOWED",
  "APPOINTMENT_NOT_STARTED",
  "RATE_LIMITED",
] as const;

export type TokenErrorCode = (typeof TOKEN_ERROR_CODES)[number];

export function throwTokenError(error: TokenErrorCode): never {
  if (error === "RATE_LIMITED") {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: error });
  }

  if (error === "APPOINTMENT_NOT_FOUND") {
    throw new TRPCError({ code: "NOT_FOUND", message: error });
  }

  if (error === "APPOINTMENT_NOT_ALLOWED" || error === "APPOINTMENT_NOT_STARTED") {
    throw new TRPCError({ code: "FORBIDDEN", message: error });
  }

  throw new TRPCError({ code: "UNAUTHORIZED", message: error });
}
