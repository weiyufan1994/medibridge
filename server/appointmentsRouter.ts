import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appointments } from "../drizzle/schema";
import * as aiRepo from "./modules/ai/repo";
import * as appointmentsRepo from "./modules/appointments/repo";
import { sendMagicLinkEmail } from "./_core/mailer";
import {
  generateToken,
  hashToken,
  verifyToken,
} from "./_core/appointmentToken";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { createStripeCheckoutSession } from "./modules/payments/stripe";
import { invokeLLM } from "./_core/llm";
import {
  clearCachedPatientAccessToken,
  getCachedPatientAccessToken,
  setCachedPatientAccessToken,
} from "./modules/appointments/tokenCache";

const APPOINTMENT_TYPE_VALUES = [
  "online_chat",
  "video_call",
  "in_person",
] as const;

const APPOINTMENT_STATUS_VALUES = [
  "draft",
  "pending_payment",
  "paid",
  "confirmed",
  "in_session",
  "completed",
  "expired",
  "refunded",
] as const;

const PAYMENT_STATUS_VALUES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
] as const;

const createScheduledAtSchema = z
  .union([z.string().datetime(), z.date()])
  .transform(value => (value instanceof Date ? value : new Date(value)))
  .refine(value => !Number.isNaN(value.getTime()), "Invalid datetime");

const accessInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  token: z.string().min(16).max(512),
});
const accessWithLangInputSchema = accessInputSchema.extend({
  lang: z.enum(["en", "zh"]).optional().default("en"),
});

const rescheduleInputSchema = accessInputSchema.extend({
  newScheduledAt: createScheduledAtSchema,
});

const createInputSchema = z.object({
  doctorId: z.number().int().positive(),
  triageSessionId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  scheduledAt: createScheduledAtSchema,
  email: z
    .string()
    .trim()
    .email()
    .transform(value => value.toLowerCase()),
  sessionId: z.string().trim().min(1).max(64).optional(),
});

const resendLinkInputSchema = z.object({
  appointmentId: z.number().int().positive(),
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
  triageSessionId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  scheduledAt: z.date().nullable(),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  amount: z.number().int().nonnegative(),
  currency: z.string(),
  paidAt: z.date().nullable(),
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
  triageSummary: z.string().nullable(),
});

const createOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  checkoutUrl: z.string().url(),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  stripeSessionId: z.string().optional(),
});

const joinInfoOutputSchema = appointmentParticipantSchema.extend({
  appointmentId: z.number().int().positive(),
  joinUrl: z.string().url(),
});

const resendOutputSchema = z.object({
  ok: z.literal(true),
  devLink: z.string().url().optional(),
});

const resendDoctorOutputSchema = z.object({
  ok: z.literal(true),
  devDoctorLink: z.string().url().optional(),
});

const listMineInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});

const listMineOutputSchema = z.array(appointmentPublicSchema);

const CONSULTATION_DURATION_MINUTES = 60;
const TOKEN_RESEND_COOLDOWN_MS = 60_000;
const RESEND_ALLOWED_STATUS = new Set<string>(["paid", "confirmed", "in_session"]);
const resendRateLimitByAppointmentId = new Map<number, number>();
const resendDoctorRateLimitByAppointmentId = new Map<number, number>();
const triageSummaryTranslationCache = new Map<string, string>();

function getPricingByAppointmentType(
  appointmentType: (typeof APPOINTMENT_TYPE_VALUES)[number]
) {
  if (appointmentType === "online_chat") {
    return { amount: 2900, currency: "usd" };
  }
  if (appointmentType === "video_call") {
    return { amount: 4900, currency: "usd" };
  }
  return { amount: 8900, currency: "usd" };
}

function computeDefaultTokenExpiry(scheduledAt: Date): Date {
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

function hasActivePatientToken(appointment: {
  accessTokenHash: string | null;
  accessTokenExpiresAt: Date | null;
  accessTokenRevokedAt: Date | null;
}) {
  return Boolean(
    appointment.accessTokenHash &&
      appointment.accessTokenExpiresAt &&
      appointment.accessTokenExpiresAt.getTime() > Date.now() &&
      !appointment.accessTokenRevokedAt
  );
}

function getPublicUrlBase(): string {
  const configuredPublicUrl = process.env.PUBLIC_URL?.trim();
  return (configuredPublicUrl || "http://localhost:5173").replace(/\/$/, "");
}

function readAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map(item =>
      item && typeof item === "object" && "type" in item && (item as { type?: string }).type === "text"
        ? String((item as { text?: unknown }).text ?? "")
        : ""
    )
    .join("")
    .trim();
}

async function translateTriageSummary(
  summary: string,
  targetLang: "en" | "zh"
): Promise<string> {
  const normalized = summary.trim();
  if (!normalized) {
    return normalized;
  }

  const hasZh = /[\u4e00-\u9fff]/.test(normalized);
  const hasEn = /[A-Za-z]/.test(normalized);
  if ((targetLang === "en" && !hasZh) || (targetLang === "zh" && !hasEn)) {
    return normalized;
  }

  const cacheKey = `${targetLang}:${normalized}`;
  const cached = triageSummaryTranslationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            targetLang === "en"
              ? "Translate the medical triage summary to natural English. Keep the same fields and semicolon-separated structure. Output plain text only."
              : "将这段医疗分诊摘要翻译成自然中文。保留原有字段和分号分隔结构。只输出纯文本。",
        },
        { role: "user", content: normalized },
      ],
      maxTokens: 400,
      responseFormat: { type: "text" },
    });

    const translated = readAssistantText(response.choices?.[0]?.message?.content).trim();
    if (!translated) {
      return normalized;
    }

    triageSummaryTranslationCache.set(cacheKey, translated);
    if (triageSummaryTranslationCache.size > 200) {
      const first = triageSummaryTranslationCache.keys().next().value;
      if (typeof first === "string") {
        triageSummaryTranslationCache.delete(first);
      }
    }
    return translated;
  } catch (error) {
    console.warn("[appointments] triage summary translation failed:", error);
    return normalized;
  }
}

function toPublicAppointment(appointment: typeof appointments.$inferSelect) {
  return {
    id: appointment.id,
    doctorId: appointment.doctorId,
    triageSessionId: appointment.triageSessionId,
    appointmentType: appointment.appointmentType,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    amount: appointment.amount,
    currency: appointment.currency,
    paidAt: appointment.paidAt,
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

type VisitAccessAction = "join_room" | "read_history" | "send_message";

function ensureAppointmentStatusAllowsVisit(input: {
  status: (typeof APPOINTMENT_STATUS_VALUES)[number];
  paymentStatus: (typeof PAYMENT_STATUS_VALUES)[number];
  action: VisitAccessAction;
}) {
  if (input.paymentStatus !== "paid") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Appointment payment has not been completed",
    });
  }

  if (
    input.status === "draft" ||
    input.status === "pending_payment" ||
    input.status === "expired" ||
    input.status === "refunded"
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Appointment status does not allow visit access",
    });
  }

  if (input.action === "send_message" && input.status === "completed") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Completed appointment is read-only",
    });
  }
}

export async function validateAppointmentToken(
  appointmentId: number,
  token: string,
  action: VisitAccessAction = "join_room"
) {
  const appointment = await getAppointmentByIdOrThrow(appointmentId);
  const now = Date.now();
  const isPatientToken =
    typeof appointment.accessTokenHash === "string" &&
    appointment.accessTokenHash.length > 0 &&
    verifyToken(token, appointment.accessTokenHash);
  const isDoctorToken =
    typeof appointment.doctorTokenHash === "string" &&
    appointment.doctorTokenHash.length > 0 &&
    verifyToken(token, appointment.doctorTokenHash);

  if (!isPatientToken && !isDoctorToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid magic link token",
    });
  }

  if (!appointment.accessTokenExpiresAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Magic link not issued yet",
    });
  }

  if (appointment.accessTokenExpiresAt.getTime() <= now) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Magic link has expired",
    });
  }

  if (isPatientToken && appointment.accessTokenRevokedAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Magic link has been revoked",
    });
  }

  if (isDoctorToken && appointment.doctorTokenRevokedAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Doctor magic link has been revoked",
    });
  }

  ensureAppointmentStatusAllowsVisit({
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    action,
  });

  const touchedAt = new Date();

  if (isPatientToken) {
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
    triageSessionId: number;
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
      const appointmentRows = await appointmentsRepo.listAppointmentsByUserScope({
        userId: ctx.user.id,
        email: ctx.user.email,
        limit: input.limit,
      });
      return appointmentRows.map(toPublicAppointment);
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

      const triageSession = await aiRepo.getAiChatSessionById(input.triageSessionId);
      if (!triageSession || triageSession.userId !== ctx.user?.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid triage session for appointment",
        });
      }

      const pricing = getPricingByAppointmentType(input.appointmentType);
      const insertResult = await appointmentsRepo.createAppointmentDraft({
        doctorId: input.doctorId,
        triageSessionId: input.triageSessionId,
        appointmentType: input.appointmentType,
        scheduledAt: input.scheduledAt,
        sessionId: input.sessionId,
        email: input.email,
        amount: pricing.amount,
        currency: pricing.currency,
        userId: ctx.user?.id,
      });

      const appointmentId = await resolveInsertedAppointmentId(insertResult, {
        doctorId: input.doctorId,
        email: input.email,
        scheduledAt: input.scheduledAt,
        triageSessionId: input.triageSessionId,
      });

      await appointmentsRepo.insertStatusEvent({
        appointmentId,
        fromStatus: null,
        toStatus: "draft",
        operatorType: "patient",
        operatorId: ctx.user?.id,
        reason: "appointment_draft_created",
      });

      const publicUrlBase = getPublicUrlBase();
      const checkout = createStripeCheckoutSession({
        appointmentId,
        amount: pricing.amount,
        currency: pricing.currency,
        successUrl: `${publicUrlBase}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${publicUrlBase}/triage`,
      });

      await appointmentsRepo.markAppointmentPendingPayment({
        appointmentId,
        stripeSessionId: checkout.id,
      });

      await appointmentsRepo.insertStatusEvent({
        appointmentId,
        fromStatus: "draft",
        toStatus: "pending_payment",
        operatorType: "system",
        operatorId: ctx.user?.id,
        reason: "checkout_session_created",
        payloadJson: {
          stripeSessionId: checkout.id,
        },
      });

      return {
        appointmentId,
        checkoutUrl: checkout.url,
        status: "pending_payment",
        paymentStatus: "pending",
        stripeSessionId:
          process.env.NODE_ENV === "development" ? checkout.id : undefined,
      };
    }),

  getByToken: publicProcedure
    .input(accessWithLangInputSchema)
    .output(appointmentAccessOutputSchema)
    .query(async ({ input }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "join_room"
      );

      const triageSession = await aiRepo.getAiChatSessionById(
        appointment.triageSessionId
      );

      const localizedSummary = triageSession?.summary
        ? await translateTriageSummary(triageSession.summary, input.lang)
        : null;

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
        triageSummary: localizedSummary,
      };
    }),

  rescheduleByToken: publicProcedure
    .input(rescheduleInputSchema)
    .output(appointmentPublicSchema)
    .mutation(async ({ input }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "join_room"
      );
      assertPatientRole(role);
      const nextAccessTokenExpiresAt = computeDefaultTokenExpiry(
        input.newScheduledAt
      );

      await appointmentsRepo.updateAppointmentById(appointment.id, {
        scheduledAt: input.newScheduledAt,
        status:
          appointment.status === "completed" || appointment.status === "refunded"
            ? appointment.status
            : "confirmed",
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
        input.token,
        "join_room"
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
    .input(resendLinkInputSchema)
    .output(resendOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const lastResentAt = resendRateLimitByAppointmentId.get(
        input.appointmentId
      );
      if (lastResentAt && Date.now() - lastResentAt < TOKEN_RESEND_COOLDOWN_MS) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Please wait at least 1 minute before resending again",
        });
      }

      const appointment = await getAppointmentByIdOrThrow(input.appointmentId);

      if (appointment.status === "expired") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot resend link for expired appointment",
        });
      }

      if (appointment.status === "refunded") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot resend link for refunded appointment",
        });
      }

      if (appointment.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot resend visit link before payment is completed",
        });
      }

      if (!RESEND_ALLOWED_STATUS.has(appointment.status)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Cannot resend link when appointment status is ${appointment.status}`,
        });
      }

      const baseUrl = getBaseUrl(ctx);
      const activeToken = hasActivePatientToken(appointment);
      if (activeToken) {
        const cached = getCachedPatientAccessToken(appointment.id);
        if (!cached || !verifyToken(cached.token, appointment.accessTokenHash!)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "An active link already exists and cannot be reissued without rotation",
          });
        }

        resendRateLimitByAppointmentId.set(input.appointmentId, Date.now());
        const link = buildAppointmentMagicLink(baseUrl, appointment.id, cached.token);
        await sendMagicLinkEmail(appointment.email, link);

        return {
          ok: true as const,
          devLink: process.env.NODE_ENV === "development" ? link : undefined,
        };
      }

      resendRateLimitByAppointmentId.set(input.appointmentId, Date.now());

      const token = generateToken();
      const tokenHash = hashToken(token);
      const accessTokenExpiresAt = computeDefaultTokenExpiry(
        appointment.scheduledAt ?? new Date()
      );

      clearCachedPatientAccessToken(appointment.id);
      await appointmentsRepo.updateAppointmentById(appointment.id, {
        accessTokenHash: tokenHash,
        accessTokenExpiresAt,
        accessTokenRevokedAt: null,
        updatedAt: new Date(),
      });

      setCachedPatientAccessToken(appointment.id, token, accessTokenExpiresAt);
      const link = buildAppointmentMagicLink(baseUrl, appointment.id, token);
      await sendMagicLinkEmail(appointment.email, link);

      return {
        ok: true as const,
        devLink: process.env.NODE_ENV === "development" ? link : undefined,
      };
    }),

  resendDoctorLink: publicProcedure
    .input(resendInputSchema)
    .output(resendDoctorOutputSchema)
    .mutation(async ({ input, ctx }) => {
      if (process.env.NODE_ENV !== "development") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Resending doctor link is only enabled in development",
        });
      }

      const lastResentAt = resendDoctorRateLimitByAppointmentId.get(
        input.appointmentId
      );
      if (lastResentAt && Date.now() - lastResentAt < TOKEN_RESEND_COOLDOWN_MS) {
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

      if (appointment.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot resend visit link before payment is completed",
        });
      }

      resendDoctorRateLimitByAppointmentId.set(input.appointmentId, Date.now());

      const doctorToken = generateToken();
      const doctorTokenHash = hashToken(doctorToken);
      const accessTokenExpiresAt = computeDefaultTokenExpiry(
        appointment.scheduledAt ?? new Date()
      );

      await appointmentsRepo.updateAppointmentById(appointment.id, {
        doctorTokenHash,
        doctorTokenRevokedAt: null,
        accessTokenExpiresAt,
        updatedAt: new Date(),
      });

      const baseUrl = getBaseUrl(ctx);
      const doctorLink = buildVisitUrl(baseUrl, appointment.id, doctorToken);

      console.log(`[Appointments][DEV] Doctor link: ${doctorLink}`);

      return {
        ok: true as const,
        devDoctorLink: doctorLink,
      };
    }),
});
