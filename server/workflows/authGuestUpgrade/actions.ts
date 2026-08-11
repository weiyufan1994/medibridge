import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { appointmentAuthApi } from "../../modules/appointments/publicApi";
import {
  authAccountApi,
  type CookieRequest,
  type CookieResponse,
  type VerifyMagicLinkInput,
  type VerifyOtpInput,
} from "../../modules/auth/publicApi";
import { mergeGuestAssetsIntoFormalUser } from "./guestAssets";

function buildEmailOpenId(email: string): string {
  const digest = crypto.createHash("sha256").update(email).digest("hex");
  return `email_${digest.slice(0, 40)}`;
}

function parseMagicToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Missing token" });
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const parsed = (
        url.searchParams.get("token") ??
        url.searchParams.get("t") ??
        ""
      ).trim();
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Preserve raw token handling for malformed URL-like values.
    }
  }

  return trimmed;
}

export async function verifyOtpAndMergeAction(input: {
  payload: VerifyOtpInput;
  req: CookieRequest;
  res: CookieResponse;
}) {
  authAccountApi.consumeOtpCode({
    email: input.payload.email,
    code: input.payload.code,
  });

  const formalUser = await authAccountApi.findOrCreateFormalUserByEmail({
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

  const guestUser = await authAccountApi.getGuestUserByDeviceId(
    input.payload.deviceId
  );
  if (guestUser) {
    await mergeGuestAssetsIntoFormalUser({
      guestUserId: guestUser.id,
      formalUserId: formalUser.id,
    });
  }

  await appointmentAuthApi.bindAppointmentsToUserByEmail(
    input.payload.email,
    formalUser.id
  );
  await authAccountApi.setSessionCookieByUser({
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
  const validated = await appointmentAuthApi.validateAppointmentAccessToken({
    token: parseMagicToken(input.payload.token),
    expectedRole: "patient",
    expectedAppointmentId: input.payload.appointmentId,
    action: "join_room",
    req: input.req,
  });
  const appointment = validated.appointment;

  let targetUser = appointment.userId
    ? await authAccountApi.getUserById(appointment.userId)
    : undefined;
  if (!targetUser || targetUser.isGuest === 1) {
    const formalUser = await authAccountApi.findOrCreateFormalUserByEmail({
      email: appointment.email,
      openId: buildEmailOpenId(appointment.email),
      loginMethod: "magic_link",
    });
    if (!formalUser) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to resolve user from magic link",
      });
    }
    if (targetUser && targetUser.id !== formalUser.id) {
      await mergeGuestAssetsIntoFormalUser({
        guestUserId: targetUser.id,
        formalUserId: formalUser.id,
      });
    }
    targetUser = formalUser;
  }

  if (input.deviceId) {
    const guestUser = await authAccountApi.getGuestUserByDeviceId(
      input.deviceId
    );
    if (guestUser && guestUser.id !== targetUser.id) {
      await mergeGuestAssetsIntoFormalUser({
        guestUserId: guestUser.id,
        formalUserId: targetUser.id,
      });
    }
  }

  await appointmentAuthApi.updateAppointmentById(appointment.id, {
    userId: targetUser.id,
    lastAccessAt: new Date(),
  });
  const refreshedAppointment =
    (await appointmentAuthApi.getAppointmentById(appointment.id)) ??
    appointment;

  await authAccountApi.setSessionCookieByUser({
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
