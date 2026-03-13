import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { notifyOwner } from "./notification";
import {
  adminOrOpsProcedure,
  adminProcedure,
  publicProcedure,
  router,
} from "./trpc";
import { getMetricsSnapshot } from "./metrics";
import * as appointmentsRepo from "../modules/appointments/repo";
import * as aiRepo from "../modules/ai/repo";
import * as doctorsRepo from "../modules/doctors/repo";
import { reinitiateCheckoutForAppointment } from "../modules/payments/reinitiateCheckout";
import { getPublicBaseUrl } from "./getPublicBaseUrl";
import { issueAppointmentAccessLinks } from "../modules/appointments/tokenService";
import { sendMagicLinkEmail } from "./mailer";
import { setCachedPatientAccessToken } from "../modules/appointments/tokenCache";
import * as visitRepo from "../modules/visit/repo";
import * as adminRepo from "../modules/admin/repo";
import { generateBilingualVisitSummary } from "../modules/admin/visitSummary";
import { renderSimpleTextPdf } from "../modules/admin/pdf";
import { storagePut } from "../storage";
import { settleStripePaymentBySessionId } from "../modules/payments/settlement";
import {
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
  type AppointmentStatus,
} from "../modules/appointments/stateMachine";

const resolveActorRole = (role?: string) => {
  if (role === "ops") {
    return "ops";
  }
  return "admin";
};

const assertAdminAction = (role?: string) => {
  if (role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have required permission (10002)",
    });
  }
};

const adminAppointmentsInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(50),
  status: z.enum(APPOINTMENT_STATUS_VALUES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
  emailQuery: z.string().trim().max(320).optional(),
  doctorId: z.number().int().positive().optional(),
  amountMin: z.number().int().min(0).optional(),
  amountMax: z.number().int().min(0).optional(),
  createdAtFrom: z.coerce.date().optional(),
  createdAtTo: z.coerce.date().optional(),
  scheduledAtFrom: z.coerce.date().optional(),
  scheduledAtTo: z.coerce.date().optional(),
  hasRisk: z.boolean().optional(),
  sortBy: z
    .enum(["createdAt", "scheduledAt", "amount", "status", "paymentStatus", "id"])
    .optional()
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
});

const adminBatchAppointmentActionSchema = z.object({
  action: z.enum(["resend_access_link", "reinitiate_payment", "update_status"]),
  appointmentIds: z.array(z.number().int().positive()).min(1).max(200),
  idempotencyKey: z.string().trim().max(128).optional(),
  toStatus: z.enum(APPOINTMENT_STATUS_VALUES).optional(),
  toPaymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
  reason: z.string().trim().min(3).max(200).optional().default("admin_batch_action"),
}).superRefine((input, ctx) => {
  if (input.action === "update_status") {
    if (!input.toStatus || !input.toPaymentStatus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["toStatus"],
        message: "update_status requires toStatus and toPaymentStatus",
      });
    }
  }
});

const adminWebhookReplaySchema = z
  .object({
    eventId: z.string().trim().max(255).optional(),
    appointmentId: z.number().int().positive().optional(),
    replayKey: z.string().trim().max(128).optional(),
  })
  .superRefine((input, ctx) => {
    if (!input.eventId && !input.appointmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["eventId"],
        message: "Either eventId or appointmentId is required",
      });
    }
  });

const adminExportScopeSchema = z.enum([
  "appointments",
  "risk_summary",
  "retention_audits",
  "webhook_timeline",
  "operation_audit",
]);

const adminExportSchema = z.object({
  scope: adminExportScopeSchema,
  format: z.enum(["json", "csv"]).optional().default("csv"),
  pageSize: z.number().int().min(1).max(50000).optional().default(2000),
  status: z.enum(APPOINTMENT_STATUS_VALUES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
  emailQuery: z.string().trim().max(320).optional(),
  doctorId: z.number().int().positive().optional(),
  amountMin: z.number().int().min(0).optional(),
  amountMax: z.number().int().min(0).optional(),
  createdAtFrom: z.coerce.date().optional(),
  createdAtTo: z.coerce.date().optional(),
  scheduledAtFrom: z.coerce.date().optional(),
  scheduledAtTo: z.coerce.date().optional(),
  hasRisk: z.boolean().optional(),
  sortBy: z
    .enum(["createdAt", "scheduledAt", "amount", "status", "paymentStatus", "id"])
    .optional()
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
  webhookAppointmentId: z.number().int().positive().optional(),
  auditPage: z.number().int().min(1).optional().default(1),
  auditPageSize: z.number().int().min(1).max(200).optional().default(20),
  auditOperatorId: z.number().int().positive().optional(),
  auditActionType: z.string().trim().max(80).optional(),
  auditFrom: z.coerce.date().optional(),
  auditTo: z.coerce.date().optional(),
});

const adminOperationAuditInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(20),
  operatorId: z.number().int().positive().optional(),
  actionType: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const adminUsersInputSchema = z.object({
  emailQuery: z.string().trim().max(320).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

const adminUserRoleSchema = z.enum(["free", "pro", "admin", "ops"]);

const adminUpdateUserRoleSchema = z.object({
  userId: z.number().int().positive(),
  role: adminUserRoleSchema,
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
const adminAppointmentScheduleUpdateSchema = z.object({
  appointmentId: z.number().int().positive(),
  scheduledAt: z.coerce.date(),
  reason: z.string().trim().min(3).max(200).optional().default("ops_manual_schedule"),
});
const adminNotifyDoctorFollowupInputSchema = z.object({
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
const adminHospitalImageUploadSchema = z.object({
  hospitalId: z.number().int().positive(),
  imageBase64: z.string().trim().min(1),
  fileName: z.string().trim().max(255).optional(),
  contentType: z.string().trim().max(80).optional(),
});
const adminHospitalImageClearSchema = z.object({
  hospitalId: z.number().int().positive(),
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

const HOSPITAL_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const HOSPITAL_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const HOSPITAL_IMAGE_DEFAULT_MIME = "image/jpeg";
const HOSPITAL_IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const DATA_URL_PREFIX_RE = /^data:([^;]+);base64,/i;

const stripDataUrl = (value: string) => {
  const match = DATA_URL_PREFIX_RE.exec(value);
  if (!match) {
    return {
      value: value.trim().replace(/\s+/g, ""),
      contentType: HOSPITAL_IMAGE_DEFAULT_MIME,
    };
  }
  return {
    value: value.slice(match[0].length).trim().replace(/\s+/g, ""),
    contentType: match[1] || HOSPITAL_IMAGE_DEFAULT_MIME,
  };
};

const resolveHospitalImageContentType = (inputContentType: string | undefined) => {
  const normalized = (inputContentType ?? "").trim().toLowerCase();
  if (HOSPITAL_IMAGE_MIME_TYPES.has(normalized)) {
    return normalized;
  }
  return HOSPITAL_IMAGE_DEFAULT_MIME;
};

const resolveHospitalImageExtension = (
  fileName: string | undefined,
  contentType: string
) => {
  const fileNameExt = fileName?.trim().toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (fileNameExt) {
    return fileNameExt;
  }
  return HOSPITAL_IMAGE_EXT_BY_MIME[contentType] ?? "jpg";
};

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
  "completed",
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

const toCsvCell = (value: unknown) => {
  const raw = value === undefined || value === null ? "" : String(value);
  if (raw.includes(",") || raw.includes("\n") || raw.includes("\"")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

const formatCsvRows = (rows: Array<Record<string, unknown>>) => {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(toCsvCell).join(",");
  const lines = rows.map(row =>
    headers.map(key => toCsvCell(row[key] instanceof Date ? row[key].toISOString() : row[key])).join(",")
  );
  return [headerLine, ...lines].join("\n");
};

const normalizeAmountFilter = (value: number | undefined, side: "min" | "max") => {
  if (value === undefined || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return side === "min" ? value : value;
};

const toDate = (input: Date | string | undefined | null) => {
  if (!input) {
    return undefined;
  }
  const parsed = input instanceof Date ? input : new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const normalizeBatchActionInput = (input: {
  action: "resend_access_link" | "reinitiate_payment" | "update_status";
  idempotencyKey?: string;
  toStatus?: AppointmentStatus;
  toPaymentStatus?: "unpaid" | "pending" | "paid" | "failed" | "expired" | "refunded" | "canceled";
}) => ({
  action: input.action,
  idempotencyKey: (input.idempotencyKey ?? "").trim().slice(0, 80),
  toStatus: input.toStatus,
  toPaymentStatus: input.toPaymentStatus,
});

const buildWebhookReplayEventRow = (input: {
  event: {
    eventId: string;
    type: string;
    stripeSessionId: string | null;
    appointmentId: number | null;
  };
  action: string;
}) => ({
  eventId: input.event.eventId,
  eventType: input.event.type,
  action: input.action,
  stripeSessionId: input.event.stripeSessionId,
  appointmentId: input.event.appointmentId,
});

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

  metrics: adminOrOpsProcedure.query(() => {
    return {
      generatedAt: new Date().toISOString(),
      counters: getMetricsSnapshot(),
    } as const;
  }),

  adminAppointments: adminOrOpsProcedure
    .input(adminAppointmentsInputSchema)
    .query(async ({ input }) => {
      return appointmentsRepo.listAppointmentsForAdmin({
        page: input.page,
        pageSize: input.pageSize,
        status: input.status,
        paymentStatus: input.paymentStatus,
        emailQuery: input.emailQuery,
        doctorId: input.doctorId,
        amountMin: normalizeAmountFilter(input.amountMin, "min"),
        amountMax: normalizeAmountFilter(input.amountMax, "max"),
        createdAtFrom: toDate(input.createdAtFrom),
        createdAtTo: toDate(input.createdAtTo),
        scheduledAtFrom: toDate(input.scheduledAtFrom),
        scheduledAtTo: toDate(input.scheduledAtTo),
        hasRisk: input.hasRisk,
        sortBy: input.sortBy,
        sortDirection: input.sortDirection,
      });
    }),

  adminUsers: adminProcedure
    .input(adminUsersInputSchema)
    .query(async ({ input }) => {
      return adminRepo.listAdminUsers({
        emailQuery: input.emailQuery,
        limit: input.limit,
      });
    }),

  adminUpdateUserRole: adminProcedure
    .input(adminUpdateUserRoleSchema)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.id === input.userId && input.role !== "admin") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own admin role",
        });
      }

      const updated = await adminRepo.updateAdminUserRole({
        userId: input.userId,
        role: input.role,
      });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      return updated;
    }),

  adminBatchAppointmentsAction: adminOrOpsProcedure
    .input(adminBatchAppointmentActionSchema)
    .mutation(async ({ input, ctx }) => {
      const normalized = normalizeBatchActionInput(input);
      const actorRole = resolveActorRole(ctx.user?.role);

      if (normalized.action !== "resend_access_link") {
        assertAdminAction(ctx.user?.role);
      }

      const idempotencyKey =
        normalized.idempotencyKey?.trim().length
          ? normalized.idempotencyKey
          : randomUUID();
      const visited = new Set<number>();
      const results: Array<{
        appointmentId: number;
        status: "success" | "skipped" | "failed";
        reason?: string;
      }> = [];

      for (const appointmentId of input.appointmentIds) {
        if (visited.has(appointmentId)) {
          continue;
        }
        visited.add(appointmentId);

        const marker = `admin_batch:${normalized.action}:${idempotencyKey}:${appointmentId}`;
        const alreadyProcessed = await appointmentsRepo.hasAppointmentStatusReason({
          appointmentId,
          reason: marker,
        });
        if (alreadyProcessed) {
          results.push({
            appointmentId,
            status: "skipped",
            reason: "idempotency key replay",
          });
          continue;
        }

        try {
          const appointment = await appointmentsRepo.getAppointmentById(appointmentId);
          if (!appointment) {
            results.push({
              appointmentId,
              status: "failed",
              reason: "Appointment not found",
            });
            continue;
          }

          if (normalized.action === "reinitiate_payment") {
            const result = await reinitiateCheckoutForAppointment({
              appointment,
              baseUrl: getPublicBaseUrl(ctx.req),
              operatorType: "admin",
              operatorId: ctx.user.id,
            });
            await appointmentsRepo.insertStatusEvent({
              appointmentId,
              fromStatus: appointment.status,
              toStatus: result.status,
              operatorType: "admin",
              operatorId: ctx.user.id,
              reason: marker,
              payloadJson: {
                source: "admin_batch",
                action: "reinitiate_payment",
                idempotencyKey,
                actorRole,
              },
            });
            results.push({ appointmentId, status: "success" });
            continue;
          }

          if (normalized.action === "resend_access_link") {
            if (appointment.paymentStatus !== "paid") {
              results.push({
                appointmentId,
                status: "failed",
                reason: "Appointment is not paid",
              });
              continue;
            }

            const issued = await issueAppointmentAccessLinks({
              appointmentId: appointment.id,
              createdBy: `${actorRole}:${ctx.user.id}:batch_resend_access_link`,
            });
            setCachedPatientAccessToken(
              appointment.id,
              issued.patient.token,
              issued.expiresAt
            );
            await sendMagicLinkEmail(appointment.email, issued.patientLink);
            await appointmentsRepo.insertStatusEvent({
              appointmentId,
              fromStatus: appointment.status,
              toStatus: appointment.status,
              operatorType: "admin",
              operatorId: ctx.user.id,
              reason: marker,
              payloadJson: {
                action: "resend_access_link",
                patientLink: issued.patientLink,
                doctorLink: issued.doctorLink,
                idempotencyKey,
                actorRole,
              },
            });
            results.push({ appointmentId, status: "success" });
            continue;
          }

          const toStatus = normalized.toStatus;
          const toPaymentStatus = normalized.toPaymentStatus;
          if (!toStatus || !toPaymentStatus) {
            results.push({
              appointmentId,
              status: "failed",
              reason: "Missing status update payload",
            });
            continue;
          }

          const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
            appointmentId: appointment.id,
            allowedFrom: ADMIN_ALLOWED_TRANSITION_FROM,
            toStatus,
            toPaymentStatus,
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: input.reason,
            payloadJson: {
              source: "admin_batch",
              idempotencyKey,
              appointmentId,
            },
          });

          if (!transitioned.ok) {
            results.push({
              appointmentId,
              status: "failed",
              reason: `Transition failed: ${transitioned.reason}`,
            });
            continue;
          }

          await appointmentsRepo.insertStatusEvent({
            appointmentId,
            fromStatus: appointment.status,
            toStatus,
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: marker,
            payloadJson: {
              source: "admin_batch",
              sourceStatus: appointment.status,
              sourcePaymentStatus: appointment.paymentStatus,
              toStatus,
              toPaymentStatus,
              idempotencyKey,
              actorRole,
            },
          });
          results.push({ appointmentId, status: "success" });
        } catch (error) {
          results.push({
            appointmentId,
            status: "failed",
            reason: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      return {
        results,
        summary: {
          total: results.length,
          success: results.filter(item => item.status === "success").length,
          skipped: results.filter(item => item.status === "skipped").length,
          failed: results.filter(item => item.status === "failed").length,
        },
        idempotencyKey,
      } as const;
    }),

  adminWebhookReplay: adminOrOpsProcedure
    .input(adminWebhookReplaySchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
      const replayKey = input.replayKey?.trim().length
        ? input.replayKey.trim().slice(0, 80)
        : randomUUID();

      const event =
        input.eventId && input.eventId.trim().length > 0
          ? await appointmentsRepo.getStripeWebhookEventById(input.eventId.trim())
          : input.appointmentId
            ? (await appointmentsRepo.listStripeWebhookEventsForAppointment({
                appointmentId: input.appointmentId,
                limit: 1,
              }))[0] ?? null
            : null;

      if (!event) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Webhook event not found",
        });
      }

      const marker = `admin_webhook_replay:${replayKey}:${event.eventId}`;
      if (!event.appointmentId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Webhook event has no linked appointment",
        });
      }

      const alreadyDone = await appointmentsRepo.hasAppointmentStatusReason({
        appointmentId: event.appointmentId,
        reason: marker,
      });
      if (alreadyDone) {
        return {
          ok: false,
          skipped: true,
          action: "skipped-idempotent",
          eventId: event.eventId,
        } as const;
      }

      const result = buildWebhookReplayEventRow({
        event: {
          eventId: event.eventId,
          type: event.type,
          stripeSessionId: event.stripeSessionId,
          appointmentId: event.appointmentId,
        },
        action: event.type,
      });

      if (
        event.type === "checkout.session.completed" ||
        event.type === "payment_intent.payment_failed" ||
        event.type === "checkout.session.expired" ||
        event.type === "charge.refunded" ||
        event.type === "refund.updated"
      ) {
        if (!event.stripeSessionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Webhook event is missing stripe session id",
          });
        }

        if (event.type === "checkout.session.completed") {
          const appointment = await appointmentsRepo.getAppointmentById(
            event.appointmentId
          );
          if (!appointment) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Appointment not found for webhook replay",
            });
          }

          await settleStripePaymentBySessionId({
            stripeSessionId: event.stripeSessionId,
            source: "webhook",
            eventId: event.eventId,
          });
          await appointmentsRepo.insertStatusEvent({
            appointmentId: event.appointmentId,
            fromStatus: appointment.status,
            toStatus: "paid",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: marker,
            payloadJson: {
              sourceStatus: appointment.status,
              sourcePaymentStatus: appointment.paymentStatus,
              source: "webhook_replay",
              event: result,
              idempotencyKey: replayKey,
              actorRole,
            },
          });
          return { ok: true, skipped: false, action: result.action, eventId: event.eventId } as const;
        }

        if (event.type === "checkout.session.expired") {
          const expired = await appointmentsRepo.tryTransitionAppointmentByStripeSessionId({
            stripeSessionId: event.stripeSessionId,
            allowedFrom: ["pending_payment"],
            toStatus: "expired",
            toPaymentStatus: "expired",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: "admin_webhook_replay",
            payloadJson: {
              ...result,
              actorRole,
            },
          });
          if (!expired.ok) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Unable to replay expired webhook: ${expired.reason}`,
            });
          }
          await appointmentsRepo.insertStatusEvent({
            appointmentId: event.appointmentId,
            fromStatus: "pending_payment",
            toStatus: "expired",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: marker,
            payloadJson: {
              source: "webhook_replay",
              event: result,
              idempotencyKey: replayKey,
              actorRole,
            },
          });
          return { ok: true, skipped: false, action: result.action, eventId: event.eventId } as const;
        }

        if (event.type === "payment_intent.payment_failed") {
          const failed = await appointmentsRepo.tryTransitionAppointmentByStripeSessionId({
            stripeSessionId: event.stripeSessionId,
            allowedFrom: ["pending_payment"],
            toStatus: "canceled",
            toPaymentStatus: "failed",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: "admin_webhook_replay",
            payloadJson: {
              ...result,
              actorRole,
            },
          });
          if (!failed.ok) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: `Unable to replay failed payment webhook: ${failed.reason}`,
            });
          }
          await appointmentsRepo.insertStatusEvent({
            appointmentId: event.appointmentId,
            fromStatus: "pending_payment",
            toStatus: "canceled",
            operatorType: "admin",
            operatorId: ctx.user.id,
            reason: marker,
            payloadJson: {
              source: "webhook_replay",
              event: result,
              idempotencyKey: replayKey,
              actorRole,
            },
          });
          return { ok: true, skipped: false, action: result.action, eventId: event.eventId } as const;
        }

        const refund = await appointmentsRepo.tryTransitionAppointmentByStripeSessionId({
          stripeSessionId: event.stripeSessionId,
          allowedFrom: ["paid", "active", "ended", "completed"],
          toStatus: "refunded",
          toPaymentStatus: "refunded",
          operatorType: "admin",
          operatorId: ctx.user.id,
          reason: "admin_webhook_replay",
          payloadJson: {
            ...result,
            actorRole,
          },
        });
        if (!refund.ok) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Unable to replay refund webhook: ${refund.reason}`,
          });
        }
        await appointmentsRepo.insertStatusEvent({
          appointmentId: event.appointmentId,
          fromStatus: "paid",
          toStatus: "refunded",
          operatorType: "admin",
          operatorId: ctx.user.id,
          reason: marker,
          payloadJson: {
            source: "webhook_replay",
            event: result,
            idempotencyKey: replayKey,
            actorRole,
          },
        });
        return { ok: true, skipped: false, action: result.action, eventId: event.eventId } as const;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Unsupported webhook event for replay: ${event.type}`,
      });
    }),

  adminExport: adminOrOpsProcedure
    .input(adminExportSchema)
    .mutation(async ({ input }) => {
      const baseFilters = {
        page: 1,
        pageSize: input.pageSize,
        status: input.status,
        paymentStatus: input.paymentStatus,
        emailQuery: input.emailQuery,
        doctorId: input.doctorId,
        amountMin: normalizeAmountFilter(input.amountMin, "min"),
        amountMax: normalizeAmountFilter(input.amountMax, "max"),
        createdAtFrom: toDate(input.createdAtFrom),
        createdAtTo: toDate(input.createdAtTo),
        scheduledAtFrom: toDate(input.scheduledAtFrom),
        scheduledAtTo: toDate(input.scheduledAtTo),
        hasRisk: input.hasRisk,
        sortBy: input.sortBy,
        sortDirection: input.sortDirection,
      } as const;

      if (input.scope === "appointments") {
        const queryResult = await appointmentsRepo.listAppointmentsForAdmin(baseFilters);
        const rows = queryResult.items.map(item => ({
          id: item.id,
          email: item.email,
          status: item.status,
          paymentStatus: item.paymentStatus,
          amount: item.amount,
          currency: item.currency,
          doctorId: item.doctorId,
          createdAt: item.createdAt,
          scheduledAt: item.scheduledAt,
          riskCodes: item.riskCodes.join("|"),
          hasRisk: item.hasRisk,
        }));

        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-appointments-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(rows, null, 2),
          } as const;
        }

        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-appointments-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(rows),
        } as const;
      }

      if (input.scope === "risk_summary") {
        const queryResult = await appointmentsRepo.listAppointmentsForAdmin(baseFilters);
        const summary = {
          total: queryResult.total,
          page: queryResult.page,
          pageSize: queryResult.pageSize,
          totalPages: queryResult.totalPages,
          pendingPaymentTimeout: queryResult.riskSummary.pendingPaymentTimeout,
          webhookFailure: queryResult.riskSummary.webhookFailure,
          tokenExpiringSoon: queryResult.riskSummary.tokenExpiringSoon,
          tokenUsageExhausted: queryResult.riskSummary.tokenUsageExhausted,
        };
        const payload = [summary];
        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-risk-summary-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(payload, null, 2),
          } as const;
        }
        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-risk-summary-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(payload),
        } as const;
      }

      if (input.scope === "retention_audits") {
        const rows = await adminRepo.listRetentionCleanupAudits(input.auditPageSize);
        const details = (json: unknown) =>
          (json as {
            freeCandidates?: number;
            paidCandidates?: number;
            totalCandidates?: number;
          }) ?? {};
        const payload = rows.map(row => ({
          id: row.id,
          dryRun: row.dryRun === 1,
          freeRetentionDays: row.freeRetentionDays,
          paidRetentionDays: row.paidRetentionDays,
          freeCandidates: details(row.detailsJson).freeCandidates,
          paidCandidates: details(row.detailsJson).paidCandidates,
          totalCandidates: details(row.detailsJson).totalCandidates,
          scannedMessages: row.scannedMessages,
          deletedMessages: row.deletedMessages,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
        }));
        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-retention-audits-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(payload, null, 2),
          } as const;
        }
        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-retention-audits-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(payload),
        } as const;
      }

      if (input.scope === "webhook_timeline") {
        const timeline = input.webhookAppointmentId
          ? await appointmentsRepo.listStripeWebhookEventsForAppointment({
              appointmentId: input.webhookAppointmentId,
              limit: input.pageSize,
            })
          : [];
        const payload = timeline.map(event => ({
          eventId: event.eventId,
          type: event.type,
          stripeSessionId: event.stripeSessionId,
          appointmentId: event.appointmentId,
          payloadHash: event.payloadHash,
          createdAt: event.createdAt,
        }));
        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-webhook-timeline-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(payload, null, 2),
          } as const;
        }
        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-webhook-timeline-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(payload),
        } as const;
      }

      if (input.scope === "operation_audit") {
        const result = await appointmentsRepo.listAppointmentStatusEventsForAdmin({
          page: input.auditPage,
          pageSize: input.auditPageSize,
          operatorId: input.auditOperatorId,
          actionType: input.auditActionType,
          from: toDate(input.auditFrom),
          to: toDate(input.auditTo),
        });
        const payload = result.items.map(item => ({
          id: item.id,
          appointmentId: item.appointmentId,
          fromStatus: item.fromStatus,
          toStatus: item.toStatus,
          operatorType: item.operatorType,
          operatorId: item.operatorId,
          reason: item.reason,
          createdAt: item.createdAt,
          payloadJson: item.payloadJson,
        }));
        if (input.format === "json") {
          return {
            scope: input.scope,
            format: input.format,
            filename: `admin-operation-audit-${new Date().toISOString().slice(0, 10)}.json`,
            mimeType: "application/json",
            content: JSON.stringify(payload, null, 2),
          } as const;
        }
        return {
          scope: input.scope,
          format: input.format,
          filename: `admin-operation-audit-${new Date().toISOString().slice(0, 10)}.csv`,
          mimeType: "text/csv",
          content: formatCsvRows(payload),
        } as const;
      }

      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Unsupported export scope",
      });
    }),

  adminOperationAudit: adminOrOpsProcedure
    .input(adminOperationAuditInputSchema)
    .query(async ({ input }) => {
      return appointmentsRepo.listAppointmentStatusEventsForAdmin({
        page: input.page,
        pageSize: input.pageSize,
        operatorId: input.operatorId,
        actionType: input.actionType,
        from: toDate(input.from),
        to: toDate(input.to),
      });
    }),

  adminHospitals: adminOrOpsProcedure.query(async () => {
    return await doctorsRepo.getAllHospitals();
  }),

  adminUploadHospitalImage: adminProcedure
    .input(adminHospitalImageUploadSchema)
    .mutation(async ({ input }) => {
      const hospital = await doctorsRepo.getHospitalById(input.hospitalId);
      if (!hospital) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hospital not found",
        });
      }

      const clean = stripDataUrl(input.imageBase64);
      const contentType = resolveHospitalImageContentType(input.contentType || clean.contentType);
      if (!HOSPITAL_IMAGE_MIME_TYPES.has(contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid image content type",
        });
      }
      const base64Pattern = /^[A-Za-z0-9+/=]+$/;
      if (!base64Pattern.test(clean.value)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid image payload",
        });
      }
      const imageBuffer = Buffer.from(clean.value, "base64");
      if (imageBuffer.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Empty image payload",
        });
      }
      if (imageBuffer.length > HOSPITAL_IMAGE_MAX_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Image too large",
        });
      }

      const extension = resolveHospitalImageExtension(input.fileName, contentType);
      const storageKey = `hospitals/${input.hospitalId}/${Date.now()}-${randomUUID()}.${extension}`;
      const { url } = await storagePut(storageKey, imageBuffer, contentType);
      await doctorsRepo.setHospitalImageUrl(input.hospitalId, url);

      return {
        hospitalId: hospital.id,
        imageUrl: url,
      } as const;
    }),

  adminClearHospitalImage: adminProcedure
    .input(adminHospitalImageClearSchema)
    .mutation(async ({ input }) => {
      const hospital = await doctorsRepo.getHospitalById(input.hospitalId);
      if (!hospital) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hospital not found",
        });
      }
      await doctorsRepo.setHospitalImageUrl(input.hospitalId, null);
      return {
        hospitalId: hospital.id,
        imageUrl: null,
      } as const;
    }),

  adminTriageSessions: adminOrOpsProcedure
    .input(adminTriageSessionsInputSchema)
    .query(async ({ input }) => {
      return aiRepo.listAiChatSessionsForAdmin({
        limit: input.limit,
        status: input.status,
        userId: input.userId,
      });
    }),

  adminAppointmentDetail: adminOrOpsProcedure
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
      const actorRole = resolveActorRole(ctx.user?.role);
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
          actorRole,
        },
      });

      return {
        appointmentId: result.appointmentId,
        checkoutUrl: result.checkoutSessionUrl,
      } as const;
    }),

  adminResendAccessLink: adminOrOpsProcedure
    .input(adminAppointmentActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
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
        createdBy: `${actorRole}:${ctx.user.id}:resend_access_link`,
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
        payloadJson: {
          actorRole,
        },
      });

      return {
        ok: true as const,
      };
    }),

  adminIssueAccessLinks: adminOrOpsProcedure
    .input(adminAppointmentActionInputSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
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
        createdBy: `${actorRole}:${ctx.user.id}:issue_access_links`,
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
        payloadJson: {
          actorRole,
        },
      });

      return {
        appointmentId: appointment.id,
        patientLink: issued.patientLink,
        doctorLink: issued.doctorLink,
        expiresAt: issued.expiresAt,
      } as const;
    }),

  adminNotifyDoctorFollowup: adminOrOpsProcedure
    .input(adminNotifyDoctorFollowupInputSchema)
    .mutation(async ({ input }) => {
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const doctor = await doctorsRepo.getDoctorById(appointment.doctorId);
      const recentMessages = await visitRepo.getRecentMessages(appointment.id, 20);
      const latestPatientMessage = recentMessages
        .filter(message => message.senderType === "patient")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      const title = `Doctor follow-up reminder #${appointment.id}`;
      const content = [
        `Appointment: #${appointment.id}`,
        `Patient: ${appointment.email}`,
        `Doctor: ${
          doctor
            ? `${doctor.doctor.name} (${doctor.hospital.name}/${doctor.department.name})`
            : String(appointment.doctorId)
        }`,
        `Status: ${appointment.status}/${appointment.paymentStatus}`,
        `Latest patient message: ${latestPatientMessage?.createdAt?.toISOString() ?? "-"}`,
      ].join("\n");

      const delivered = await notifyOwner({ title, content });
      return {
        ok: delivered,
      } as const;
    }),

  adminUpdateAppointmentStatus: adminProcedure
    .input(adminAppointmentStatusUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
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
          actorRole,
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

  adminUpdateAppointmentSchedule: adminProcedure
    .input(adminAppointmentScheduleUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      const actorRole = resolveActorRole(ctx.user?.role);
      const appointment = await appointmentsRepo.getAppointmentById(input.appointmentId);
      if (!appointment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Appointment not found",
        });
      }

      const now = new Date();
      await appointmentsRepo.updateAppointmentById(appointment.id, {
        scheduledAt: input.scheduledAt,
        updatedAt: now,
      });

      await appointmentsRepo.insertStatusEvent({
        appointmentId: appointment.id,
        fromStatus: appointment.status,
        toStatus: appointment.status,
        operatorType: "admin",
        operatorId: ctx.user.id,
        reason: `admin_schedule_update:${input.reason}`,
        payloadJson: {
          actorRole,
          fromScheduledAt:
            appointment.scheduledAt instanceof Date
              ? appointment.scheduledAt.toISOString()
              : appointment.scheduledAt,
          toScheduledAt: input.scheduledAt.toISOString(),
        },
      });

      return {
        ok: true as const,
        appointmentId: appointment.id,
        scheduledAt: input.scheduledAt,
      };
    }),

  adminGetVisitSummary: adminOrOpsProcedure
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

  adminRetentionPolicies: adminOrOpsProcedure.query(async () => {
    try {
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
    } catch {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "RETENTION_STORAGE_UNAVAILABLE",
      });
    }
  }),

  adminUpsertRetentionPolicy: adminProcedure
    .input(retentionPolicyUpsertSchema)
    .mutation(async ({ input, ctx }) => {
      let updated: Awaited<ReturnType<typeof adminRepo.upsertRetentionPolicy>> | null = null;
      try {
        updated = await adminRepo.upsertRetentionPolicy({
          tier: input.tier,
          retentionDays: input.retentionDays,
          enabled: input.enabled,
          updatedBy: ctx.user.id,
        });
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "RETENTION_STORAGE_UNAVAILABLE",
        });
      }

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
      try {
        return adminRepo.runRetentionCleanup({
          dryRun: input.dryRun,
          createdBy: ctx.user.id,
        });
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "RETENTION_STORAGE_UNAVAILABLE",
        });
      }
    }),

  adminRetentionCleanupAudits: adminOrOpsProcedure
    .input(retentionCleanupAuditListSchema)
    .query(async ({ input }) => {
      try {
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
      } catch {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "RETENTION_STORAGE_UNAVAILABLE",
        });
      }
    }),
});
