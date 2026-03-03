import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";
import { z } from "zod";
import { hashToken, verifyToken } from "../_core/appointmentToken";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import * as appointmentsRepo from "../modules/appointments/repo";
import * as authRepo from "../modules/auth/repo";

const OTP_TTL_MS = 10 * 60 * 1000;
const otpStore = new Map<
  string,
  {
    code: string;
    expiresAtMs: number;
  }
>();

const emailInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform(value => value.toLowerCase()),
});

const verifyOtpInputSchema = emailInputSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/),
  deviceId: z.string().trim().min(8).max(128),
});

const verifyMagicLinkInputSchema = z.object({
  token: z.string().trim().min(16).max(2048),
  appointmentId: z.number().int().positive().optional(),
});

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

  // Support either raw token or a full URL that contains token/t query param.
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const fromToken = url.searchParams.get("token");
      const fromT = url.searchParams.get("t");
      const parsed = (fromToken ?? fromT ?? "").trim();
      if (parsed.length > 0) {
        return parsed;
      }
    } catch (_error) {
      // Fall back to treating input as raw token.
    }
  }

  return trimmed;
}

async function setSessionCookieByUser(ctx: {
  req: Parameters<typeof getSessionCookieOptions>[0];
  res: {
    cookie: (name: string, value: string, options: Record<string, unknown>) => void;
  };
}, user: NonNullable<Awaited<ReturnType<typeof authRepo.getFormalUserByEmail>>>) {
  if (!user.openId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Formal user missing openId",
    });
  }

  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name ?? user.email ?? `user-${user.id}`,
  });
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, cookieOptions);
}

export const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  requestOtp: publicProcedure
    .input(emailInputSchema)
    .mutation(({ input }) => {
      const code = generateOtpCode();
      const expiresAtMs = Date.now() + OTP_TTL_MS;
      otpStore.set(input.email, { code, expiresAtMs });

      // Temporary delivery strategy during migration phase.
      console.log(`[Auth][OTP][DEV] email=${input.email}, code=${code}`);

      return {
        success: true,
        expiresInMs: OTP_TTL_MS,
      } as const;
    }),
  verifyOtpAndMerge: publicProcedure
    .input(verifyOtpInputSchema)
    .mutation(async ({ input, ctx }) => {
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

      const formalUser =
        await authRepo.findOrCreateFormalUserByEmail({
          email: input.email,
          openId: buildEmailOpenId(input.email),
          loginMethod: "otp",
        });

      if (!formalUser) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create or resolve formal user",
        });
      }

      const guestUser = await authRepo.getGuestUserByDeviceId(input.deviceId);
      if (guestUser) {
        await authRepo.mergeGuestDataIntoFormalUser({
          guestUserId: guestUser.id,
          formalUserId: formalUser.id,
        });
      }

      // Ensure appointment records owned by this email are attached to formal user.
      await appointmentsRepo.bindAppointmentsToUserByEmail(
        input.email,
        formalUser.id
      );

      await setSessionCookieByUser(ctx, formalUser);

      return {
        success: true,
        userId: formalUser.id,
        mergedGuestUserId: guestUser?.id ?? null,
      } as const;
    }),
  verifyMagicLink: publicProcedure
    .input(verifyMagicLinkInputSchema)
    .mutation(async ({ input, ctx }) => {
      const parsedToken = parseMagicToken(input.token);
      let appointment = input.appointmentId
        ? await appointmentsRepo.getAppointmentById(input.appointmentId)
        : await appointmentsRepo.getAppointmentByAccessTokenHash(
            hashToken(parsedToken)
          );

      if (!appointment) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid magic link token",
        });
      }

      if (
        !appointment.accessTokenHash ||
        !verifyToken(parsedToken, appointment.accessTokenHash)
      ) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid magic link token",
        });
      }

      if (appointment.accessTokenRevokedAt) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Magic link has been revoked",
        });
      }

      if (
        !appointment.accessTokenExpiresAt ||
        appointment.accessTokenExpiresAt.getTime() <= Date.now()
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Magic link has expired",
        });
      }

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

      const deviceId = ctx.deviceId;
      if (deviceId) {
        const guestUser = await authRepo.getGuestUserByDeviceId(deviceId);
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

      appointment =
        (await appointmentsRepo.getAppointmentById(appointment.id)) ?? appointment;

      await setSessionCookieByUser(ctx, targetUser);

      return {
        success: true,
        userId: targetUser.id,
        appointmentId: appointment.id,
      } as const;
    }),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return {
      success: true,
    } as const;
  }),
});
