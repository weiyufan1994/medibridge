import { TRPCError } from "@trpc/server";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { z } from "zod";
import { appointments } from "../drizzle/schema";
import * as aiRepo from "./modules/ai/repo";
import * as appointmentsRepo from "./modules/appointments/repo";
import { sendMagicLinkEmail } from "./_core/mailer";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";
import { createStripeCheckoutSession } from "./modules/payments/stripe";
import { reinitiateCheckoutForAppointment } from "./paymentsRouter";
import { invokeLLM } from "./_core/llm";
import {
  setCachedPatientAccessToken,
} from "./modules/appointments/tokenCache";
import { getPublicBaseUrl } from "./core/getPublicBaseUrl";
import { buildAppointmentAccessLink } from "./modules/appointments/linkService";
import {
  issueAppointmentAccessLinks,
} from "./modules/appointments/tokenService";
import {
  revokeAppointmentAccessToken,
  type VisitAccessAction,
  validateAppointmentAccessToken,
} from "./modules/appointments/tokenValidation";
import {
  APPOINTMENT_INVALID_TRANSITION_ERROR,
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
} from "./modules/appointments/stateMachine";

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
  intake: z
    .object({
      chiefComplaint: z.string().trim().max(500).optional(),
      duration: z.string().trim().max(200).optional(),
      medicalHistory: z.string().trim().max(1000).optional(),
      medications: z.string().trim().max(1000).optional(),
      allergies: z.string().trim().max(500).optional(),
      ageGroup: z.string().trim().max(64).optional(),
      otherSymptoms: z.string().trim().max(1000).optional(),
    })
    .optional(),
});

const createV2InputSchema = z.object({
  doctorId: z.number().int().positive(),
  contact: z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .transform(value => value.toLowerCase())
        .optional(),
      phone: z.string().trim().min(6).max(32).optional(),
    })
    .refine(value => Boolean(value.email || value.phone), {
      message: "email or phone is required",
    }),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES).optional(),
  packageId: z.string().trim().min(1).max(64).optional(),
  scheduledAt: createScheduledAtSchema.optional(),
  triageSessionId: z.number().int().positive().optional(),
  sessionId: z.string().trim().min(1).max(64).optional(),
  intake: z
    .object({
      chiefComplaint: z.string().trim().max(500).optional(),
      duration: z.string().trim().max(200).optional(),
      medicalHistory: z.string().trim().max(1000).optional(),
      medications: z.string().trim().max(1000).optional(),
      allergies: z.string().trim().max(500).optional(),
      ageGroup: z.string().trim().max(64).optional(),
      otherSymptoms: z.string().trim().max(1000).optional(),
    })
    .optional(),
});

const resendLinkInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});
const appointmentStatusInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});
const cancelInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  reason: z.string().trim().min(1).max(256).optional(),
});

const resendInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  email: z
    .string()
    .trim()
    .email()
    .transform(value => value.toLowerCase()),
});

const issueLinksInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

const validateTokenOnlyInputSchema = z.object({
  token: z.string().trim().min(16).max(2048),
});

const revokeTokenInputSchema = z
  .object({
    appointmentId: z.number().int().positive().optional(),
    role: z.enum(["patient", "doctor"]).optional(),
    token: z.string().trim().min(16).max(2048).optional(),
    revokeReason: z.string().trim().min(1).max(256).optional(),
  })
  .refine(value => Boolean(value.appointmentId || value.token), {
    message: "appointmentId or token is required",
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

const appointmentIntakeSchema = z.object({
  chiefComplaint: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  medicalHistory: z.string().optional().default(""),
  medications: z.string().optional().default(""),
  allergies: z.string().optional().default(""),
  ageGroup: z.string().optional().default(""),
  otherSymptoms: z.string().optional().default(""),
});

const appointmentAccessOutputSchema = appointmentPublicSchema.extend({
  ...appointmentParticipantSchema.shape,
  triageSummary: z.string().nullable(),
  intake: appointmentIntakeSchema.nullable(),
});

const createOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  checkoutUrl: z.string().url(),
  checkoutSessionUrl: z.string().url(),
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
const appointmentStatusOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  stripeSessionId: z.string().nullable(),
  paidAt: z.date().nullable(),
});

const resendDoctorOutputSchema = z.object({
  ok: z.literal(true),
  devDoctorLink: z.string().url().optional(),
});

const issueLinksOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  patientLink: z.string().url(),
  doctorLink: z.string().url(),
  expiresAt: z.date(),
});

const accessContextOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  role: z.enum(["patient", "doctor"]),
  tokenId: z.number().int().positive(),
  tokenHash: z.string().length(64),
  expiresAt: z.date(),
  displayInfo: z.object({
    patientEmail: z.string().nullable().optional(),
    doctorId: z.number().int().nullable().optional(),
  }),
});

const revokeTokenOutputSchema = z.object({
  ok: z.literal(true),
  revokedCount: z.number().int().nonnegative(),
});

const listMineInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});

const listMineOutputSchema = z.array(appointmentPublicSchema);

const myAppointmentItemSchema = z.object({
  id: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  scheduledAt: z.date().nullable(),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  createdAt: z.date(),
});

const listMyAppointmentsOutputSchema = z.object({
  upcoming: z.array(myAppointmentItemSchema),
  completed: z.array(myAppointmentItemSchema),
  past: z.array(myAppointmentItemSchema),
});

const CONSULTATION_DURATION_MINUTES = 60;
const TOKEN_RESEND_COOLDOWN_MS = 60_000;
const RESEND_ALLOWED_STATUS = new Set<string>(["paid", "active"]);
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

function getDevAppointmentAccessLink(appointmentId: number, token: string): string {
  return `http://localhost:3000/appointment-access?appointmentId=${appointmentId}&token=${encodeURIComponent(token)}`;
}

function getSessionEmailFromContext(ctx: TrpcContext): string | null {
  const rawCookieHeader = ctx.req.headers.cookie;
  const cookies = rawCookieHeader ? parseCookieHeader(rawCookieHeader) : {};

  const raw =
    (typeof ctx.req.headers["x-session-email"] === "string"
      ? ctx.req.headers["x-session-email"]
      : undefined) ??
    cookies.sessionEmail ??
    cookies["session-email"] ??
    cookies.email;

  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function toMyAppointmentItem(appointment: typeof appointments.$inferSelect) {
  return {
    id: appointment.id,
    doctorId: appointment.doctorId,
    appointmentType: appointment.appointmentType,
    scheduledAt: appointment.scheduledAt,
    status: appointment.status,
    paymentStatus: appointment.paymentStatus,
    createdAt: appointment.createdAt,
  };
}

function classifyMyAppointments(items: Array<ReturnType<typeof toMyAppointmentItem>>) {
  const upcoming: Array<ReturnType<typeof toMyAppointmentItem>> = [];
  const completed: Array<ReturnType<typeof toMyAppointmentItem>> = [];
  const past: Array<ReturnType<typeof toMyAppointmentItem>> = [];

  for (const item of items) {
    if (item.status === "pending_payment" || item.status === "paid" || item.status === "active") {
      upcoming.push(item);
      continue;
    }

    if (item.status === "ended") {
      completed.push(item);
      continue;
    }

    if (item.status === "expired" || item.status === "refunded" || item.status === "canceled") {
      past.push(item);
      continue;
    }
  }

  return { upcoming, completed, past };
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

export async function validateAppointmentToken(
  appointmentId: number,
  token: string,
  action: VisitAccessAction = "join_room",
  req?: Request
) {
  const validated = await validateAppointmentAccessToken({
    token,
    action,
    expectedAppointmentId: appointmentId,
    req,
  });

  const touchedAt = new Date();

  if (validated.role === "patient") {
    await appointmentsRepo.updateAppointmentById(validated.appointment.id, {
      lastAccessAt: touchedAt,
    });

    return {
      role: "patient" as const,
      appointment: {
        ...validated.appointment,
        lastAccessAt: touchedAt,
      },
    };
  }

  await appointmentsRepo.updateAppointmentById(validated.appointment.id, {
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

function assertPatientRole(role: "patient" | "doctor") {
  if (role !== "patient") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires a patient magic link",
    });
  }
}

async function assertResendCooldown(input: {
  appointmentId: number;
  role: appointmentsRepo.AppointmentTokenRole;
}) {
  const remainingSeconds =
    await appointmentsRepo.getAppointmentTokenCooldownRemainingSeconds({
      appointmentId: input.appointmentId,
      role: input.role,
      cooldownSeconds: Math.floor(TOKEN_RESEND_COOLDOWN_MS / 1000),
    });

  if (remainingSeconds <= 0) {
    return;
  }

  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: `Please wait ${remainingSeconds} seconds before resending again`,
  });
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

async function resolveCreateInputToStoredEmail(input: {
  email?: string;
  phone?: string;
}): Promise<string> {
  if (input.email) {
    return input.email;
  }
  const compactPhone = (input.phone ?? "").replace(/[^0-9+]/g, "");
  if (!compactPhone) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "email or phone is required",
    });
  }
  return `phone+${compactPhone.replace(/\+/g, "")}@medibridge.local`;
}

async function createAppointmentCheckoutFlow(input: {
  doctorId: number;
  triageSessionId: number;
  appointmentType: (typeof APPOINTMENT_TYPE_VALUES)[number];
  scheduledAt: Date;
  email: string;
  sessionId?: string;
  userId?: number | null;
  intake?: {
    chiefComplaint?: string;
    duration?: string;
    medicalHistory?: string;
    medications?: string;
    allergies?: string;
    ageGroup?: string;
    otherSymptoms?: string;
  };
  req: TrpcContext["req"];
}) {
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
    userId: input.userId,
    notes: formatIntakeToNotes(input.intake),
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
    operatorId: input.userId ?? null,
    reason: "appointment_draft_created",
  });

  const publicUrlBase = getPublicBaseUrl(input.req);
  const checkout = createStripeCheckoutSession({
    appointmentId,
    amount: pricing.amount,
    currency: pricing.currency,
    successUrl: `${publicUrlBase}/payment/success`,
    cancelUrl: `${publicUrlBase}/payment/cancel`,
  });

  const transitioned = await appointmentsRepo.markAppointmentPendingPayment({
    appointmentId,
    stripeSessionId: checkout.id,
  });
  if (transitioned && "ok" in transitioned && !transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  return {
    appointmentId,
    checkoutUrl: checkout.url,
    checkoutSessionUrl: checkout.url,
    status: "pending_payment" as const,
    paymentStatus: "pending" as const,
    stripeSessionId:
      process.env.NODE_ENV === "development" ? checkout.id : undefined,
  };
}

function formatIntakeToNotes(input?: {
  chiefComplaint?: string;
  duration?: string;
  medicalHistory?: string;
  medications?: string;
  allergies?: string;
  ageGroup?: string;
  otherSymptoms?: string;
}) {
  if (!input) {
    return null;
  }

  const normalized = {
    chiefComplaint: input.chiefComplaint?.trim() || "",
    duration: input.duration?.trim() || "",
    medicalHistory: input.medicalHistory?.trim() || "",
    medications: input.medications?.trim() || "",
    allergies: input.allergies?.trim() || "",
    ageGroup: input.ageGroup?.trim() || "",
    otherSymptoms: input.otherSymptoms?.trim() || "",
  };

  const hasAnyField = Object.values(normalized).some(Boolean);
  if (!hasAnyField) {
    return null;
  }

  return JSON.stringify({
    intakeVersion: 1,
    ...normalized,
  });
}

function parseIntakeFromNotes(
  notes: string | null | undefined
): z.infer<typeof appointmentIntakeSchema> | null {
  const normalized = notes?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    const result = appointmentIntakeSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }

    const hasAnyField = Object.values(result.data).some(
      value => typeof value === "string" && value.trim().length > 0
    );
    return hasAnyField ? result.data : null;
  } catch {
    return null;
  }
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

  listMyAppointments: publicProcedure
    .output(listMyAppointmentsOutputSchema)
    .query(async ({ ctx }) => {
      const userEmail = ctx.user?.email?.trim().toLowerCase();

      let rows: typeof appointments.$inferSelect[] = [];
      if (ctx.user) {
        rows = await appointmentsRepo.listAppointmentsByUserOrEmail({
          userId: ctx.user.id,
          email: userEmail,
        });
      } else {
        const sessionEmail = getSessionEmailFromContext(ctx);
        if (!sessionEmail) {
          return { upcoming: [], completed: [], past: [] };
        }
        rows = await appointmentsRepo.listAppointmentsByEmail(sessionEmail);
      }

      const items = rows.map(toMyAppointmentItem);
      return classifyMyAppointments(items);
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

      return createAppointmentCheckoutFlow({
        doctorId: input.doctorId,
        triageSessionId: input.triageSessionId,
        appointmentType: input.appointmentType,
        scheduledAt: input.scheduledAt,
        email: input.email,
        sessionId: input.sessionId,
        userId: ctx.user?.id,
        intake: input.intake,
        req: ctx.req,
      });
    }),

  createV2: publicProcedure
    .input(createV2InputSchema)
    .output(createOutputSchema)
    .mutation(async ({ input, ctx }) => {
      let triageSessionId = input.triageSessionId;
      if (!triageSessionId) {
        if (!ctx.user?.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "triageSessionId is required for anonymous booking",
          });
        }
        triageSessionId = await aiRepo.createAiChatSession(ctx.user.id);
      }

      const triageSession = await aiRepo.getAiChatSessionById(triageSessionId);
      if (!triageSession) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid triage session for appointment",
        });
      }
      if (ctx.user?.id && triageSession.userId && triageSession.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Invalid triage session for appointment",
        });
      }

      const email = await resolveCreateInputToStoredEmail({
        email: input.contact.email,
        phone: input.contact.phone,
      });
      const sessionEmail = ctx.user?.email?.trim().toLowerCase();
      if (input.contact.email && sessionEmail && sessionEmail !== input.contact.email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "请先验证您的邮箱以确认身份",
        });
      }

      const appointmentType = input.appointmentType ?? "online_chat";
      const scheduledAt =
        input.scheduledAt ?? new Date(Date.now() + 10 * 60 * 1000);

      return createAppointmentCheckoutFlow({
        doctorId: input.doctorId,
        triageSessionId,
        appointmentType,
        scheduledAt,
        email,
        sessionId: input.sessionId,
        userId: ctx.user?.id,
        intake: input.intake,
        req: ctx.req,
      });
    }),

  getStatus: publicProcedure
    .input(appointmentStatusInputSchema)
    .output(appointmentStatusOutputSchema)
    .query(async ({ input }) => {
      const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
      return {
        appointmentId: appointment.id,
        status: appointment.status,
        paymentStatus: appointment.paymentStatus,
        stripeSessionId: appointment.stripeSessionId ?? null,
        paidAt: appointment.paidAt ?? null,
      };
    }),

  resendPaymentLink: publicProcedure
    .input(appointmentStatusInputSchema)
    .output(createOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
      const publicUrlBase = getPublicBaseUrl(ctx.req);
      const result = await reinitiateCheckoutForAppointment({
        appointment,
        baseUrl: publicUrlBase,
        operatorType: "patient",
        operatorId: ctx.user?.id ?? null,
      });

      return {
        appointmentId: result.appointmentId,
        checkoutUrl: result.checkoutSessionUrl,
        checkoutSessionUrl: result.checkoutSessionUrl,
        status: result.status,
        paymentStatus: result.paymentStatus,
        stripeSessionId: result.stripeSessionId,
      };
    }),

  cancel: publicProcedure
    .input(cancelInputSchema)
    .output(appointmentStatusOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await getAppointmentByIdOrThrow(input.appointmentId);

      const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
        appointmentId: appointment.id,
        allowedFrom: ["draft", "pending_payment", "paid"],
        toStatus: "canceled",
        toPaymentStatus: appointment.paymentStatus === "paid" ? "failed" : "canceled",
        operatorType: "patient",
        operatorId: ctx.user?.id ?? null,
        reason: input.reason ?? "appointment_canceled",
      });

      if (!transitioned.ok) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: APPOINTMENT_INVALID_TRANSITION_ERROR,
        });
      }

      await appointmentsRepo.revokeAppointmentTokens({
        appointmentId: appointment.id,
        reason: "appointment_canceled",
      });

      const updated = await getAppointmentByIdOrThrow(appointment.id);
      return {
        appointmentId: updated.id,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        stripeSessionId: updated.stripeSessionId ?? null,
        paidAt: updated.paidAt ?? null,
      };
    }),

  getByToken: publicProcedure
    .input(accessWithLangInputSchema)
    .output(appointmentAccessOutputSchema)
    .query(async ({ input, ctx }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "join_room",
        ctx.req
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
        intake: parseIntakeFromNotes(appointment.notes),
      };
    }),

  rescheduleByToken: publicProcedure
    .input(rescheduleInputSchema)
    .output(appointmentPublicSchema)
    .mutation(async ({ input, ctx }) => {
      const { appointment, role } = await validateAppointmentToken(
        input.appointmentId,
        input.token,
        "join_room",
        ctx.req
      );
      assertPatientRole(role);
      const nextAccessTokenExpiresAt = computeDefaultTokenExpiry(
        input.newScheduledAt
      );

      await appointmentsRepo.updateAppointmentById(appointment.id, {
        scheduledAt: input.newScheduledAt,
        status:
          appointment.status === "ended" || appointment.status === "refunded"
            ? appointment.status
            : "paid",
        updatedAt: new Date(),
      });
      await appointmentsRepo.updateActiveAppointmentTokenExpiry({
        appointmentId: appointment.id,
        expiresAt: nextAccessTokenExpiresAt,
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
        "join_room",
        ctx.req
      );

      return {
        appointmentId: appointment.id,
        joinUrl: buildAppointmentAccessLink(input.token),
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

  issueAccessLinks: protectedProcedure
    .input(issueLinksInputSchema)
    .output(issueLinksOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await getAppointmentByIdOrThrow(input.appointmentId);
      const issued = await issueAppointmentAccessLinks({
        appointmentId: appointment.id,
        createdBy: `user:${ctx.user.id}`,
      });

      setCachedPatientAccessToken(
        appointment.id,
        issued.patient.token,
        issued.expiresAt
      );

      return {
        appointmentId: appointment.id,
        patientLink: issued.patientLink,
        doctorLink: issued.doctorLink,
        expiresAt: issued.expiresAt,
      };
    }),

  validateAccessToken: publicProcedure
    .input(validateTokenOnlyInputSchema)
    .output(accessContextOutputSchema)
    .query(async ({ input, ctx }) => {
      const result = await validateAppointmentAccessToken({
        token: input.token,
        req: ctx.req,
      });

      return {
        appointmentId: result.appointmentId,
        role: result.role,
        tokenId: result.tokenId,
        tokenHash: result.tokenHash,
        expiresAt: result.expiresAt,
        displayInfo: result.displayInfo,
      };
    }),

  revokeAccessToken: protectedProcedure
    .input(revokeTokenInputSchema)
    .output(revokeTokenOutputSchema)
    .mutation(async ({ input }) => {
      const revokedCount = await revokeAppointmentAccessToken({
        appointmentId: input.appointmentId,
        role: input.role,
        token: input.token,
        reason: input.revokeReason,
      });

      return { ok: true as const, revokedCount };
    }),

  resendLink: publicProcedure
    .input(resendLinkInputSchema)
    .output(resendOutputSchema)
    .mutation(async ({ input }) => {
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
      if (appointment.status === "canceled" || appointment.status === "ended") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot resend link for closed appointment",
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

      await assertResendCooldown({
        appointmentId: appointment.id,
        role: "patient",
      });

      const issued = await issueAppointmentAccessLinks({
        appointmentId: appointment.id,
        createdBy: "resend_link",
      });

      setCachedPatientAccessToken(
        appointment.id,
        issued.patient.token,
        issued.expiresAt
      );
      const link = issued.patientLink;
      await sendMagicLinkEmail(appointment.email, link);
      if (process.env.NODE_ENV === "development") {
        console.log("DEV ACCESS LINK:");
        console.log(getDevAppointmentAccessLink(appointment.id, issued.patient.token));
      }

      return {
        ok: true as const,
        devLink: process.env.NODE_ENV === "development" ? link : undefined,
      };
    }),

  resendDoctorLink: publicProcedure
    .input(resendInputSchema)
    .output(resendDoctorOutputSchema)
    .mutation(async ({ input }) => {
      if (process.env.NODE_ENV !== "development") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Resending doctor link is only enabled in development",
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

      await assertResendCooldown({
        appointmentId: appointment.id,
        role: "doctor",
      });

      const issued = await issueAppointmentAccessLinks({
        appointmentId: appointment.id,
        createdBy: "resend_doctor_link",
      });

      const doctorLink = issued.doctorLink;

      console.log(`[Appointments][DEV] Doctor link: ${doctorLink}`);

      return {
        ok: true as const,
        devDoctorLink: doctorLink,
      };
    }),
});
