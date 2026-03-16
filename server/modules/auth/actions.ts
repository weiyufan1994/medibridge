import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import type { TrpcContext } from "../../_core/context";
import { getSessionCookieOptions } from "../../_core/cookies";
import { sdk } from "../../_core/sdk";
import * as appointmentsRepo from "../appointments/repo";
import { validateAppointmentAccessToken } from "../appointments/tokenValidation";
import * as authRepo from "./repo";
import * as doctorAccountRepo from "../doctorAccounts/repo";
import type { RequestOtpInput, VerifyMagicLinkInput, VerifyOtpInput } from "./schemas";

const OTP_TTL_MS = 10 * 60 * 1000;
const otpStore = new Map<
  string,
  {
    code: string;
    expiresAtMs: number;
  }
>();

type CookieRequest = Parameters<typeof getSessionCookieOptions>[0];
type CookieResponse = {
  cookie: (name: string, value: string, options: Record<string, unknown>) => void;
  clearCookie: (name: string, options: Record<string, unknown>) => void;
};

type SessionUser = {
  id: number;
  openId: string | null;
  name: string | null;
  email: string | null;
};

function buildEmailOpenId(email: string): string {
  const digest = crypto.createHash("sha256").update(email).digest("hex");
  return `email_${digest.slice(0, 40)}`;
}

function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function parseMagicToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Missing token" });
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const fromToken = url.searchParams.get("token");
      const fromT = url.searchParams.get("t");
      const parsed = (fromToken ?? fromT ?? "").trim();
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Fall through to raw token handling.
    }
  }

  return trimmed;
}

async function setSessionCookieByUser(input: {
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
      doctorBinding = await doctorAccountRepo.getActiveBindingByUserId(user.id);
    } catch (error) {
      console.warn(
        `[Auth] Failed to load doctor binding for user ${user.id}:`,
        error
      );
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

  // Temporary delivery strategy during migration phase.
  console.log(`[Auth][OTP][DEV] email=${input.email}, code=${code}`);

  return {
    success: true as const,
    expiresInMs: OTP_TTL_MS,
  };
}

export async function verifyOtpAndMergeAction(input: {
  payload: VerifyOtpInput;
  req: CookieRequest;
  res: CookieResponse;
}) {
  const otpEntry = otpStore.get(input.payload.email);
  if (!otpEntry || otpEntry.expiresAtMs < Date.now()) {
    otpStore.delete(input.payload.email);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "OTP has expired or does not exist",
    });
  }

  if (otpEntry.code !== input.payload.code) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid OTP code",
    });
  }

  otpStore.delete(input.payload.email);

  const formalUser = await authRepo.findOrCreateFormalUserByEmail({
    email: input.payload.email,
    openId: buildEmailOpenId(input.payload.email),
    loginMethod: "otp",
  });

  if (!formalUser) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create or resolve formal user",
    });
  }

  const guestUser = await authRepo.getGuestUserByDeviceId(input.payload.deviceId);
  if (guestUser) {
    await authRepo.mergeGuestDataIntoFormalUser({
      guestUserId: guestUser.id,
      formalUserId: formalUser.id,
    });
  }

  await appointmentsRepo.bindAppointmentsToUserByEmail(
    input.payload.email,
    formalUser.id
  );

  await setSessionCookieByUser({
    req: input.req,
    res: input.res,
    user: formalUser,
  });

  return {
    success: true as const,
    userId: formalUser.id,
    mergedGuestUserId: guestUser?.id ?? null,
  };
}

export async function verifyMagicLinkAction(input: {
  payload: VerifyMagicLinkInput;
  req: CookieRequest;
  res: CookieResponse;
  deviceId: string | null | undefined;
}) {
  const parsedToken = parseMagicToken(input.payload.token);
  const validated = await validateAppointmentAccessToken({
    token: parsedToken,
    expectedRole: "patient",
    expectedAppointmentId: input.payload.appointmentId,
    action: "join_room",
    req: input.req,
  });
  const appointment = validated.appointment;

  let targetUser = appointment.userId
    ? await authRepo.getUserById(appointment.userId)
    : undefined;
  const openId = buildEmailOpenId(appointment.email);

  if (!targetUser || targetUser.isGuest === 1) {
    const formalUser = await authRepo.findOrCreateFormalUserByEmail({
      email: appointment.email,
      openId,
      loginMethod: "magic_link",
    });
    if (!formalUser) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to resolve user from magic link",
      });
    }
    if (targetUser && targetUser.id !== formalUser.id) {
      await authRepo.mergeGuestDataIntoFormalUser({
        guestUserId: targetUser.id,
        formalUserId: formalUser.id,
      });
    }
    targetUser = formalUser;
  }

  if (input.deviceId) {
    const guestUser = await authRepo.getGuestUserByDeviceId(input.deviceId);
    if (guestUser && guestUser.id !== targetUser.id) {
      await authRepo.mergeGuestDataIntoFormalUser({
        guestUserId: guestUser.id,
        formalUserId: targetUser.id,
      });
    }
  }

  await appointmentsRepo.updateAppointmentById(appointment.id, {
    userId: targetUser.id,
    lastAccessAt: new Date(),
  });

  const refreshedAppointment =
    (await appointmentsRepo.getAppointmentById(appointment.id)) ?? appointment;

  await setSessionCookieByUser({
    req: input.req,
    res: input.res,
    user: targetUser,
  });

  return {
    success: true as const,
    userId: targetUser.id,
    appointmentId: refreshedAppointment.id,
  };
}

export function logoutAction(input: { req: CookieRequest; res: CookieResponse }) {
  const cookieOptions = getSessionCookieOptions(input.req);
  input.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  return {
    success: true as const,
  };
}
