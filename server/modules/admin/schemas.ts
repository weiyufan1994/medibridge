import { z } from "zod";
import {
  APPOINTMENT_STATUS_VALUES,
  PAYMENT_STATUS_VALUES,
} from "../appointments/publicApi";

export const adminAppointmentsInputSchema = z.object({
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
    .enum([
      "createdAt",
      "scheduledAt",
      "amount",
      "status",
      "paymentStatus",
      "id",
    ])
    .optional()
    .default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const adminBatchAppointmentActionSchema = z
  .object({
    action: z.enum([
      "resend_access_link",
      "reinitiate_payment",
      "update_status",
    ]),
    appointmentIds: z.array(z.number().int().positive()).min(1).max(200),
    idempotencyKey: z.string().trim().max(128).optional(),
    toStatus: z.enum(APPOINTMENT_STATUS_VALUES).optional(),
    toPaymentStatus: z.enum(PAYMENT_STATUS_VALUES).optional(),
    reason: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .optional()
      .default("admin_batch_action"),
  })
  .superRefine((input, ctx) => {
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

export const adminWebhookReplaySchema = z
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

export const adminExportScopeSchema = z.enum([
  "appointments",
  "risk_summary",
  "retention_audits",
  "webhook_timeline",
  "operation_audit",
]);

export const adminExportSchema = z.object({
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
    .enum([
      "createdAt",
      "scheduledAt",
      "amount",
      "status",
      "paymentStatus",
      "id",
    ])
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

export const adminOperationAuditInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(200).optional().default(20),
  operatorId: z.number().int().positive().optional(),
  actionType: z.string().trim().max(80).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const adminUsersInputSchema = z.object({
  emailQuery: z.string().trim().max(320).optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const adminUserRoleSchema = z.enum(["free", "pro", "admin", "ops"]);

export const adminUpdateUserRoleSchema = z.object({
  userId: z.number().int().positive(),
  role: adminUserRoleSchema,
});

export const adminTriageSessionsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
  status: z.enum(["active", "completed"]).optional(),
  userId: z.number().int().positive().optional(),
});
export const adminTriageRiskEventsInputSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const adminAppointmentDetailInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});
export const adminAppointmentActionInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});
export const adminAppointmentScheduleUpdateSchema = z.object({
  appointmentId: z.number().int().positive(),
  scheduledAt: z.coerce.date(),
  reason: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .optional()
    .default("ops_manual_schedule"),
});
export const adminNotifyDoctorFollowupInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});
export const adminAppointmentStatusUpdateSchema = z.object({
  appointmentId: z.number().int().positive(),
  toStatus: z.enum(APPOINTMENT_STATUS_VALUES),
  toPaymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  reason: z.string().trim().min(3).max(200),
});
export const adminSummaryInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  forceRegenerate: z.boolean().optional().default(false),
});
export const adminSummaryPdfInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  lang: z.enum(["zh", "en"]).optional().default("zh"),
});
export const adminHospitalImageUploadSchema = z.object({
  hospitalId: z.number().int().positive(),
  imageBase64: z.string().trim().min(1),
  fileName: z.string().trim().max(255).optional(),
  contentType: z.string().trim().max(80).optional(),
});
export const adminHospitalImageClearSchema = z.object({
  hospitalId: z.number().int().positive(),
});
export const retentionPolicyTierSchema = z.enum(["free", "paid"]);
export const retentionPolicyUpsertSchema = z.object({
  tier: retentionPolicyTierSchema,
  retentionDays: z.number().int().min(1).max(3650),
  enabled: z.boolean().default(true),
});
export const retentionCleanupRunSchema = z.object({
  dryRun: z.boolean().optional().default(true),
});
export const retentionCleanupAuditListSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(20),
});

export const adminAppointmentIntakeSchema = z.object({
  chiefComplaint: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  medicalHistory: z.string().optional().default(""),
  medications: z.string().optional().default(""),
  allergies: z.string().optional().default(""),
  ageGroup: z.string().optional().default(""),
  otherSymptoms: z.string().optional().default(""),
});
