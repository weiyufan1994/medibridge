import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getMetricsSnapshot } from "./metrics";
import * as appointmentsRepo from "../modules/appointments/repo";
import * as aiRepo from "../modules/ai/repo";
import * as doctorsRepo from "../modules/doctors/repo";
import { reinitiateCheckoutForAppointment } from "../paymentsRouter";
import { getPublicBaseUrl } from "../core/getPublicBaseUrl";
import { issueAppointmentAccessLinks } from "../modules/appointments/tokenService";
import { sendMagicLinkEmail } from "./mailer";
import { setCachedPatientAccessToken } from "../modules/appointments/tokenCache";
import * as visitRepo from "../modules/visit/repo";
import * as adminRepo from "../modules/admin/repo";
import { generateBilingualVisitSummary } from "../modules/admin/visitSummary";
import { renderSimpleTextPdf } from "../modules/admin/pdf";
import {
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  type AppointmentStatus,
} from "../modules/appointments/stateMachine";

const adminAppointmentsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  status: z.enum(APPOINTMENT_STATUS_VALUES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
  emailQuery: z.string().trim().max(320).optional(),
});

const adminTriageSessionsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  status: z.enum(["active", "completed"]).optional(),
  userId: z.number().int().positive().optional(),
});

const adminAppointmentDetailInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});
const adminAppointmentActionInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});
const adminAppointmentStatusUpdateSchema = z.object({
  appointmentId: z.number().int().positive(),
  toStatus: z.enum(APPOINTMENT_STATUS_VALUES),
  toPaymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  reason: z.string().trim().min(3).max(200),
});
const adminSummaryInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  forceRegenerate: z.boolean().optional().default(false),
});
const adminSummaryPdfInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  lang: z.enum(["zh", "en"]).optional().default("zh"),
});
const retentionPolicyTierSchema = z.enum(["free", "paid"]);
const retentionPolicyUpsertSchema = z.object({
  tier: retentionPolicyTierSchema,
  retentionDays: z.number().int().min(1).max(3650),
  enabled: z.boolean().default(true),
});
const retentionCleanupRunSchema = z.object({
  dryRun: z.boolean().optional().default(true),
});
const retentionCleanupAuditListSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(20),
});

const adminAppointmentIntakeSchema = z.object({
  chiefComplaint: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  medicalHistory: z.string().optional().default(""),
  medications: z.string().optional().default(""),
  allergies: z.string().optional().default(""),
  ageGroup: z.string().optional().default(""),
  otherSymptoms: z.string().optional().default(""),
});

function parseIntakeFromNotes(notes: string | null | undefined) {
  const normalized = notes?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    const result = adminAppointmentIntakeSchema.safeParse(parsed);
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

const ADMIN_ALLOWED_TRANSITION_FROM: AppointmentStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "active",
  "ended",
  "expired",
  "refunded",
  "canceled",
];

const deriveSummaryText = (input: {
  appointmentId: number;
  summaryZh: string;
  summaryEn: string;
  generatedAt: Date | string | null;
  source: string;
  lang: "zh" | "en";
}) => {
  const body = input.lang === "zh" ? input.summaryZh : input.summaryEn;
  const generatedAt =
    input.generatedAt instanceof Date
      ? input.generatedAt.toISOString()
      : (input.generatedAt ?? "");
  return [
    input.lang === "zh" ? "MediBridge 会后总结" : "MediBridge Visit Summary",
    `${input.lang === "zh" ? "问诊单" : "Appointment"} #${input.appointmentId}`,
    `${input.lang === "zh" ? "生成时间" : "Generated at"}: ${generatedAt || "-"}`,
    `${input.lang === "zh" ? "来源" : "Source"}: ${input.source || "unknown"}`,
    "",
    body.trim(),
  ].join("\n");
};

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  metrics: adminProcedure.query(() => {
    return {
      generatedAt: new Date().toISOString(),
      counters: getMetricsSnapshot(),
    } as const;
  }),

  adminAppointments: adminProcedure
    .input(adminAppointmentsInputSchema)
    .query(async ({ input }) => {
      return appointmentsRepo.listAppointmentsForAdmin({
        limit: input.limit,
        status: input.status,
        paymentStatus: input.paymentStatus,
        emailQuery: input.emailQuery,
      });
    }),

  adminTriageSessions: adminProcedure
    .input(adminTriageSessionsInputSchema)
    .query(async ({ input }) => {
      return aiRepo.listAiChatSessionsForAdmin({
        limit: input.limit,
        status: input.status,
        userId: input.userId,
      });
    }),

  adminAppointmentDetail: adminProcedure
    .input(adminAppointmentDetailInputSchema)
    .query(async ({ input }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const triageSession = await aiRepo.getAiChatSessionById(appointment.triageSessionId);
      const activeTokens = await appointmentsRepo.listActiveAppointmentTokens({
        appointmentId: appointment.id,
      });
      const statusEvents = await appointmentsRepo.listStatusEventsByAppointment({
        appointmentId: appointment.id,
        limit: 100,
      });
      const webhookEvents = await appointmentsRepo.listStripeWebhookEventsForAppointment({
        appointmentId: appointment.id,
        stripeSessionId: appointment.stripeSessionId,
        limit: 100,
      });
      const doctor = await doctorsRepo.getDoctorById(appointment.doctorId);
      const recentMessagesDesc = await visitRepo.getRecentMessages(appointment.id, 30);
      const recentMessagesAsc = [...recentMessagesDesc].reverse();

      return {
        appointment: {
          id: appointment.id,
          userId: appointment.userId,
          email: appointment.email,
          doctorId: appointment.doctorId,
          triageSessionId: appointment.triageSessionId,
          appointmentType: appointment.appointmentType,
          status: appointment.status,
          paymentStatus: appointment.paymentStatus,
          amount: appointment.amount,
          currency: appointment.currency,
          stripeSessionId: appointment.stripeSessionId,
          scheduledAt: appointment.scheduledAt,
          paidAt: appointment.paidAt,
          createdAt: appointment.createdAt,
          updatedAt: appointment.updatedAt,
        },
        doctor: doctor
          ? {
              id: doctor.doctor.id,
              name: doctor.doctor.name,
              nameEn: doctor.doctor.nameEn,
              hospitalName: doctor.hospital.name,
              departmentName: doctor.department.name,
            }
          : null,
        triageSession: triageSession
          ? {
              id: triageSession.id,
              status: triageSession.status,
              summary: triageSession.summary,
              summaryGeneratedAt: triageSession.summaryGeneratedAt,
            }
          : null,
        intake: parseIntakeFromNotes(appointment.notes),
        activeTokens: activeTokens.map(token => ({
          id: token.id,
          role: token.role,
          expiresAt: token.expiresAt,
          useCount: token.useCount,
          maxUses: token.maxUses,
          lastUsedAt: token.lastUsedAt,
          ipFirstSeen: token.ipFirstSeen,
        })),
        statusEvents: statusEvents.map(event => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          operatorType: event.operatorType,
          operatorId: event.operatorId,
          reason: event.reason,
          payloadJson: event.payloadJson,
          createdAt: event.createdAt,
        })),
        webhookEvents: webhookEvents.map(event => ({
          eventId: event.eventId,
          type: event.type,
          stripeSessionId: event.stripeSessionId,
          appointmentId: event.appointmentId,
          payloadHash: event.payloadHash,
          createdAt: event.createdAt,
        })),
        recentMessages: recentMessagesAsc.map(message => ({
          id: message.id,
          senderType: message.senderType,
          content: message.content,
          originalContent: message.originalContent,
          translatedContent: message.translatedContent,
          sourceLanguage: message.sourceLanguage,
          targetLanguage: message.targetLanguage,
          createdAt: message.createdAt,
        })),
      };
    }),

  adminReinitiatePayment: adminProcedure
    .input(adminAppointmentActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const result = await reinitiateCheckoutForAppointment({
        appointment,
        baseUrl: getPublicBaseUrl(ctx.req),
        operatorType: "admin",
        operatorId: ctx.user.id,
      });

      await appointmentsRepo.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: result.status,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: "admin_reinitiate_payment",
        payloadJson: {
          oldStripeSessionId: appointment.stripeSessionId,
          newStripeSessionId: result.stripeSessionId ?? null,
        },
      });

      return {
        appointmentId: result.appointmentId,
        checkoutUrl: result.checkoutSessionUrl,
      } as const;
    }),

  adminResendAccessLink: adminProcedure
    .input(adminAppointmentActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      if (appointment.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot resend visit link before payment is completed",
        });
      }

      const issued = await issueAppointmentAccessLinks({
        appointmentId: appointment.id,
        createdBy: `admin:${ctx.user.id}:resend_access_link`,
      });

      setCachedPatientAccessToken(
        appointment.id,
        issued.patient.token,
        issued.expiresAt
      );
      await sendMagicLinkEmail(appointment.email, issued.patientLink);

      await appointmentsRepo.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: appointment.status,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: "admin_resend_access_link",
      });

      return {
        ok: true as const,
      };
    }),

  adminIssueAccessLinks: adminProcedure
    .input(adminAppointmentActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      if (appointment.paymentStatus !== "paid") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Issue link is only available after payment is settled",
        });
      }

      const issued = await issueAppointmentAccessLinks({
        appointmentId: appointment.id,
        createdBy: `admin:${ctx.user.id}:issue_access_links`,
      });

      setCachedPatientAccessToken(
        appointment.id,
        issued.patient.token,
        issued.expiresAt
      );

      await appointmentsRepo.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: appointment.status,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: "admin_issue_access_links",
      });

      return {
        appointmentId: appointment.id,
        patientLink: issued.patientLink,
        doctorLink: issued.doctorLink,
        expiresAt: issued.expiresAt,
      } as const;
    }),

  adminUpdateAppointmentStatus: adminProcedure
    .input(adminAppointmentStatusUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
        appointmentId: appointment.id,
        allowedFrom: ADMIN_ALLOWED_TRANSITION_FROM,
        toStatus: input.toStatus,
        toPaymentStatus: input.toPaymentStatus,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: `admin_status_update:${input.reason}`,
        payloadJson: {
          manual: true,
          reason: input.reason,
        },
      });

      if (!transitioned.ok) {
        throw new TRPCError({
          code: transitioned.reason === "not_found" ? "NOT_FOUND" : "PRECONDITION_FAILED",
          message: `Status transition failed: ${transitioned.reason}`,
        });
      }

      return {
        ok: true as const,
      };
    }),

  adminGetVisitSummary: adminProcedure
    .input(adminAppointmentDetailInputSchema)
    .query(async ({ input }) => {
      const summary = await adminRepo.getVisitSummaryByAppointmentId(input.appointmentId);
      if (!summary) {
        return null;
      }
      return {
        id: summary.id,
        appointmentId: summary.appointmentId,
        summaryZh: summary.summaryZh,
        summaryEn: summary.summaryEn,
        source: summary.source,
        generatedBy: summary.generatedBy,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
      } as const;
    }),

  adminGenerateVisitSummary: adminProcedure
    .input(adminSummaryInputSchema)
    .mutation(async ({ input, ctx }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const existing = await adminRepo.getVisitSummaryByAppointmentId(appointment.id);
      if (existing && !input.forceRegenerate) {
        return {
          appointmentId: appointment.id,
          summaryZh: existing.summaryZh,
          summaryEn: existing.summaryEn,
          source: existing.source,
          generatedAt: existing.updatedAt ?? existing.createdAt,
          cached: true,
        } as const;
      }

      const triageSession = await aiRepo.getAiChatSessionById(appointment.triageSessionId);
      const recentMessagesDesc = await visitRepo.getRecentMessages(appointment.id, 120);
      const recentMessagesAsc = [...recentMessagesDesc].reverse();

      const generated = await generateBilingualVisitSummary({
        appointment,
        triageSummary: triageSession?.summary ?? null,
        messages: recentMessagesAsc.map(message => ({
          senderType: message.senderType,
          content: message.content,
          translatedContent: message.translatedContent,
          createdAt: message.createdAt,
        })),
      });

      const persisted = await adminRepo.upsertVisitSummary({
        appointmentId: appointment.id,
        summaryZh: generated.summaryZh,
        summaryEn: generated.summaryEn,
        source: generated.source,
        generatedBy: ctx.user.id,
      });

      return {
        appointmentId: appointment.id,
        summaryZh: persisted?.summaryZh ?? generated.summaryZh,
        summaryEn: persisted?.summaryEn ?? generated.summaryEn,
        source: persisted?.source ?? generated.source,
        generatedAt: persisted?.updatedAt ?? persisted?.createdAt ?? new Date(),
        cached: false,
      } as const;
    }),

  adminExportVisitSummaryPdf: adminProcedure
    .input(adminSummaryPdfInputSchema)
    .mutation(async ({ input, ctx }) => {
      let summary = await adminRepo.getVisitSummaryByAppointmentId(input.appointmentId);

      if (!summary) {
        const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
        if (!appointment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Appointment not found",
          });
        }

        const triageSession = await aiRepo.getAiChatSessionById(appointment.triageSessionId);
        const recentMessagesDesc = await visitRepo.getRecentMessages(appointment.id, 120);
        const recentMessagesAsc = [...recentMessagesDesc].reverse();

        const generated = await generateBilingualVisitSummary({
          appointment,
          triageSummary: triageSession?.summary ?? null,
          messages: recentMessagesAsc.map(message => ({
            senderType: message.senderType,
            content: message.content,
            translatedContent: message.translatedContent,
            createdAt: message.createdAt,
          })),
        });

        summary = await adminRepo.upsertVisitSummary({
          appointmentId: appointment.id,
          summaryZh: generated.summaryZh,
          summaryEn: generated.summaryEn,
          source: generated.source,
          generatedBy: ctx.user.id,
        });
      }

      if (!summary) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load summary",
        });
      }

      const text = deriveSummaryText({
        appointmentId: summary.appointmentId,
        summaryZh: summary.summaryZh,
        summaryEn: summary.summaryEn,
        generatedAt: summary.updatedAt ?? summary.createdAt,
        source: summary.source,
        lang: input.lang,
      });
      const pdf = renderSimpleTextPdf(text);

      return {
        appointmentId: summary.appointmentId,
        filename: `visit-summary-${summary.appointmentId}-${input.lang}.pdf`,
        mimeType: "application/pdf",
        base64: pdf.toString("base64"),
        generatedAt: new Date().toISOString(),
      } as const;
    }),

  adminRetentionPolicies: adminProcedure.query(async () => {
    const rows = await adminRepo.ensureDefaultRetentionPolicies();
    return rows.map(row => ({
      id: row.id,
      tier: row.tier,
      retentionDays: row.retentionDays,
      enabled: row.enabled === 1,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }),

  adminUpsertRetentionPolicy: adminProcedure
    .input(retentionPolicyUpsertSchema)
    .mutation(async ({ input, ctx }) => {
      const updated = await adminRepo.upsertRetentionPolicy({
        tier: input.tier,
        retentionDays: input.retentionDays,
        enabled: input.enabled,
        updatedBy: ctx.user.id,
      });

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to persist retention policy",
        });
      }

      return {
        id: updated.id,
        tier: updated.tier,
        retentionDays: updated.retentionDays,
        enabled: updated.enabled === 1,
        updatedBy: updated.updatedBy,
        updatedAt: updated.updatedAt,
      } as const;
    }),

  adminRunRetentionCleanup: adminProcedure
    .input(retentionCleanupRunSchema)
    .mutation(async ({ input, ctx }) => {
      return adminRepo.runRetentionCleanup({
        dryRun: input.dryRun,
        createdBy: ctx.user.id,
      });
    }),

  adminRetentionCleanupAudits: adminProcedure
    .input(retentionCleanupAuditListSchema)
    .query(async ({ input }) => {
      const rows = await adminRepo.listRetentionCleanupAudits(input.limit);
      return rows.map(row => ({
        id: row.id,
        dryRun: row.dryRun === 1,
        freeRetentionDays: row.freeRetentionDays,
        paidRetentionDays: row.paidRetentionDays,
        scannedMessages: row.scannedMessages,
        deletedMessages: row.deletedMessages,
        detailsJson: row.detailsJson,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      }));
    }),
});
