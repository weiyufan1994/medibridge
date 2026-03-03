import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appointments } from "../drizzle/schema";
import * as appointmentsRepo from "./modules/appointments/repo";
import { sendMagicLinkEmail } from "./_core/mailer";
import {
  generateToken,
  hashToken,
  verifyToken,
} from "./_core/appointmentToken";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const APPOINTMENT_TYPE_VALUES = [
  "online_chat",
  "video_call",
  "in_person",
] as const;

const createScheduledAtSchema = z
  .union([z.string().datetime(), z.date()])
  .transform(value => (value instanceof Date ? value : new Date(value)))
  .refine(value => !Number.isNaN(value.getTime()), "Invalid datetime");

const accessInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  token: z.string().min(16).max(512),
});

const rescheduleInputSchema = accessInputSchema.extend({
  newScheduledAt: createScheduledAtSchema,
});

const createInputSchema = z.object({
  doctorId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  scheduledAt: createScheduledAtSchema,
  email: z
    .string()
    .trim()
    .email()
    .transform(value => value.toLowerCase()),
  sessionId: z.string().trim().min(1).max(64).optional(),
});

const resendInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  email: z
    .string()
    .trim()
    .email()
    .transform(value => value.toLowerCase()),
});

const appointmentPublicSchema = z.object({
  id: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  scheduledAt: z.date().nullable(),
  status: z.enum([
    "pending",
    "confirmed",
    "rescheduled",
    "completed",
    "cancelled",
  ]),
  email: z.string().email(),
  sessionId: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastAccessAt: z.date().nullable(),
});

const appointmentParticipantSchema = z.object({
  role: z.enum(["patient", "doctor"]),
  patient: z.object({
    email: z.string().email(),
    sessionId: z.string().nullable(),
  }),
  doctor: z.object({
    id: z.number().int().positive(),
  }),
});

const appointmentAccessOutputSchema = appointmentPublicSchema.extend({
  ...appointmentParticipantSchema.shape,
});

const createOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  devLink: z.string().url().optional(),
  devDoctorLink: z.string().url().optional(),
});

const joinInfoOutputSchema = appointmentParticipantSchema.extend({
  appointmentId: z.number().int().positive(),
  joinUrl: z.string().url(),
});

const resendOutputSchema = z.object({
  ok: z.literal(true),
  devLink: z.string().url().optional(),
});
const listMineInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});
const listMineOutputSchema = z.array(appointmentPublicSchema);

const CONSULTATION_DURATION_MINUTES = 60;
const TOKEN_RESEND_COOLDOWN_MS = 60_000;
const resendRateLimitByAppointmentId = new Map<number, number>();

function computeDefaultTokenExpiry(scheduledAt: Date): Date {
  // Keep links valid for 7 days after an assumed 60-minute consultation.
  const expiresAt = new Date(
    scheduledAt.getTime() + CONSULTATION_DURATION_MINUTES * 60 * 1000
  );
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
}

function getBaseUrl(ctx: TrpcContext): string {
  const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  const protocol = ctx.req.protocol || "http";
  const host =
    ctx.req.get?.("host") || ctx.req.headers.host || "localhost:3000";
  return `${protocol}://${host}`;
}

function buildAppointmentMagicLink(
  baseUrl: string,
  appointmentId: number,
  token: string
): string {
  return `${baseUrl}/appointment/${appointmentId}?t=${encodeURIComponent(token)}`;
}

function buildVisitUrl(
  baseUrl: string,
  appointmentId: number,
  token: string
): string {
  return `${baseUrl}/visit/${appointmentId}?t=${encodeURIComponent(token)}`;
}

function getPublicUrlBase(): string {
  const configuredPublicUrl = process.env.PUBLIC_URL?.trim();
  return (configuredPublicUrl || "http://localhost:5173").replace(/\/$/, "");
}

function buildVisitDebugUrl(
  baseUrl: string,
  appointmentId: number,
  token: string
): string {
  const encodedToken = encodeURIComponent(token);
  return `${baseUrl}/visit/${appointmentId}?t=${encodedToken}&token=${encodedToken}`;
}

function toPublicAppointment(appointment: typeof appointments.$inferSelect) {
  return {
    id: appointment.id,
    doctorId: appointment.doctorId,
    appointmentType: appointment.appointmentType,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    email: appointment.email,
    sessionId: appointment.sessionId,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    lastAccessAt: appointment.lastAccessAt,
  };
}

async function getAppointmentByIdOrThrow(appointmentId: number) {
  const appointment = await appointmentsRepo.getAppointmentById(appointmentId);
  if (!appointment) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Appointment not found",
    });
  }

  return appointment;
}

export async function validateAppointmentToken(
  appointmentId: number,
  token: string
) {
  const appointment = await getAppointmentByIdOrThrow(appointmentId);
  const now = Date.now();
  const isPatientToken = verifyToken(token, appointment.accessTokenHash);
  const isDoctorToken =
    typeof appointment.doctorTokenHash === "string" &&
    appointment.doctorTokenHash.length > 0 &&
    verifyToken(token, appointment.doctorTokenHash);

  if (isPatientToken) {
    if (appointment.accessTokenRevokedAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Magic link has been revoked",
      });
    }

    if (appointment.accessTokenExpiresAt.getTime() <= now) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Magic link has expired",
      });
    }

    const touchedAt = new Date();
    await appointmentsRepo.updateAppointmentById(appointment.id, {
      lastAccessAt: touchedAt,
    });

    return {
      role: "patient" as const,
      appointment: {
        ...appointment,
        lastAccessAt: touchedAt,
      },
    };
  }

  if (isDoctorToken) {
    if (appointment.doctorTokenRevokedAt) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Doctor magic link has been revoked",
      });
    }

    if (appointment.accessTokenExpiresAt.getTime() <= now) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Doctor magic link has expired",
      });
    }

    const touchedAt = new Date();
    await appointmentsRepo.updateAppointmentById(appointment.id, {
      doctorLastAccessAt: touchedAt,
    });

    return {
      role: "doctor" as const,
      appointment: {
        ...appointment,
        doctorLastAccessAt: touchedAt,
      },
    };
  }

  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Invalid magic link token",
  });
}

function assertPatientRole(role: "patient" | "doctor") {
  if (role !== "patient") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires a patient magic link",
    });
  }
}

async function resolveInsertedAppointmentId(
  insertResult: unknown,
  fallbackLookup: {
    doctorId: number;
    email: string;
    scheduledAt: Date;
  }
): Promise<number> {
  const directInsertId = Number(
    (insertResult as { insertId?: number })?.insertId ??
      (Array.isArray(insertResult)
        ? (insertResult[0] as { insertId?: number } | undefined)?.insertId
        : NaN)
  );

  if (Number.isInteger(directInsertId) && directInsertId > 0) {
    return directInsertId;
  }

  const resolvedId =
    await appointmentsRepo.findLatestAppointmentIdByLookup(fallbackLookup);

  if (!resolvedId) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to resolve appointment ID after creation",
    });
  }

  return resolvedId;
}

export const appointmentsRouter = router({
  listMine: protectedProcedure
    .input(listMineInputSchema)
    .output(listMineOutputSchema)
    .query(async ({ ctx, input }) => {
      const appointments = await appointmentsRepo.listAppointmentsByUserScope({
        userId: ctx.user.id,
        email: ctx.user.email,
        limit: input.limit,
      });
      return appointments.map(toPublicAppointment);
    }),
  create: publicProcedure
    .input(createInputSchema)
    .output(createOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const currentUserEmail = ctx.user?.email?.trim().toLowerCase();
      if (!currentUserEmail || currentUserEmail !== input.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "请先验证您的邮箱以确认身份",
        });
      }

      const patientToken = generateToken();
      const patientTokenHash = hashToken(patientToken);
      const doctorToken = generateToken();
      const doctorTokenHash = hashToken(doctorToken);
      const accessTokenExpiresAt = computeDefaultTokenExpiry(input.scheduledAt);

      const insertResult = await appointmentsRepo.createAppointment({
        doctorId: input.doctorId,
        appointmentType: input.appointmentType,
        scheduledAt: input.scheduledAt,
        sessionId: input.sessionId,
        email: input.email,
        accessTokenHash: patientTokenHash,
        doctorTokenHash,
        accessTokenExpiresAt,
      });

      const appointmentId = await resolveInsertedAppointmentId(insertResult, {
        doctorId: input.doctorId,
        email: input.email,
        scheduledAt: input.scheduledAt,
      });

      const baseUrl = getBaseUrl(ctx);
      const patientLink = buildAppointmentMagicLink(
        baseUrl,
        appointmentId,
        patientToken
      );
      const doctorLink = buildVisitUrl(baseUrl, appointmentId, doctorToken);

      // TODO: 未来在此接入向医生发送包含专属链接的短信/邮件通知 API。
      if (process.env.NODE_ENV !== "production") {
        const publicUrlBase = getPublicUrlBase();
        const patientUrl = buildVisitDebugUrl(
          publicUrlBase,
          appointmentId,
          patientToken
        );
        const doctorUrl = buildVisitDebugUrl(
          publicUrlBase,
          appointmentId,
          doctorToken
        );

        console.log(
          [
            "",
            "============================================================",
            "=== MediBridge Local Visit Entry Links =====================",
            `【医生端】${doctorUrl}`,
            "医生端请复制到浏览器的无痕模式打开以避免 Cookie 冲突",
            `【患者端】${patientUrl}`,
            "============================================================",
            "",
          ].join("\n")
        );
      }

      await sendMagicLinkEmail(input.email, patientLink);

      return {
        appointmentId,
        devLink:
          process.env.NODE_ENV === "development" ? patientLink : undefined,
        devDoctorLink:
          process.env.NODE_ENV === "development" ? doctorLink : undefined,
      };
    }),

  getByToken: publicProcedure
    .input(accessInputSchema)
    .output(appointmentAccessOutputSchema)
    .query(async ({ input }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );
      return {
        ...toPublicAppointment(appointment),
        role,
        patient: {
          email: appointment.email,
          sessionId: appointment.sessionId,
        },
        doctor: {
          id: appointment.doctorId,
        },
      };
    }),

  rescheduleByToken: publicProcedure
    .input(rescheduleInputSchema)
    .output(appointmentPublicSchema)
    .mutation(async ({ input }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );
      assertPatientRole(role);
      const nextAccessTokenExpiresAt = computeDefaultTokenExpiry(
        input.newScheduledAt
      );

      await appointmentsRepo.updateAppointmentById(appointment.id, {
        scheduledAt: input.newScheduledAt,
        status: appointment.status === "cancelled" ? "cancelled" : "rescheduled",
        accessTokenExpiresAt: nextAccessTokenExpiresAt,
        updatedAt: new Date(),
      });

      const updated = await appointmentsRepo.getAppointmentById(appointment.id);
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Appointment disappeared after reschedule",
        });
      }

      return toPublicAppointment(updated);
    }),

  joinInfoByToken: publicProcedure
    .input(accessInputSchema)
    .output(joinInfoOutputSchema)
    .query(async ({ input, ctx }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token
      );
      const baseUrl = getBaseUrl(ctx);

      return {
        appointmentId: appointment.id,
        joinUrl: buildVisitUrl(baseUrl, appointment.id, input.token),
        role,
        patient: {
          email: appointment.email,
          sessionId: appointment.sessionId,
        },
        doctor: {
          id: appointment.doctorId,
        },
      };
    }),

  resendLink: publicProcedure
    .input(resendInputSchema)
    .output(resendOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const lastResentAt = resendRateLimitByAppointmentId.get(
        input.appointmentId
      );
      if (
        lastResentAt &&
        Date.now() - lastResentAt < TOKEN_RESEND_COOLDOWN_MS
      ) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Please wait at least 1 minute before resending again",
        });
      }

      const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
      if (appointment.email.toLowerCase() !== input.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Email does not match appointment",
        });
      }
      resendRateLimitByAppointmentId.set(input.appointmentId, Date.now());

      const token = generateToken();
      const tokenHash = hashToken(token);
      const accessTokenExpiresAt = computeDefaultTokenExpiry(
        appointment.scheduledAt ?? new Date()
      );

      await appointmentsRepo.updateAppointmentById(appointment.id, {
        accessTokenHash: tokenHash,
        accessTokenExpiresAt,
        accessTokenRevokedAt: null,
        updatedAt: new Date(),
      });

      const baseUrl = getBaseUrl(ctx);
      const link = buildAppointmentMagicLink(baseUrl, appointment.id, token);
      await sendMagicLinkEmail(input.email, link);

      return {
        ok: true as const,
        devLink: process.env.NODE_ENV === "development" ? link : undefined,
      };
    }),
});
