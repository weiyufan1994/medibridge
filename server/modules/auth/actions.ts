import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import type { TrpcContext } from "../../_core/context";
import { getSessionCookieOptions } from "../../_core/cookies";
import { createLogger } from "../../_core/logger";
import { sdk } from "../../_core/sdk";
import { doctorAccountAccessApi } from "../doctorAccounts/publicApi";
import type { RequestOtpInput } from "./schemas";

const OTP_TTL_MS = 10 * 60 * 1000;
const logger = createLogger("auth");
const otpStore = new Map<
  string,
  {
    code: string;
    expiresAtMs: number;
  }
>();

export type CookieRequest = Parameters<typeof getSessionCookieOptions>[0];
export type CookieResponse = {
  cookie: (
    name: string,
    value: string,
    options: Record<string, unknown>
  ) => void;
  clearCookie: (name: string, options: Record<string, unknown>) => void;
};

export type SessionUser = {
  id: number;
  openId: string | null;
  name: string | null;
  email: string | null;
};

function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function setSessionCookieByUser(input: {
  req: CookieRequest;
  res: CookieResponse;
  user: SessionUser;
}) {
  if (!input.user.openId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Formal user missing openId",
    });
  }

  const sessionToken = await sdk.createSessionToken(input.user.openId, {
    name: input.user.name ?? input.user.email ?? `user-${input.user.id}`,
  });
  const cookieOptions = getSessionCookieOptions(input.req);
  input.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
}

export async function getMeUser(user: TrpcContext["user"]) {
  if (!user) {
    return null;
  }

  let doctorBinding = null;
  if (user.isGuest === 0) {
    try {
      doctorBinding = await doctorAccountAccessApi.getActiveBindingByUserId(
        user.id
      );
    } catch (error) {
      logger.warn("doctor_binding.lookup_failed", {
        userId: user.id,
        error,
      });
    }
  }

  return {
    ...user,
    doctorBinding: doctorBinding
      ? {
          doctorId: doctorBinding.doctorId,
          userId: doctorBinding.userId,
          email: doctorBinding.email,
          status: doctorBinding.status,
          boundAt: doctorBinding.boundAt ?? null,
          revokedAt: doctorBinding.revokedAt ?? null,
        }
      : null,
  };
}

export function requestOtpAction(input: RequestOtpInput) {
  const code = generateOtpCode();
  const expiresAtMs = Date.now() + OTP_TTL_MS;
  otpStore.set(input.email, { code, expiresAtMs });

  logger.info("otp.generated", { expiresInMs: OTP_TTL_MS });

  return {
    success: true as const,
    expiresInMs: OTP_TTL_MS,
  };
}

export function consumeOtpCode(input: { email: string; code: string }) {
  const otpEntry = otpStore.get(input.email);
  if (!otpEntry || otpEntry.expiresAtMs < Date.now()) {
    otpStore.delete(input.email);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "OTP has expired or does not exist",
    });
  }

  if (otpEntry.code !== input.code) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid OTP code",
    });
  }

  otpStore.delete(input.email);
}

export function logoutAction(input: {
  req: CookieRequest;
  res: CookieResponse;
}) {
  const cookieOptions = getSessionCookieOptions(input.req);
  const { maxAge: _maxAge, ...clearCookieOptions } = cookieOptions as Record<
    string,
    unknown
  > & {
    maxAge?: number;
  };
  input.res.clearCookie(COOKIE_NAME, clearCookieOptions);
  return {
    success: true as const,
  };
}
