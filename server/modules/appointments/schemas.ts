import { z } from "zod";
import { APPOINTMENT_STATUS_VALUES, PAYMENT_STATUS_VALUES } from "./stateMachine";
import { APPOINTMENT_PACKAGE_VALUES, APPOINTMENT_TYPE_VALUES } from "./packageCatalog";

const createScheduledAtSchema = z
  .union([z.string().datetime(), z.date()])
  .transform(value => (value instanceof Date ? value : new Date(value)))
  .refine(value => !Number.isNaN(value.getTime()), "Invalid datetime");

export const accessInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  token: z.string().min(16).max(512),
});

export const accessWithLangInputSchema = accessInputSchema.extend({
  lang: z.enum(["en", "zh"]).optional().default("en"),
});

export const rescheduleInputSchema = accessInputSchema.extend({
  newScheduledAt: createScheduledAtSchema,
});

export const appointmentIntakeSchema = z.object({
  chiefComplaint: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  medicalHistory: z.string().optional().default(""),
  medications: z.string().optional().default(""),
  allergies: z.string().optional().default(""),
  ageGroup: z.string().optional().default(""),
  otherSymptoms: z.string().optional().default(""),
});

const appointmentIntakeInputSchema = z.object({
  chiefComplaint: z.string().trim().max(500).optional(),
  duration: z.string().trim().max(200).optional(),
  medicalHistory: z.string().trim().max(1000).optional(),
  medications: z.string().trim().max(1000).optional(),
  allergies: z.string().trim().max(500).optional(),
  ageGroup: z.string().trim().max(64).optional(),
  otherSymptoms: z.string().trim().max(1000).optional(),
});

export const createInputSchema = z.object({
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
  intake: appointmentIntakeInputSchema.optional(),
});

export const createV2InputSchema = z.object({
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
  packageId: z.enum(APPOINTMENT_PACKAGE_VALUES).optional(),
  scheduledAt: createScheduledAtSchema.optional(),
  triageSessionId: z.number().int().positive().optional(),
  sessionId: z.string().trim().min(1).max(64).optional(),
  intake: appointmentIntakeInputSchema.optional(),
});

export const resendLinkInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

export const openMyRoomInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

export const appointmentStatusInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

export const cancelInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  reason: z.string().trim().min(1).max(256).optional(),
});

export const resendInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  email: z
    .string()
    .trim()
    .email()
    .transform(value => value.toLowerCase()),
});

export const issueLinksInputSchema = z.object({
  appointmentId: z.number().int().positive(),
});

export const validateTokenOnlyInputSchema = z.object({
  token: z.string().trim().min(16).max(2048),
});

export const revokeTokenInputSchema = z
  .object({
    appointmentId: z.number().int().positive().optional(),
    role: z.enum(["patient", "doctor"]).optional(),
    token: z.string().trim().min(16).max(2048).optional(),
    revokeReason: z.string().trim().min(1).max(256).optional(),
  })
  .refine(value => Boolean(value.appointmentId || value.token), {
    message: "appointmentId or token is required",
  });

export const completeAppointmentInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  token: z.string().trim().min(16).max(512),
});

const summarySectionDraftSchema = z.string().trim().max(4000).default("");
const summarySectionSignSchema = z.string().trim().min(1).max(4000);

export const generateMedicalSummaryDraftInputSchema = accessWithLangInputSchema.extend({
  forceRegenerate: z.boolean().optional().default(false),
});

export const medicalSummaryDraftOutputSchema = z.object({
  chiefComplaint: summarySectionDraftSchema,
  historyOfPresentIllness: summarySectionDraftSchema,
  pastMedicalHistory: summarySectionDraftSchema,
  assessmentDiagnosis: summarySectionDraftSchema,
  planRecommendations: summarySectionDraftSchema,
  source: z.enum(["llm", "fallback", "saved"]),
});

export const signMedicalSummaryInputSchema = accessInputSchema.extend({
  chiefComplaint: summarySectionSignSchema,
  historyOfPresentIllness: summarySectionSignSchema,
  pastMedicalHistory: summarySectionSignSchema,
  assessmentDiagnosis: summarySectionSignSchema,
  planRecommendations: summarySectionSignSchema,
});

export const appointmentPublicSchema = z.object({
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

export const appointmentAccessOutputSchema = appointmentPublicSchema.extend({
  ...appointmentParticipantSchema.shape,
  triageSummary: z.string().nullable(),
  intake: appointmentIntakeSchema.nullable(),
  consultationDurationMinutes: z.number().int().positive(),
  consultationExtensionMinutes: z.number().int().nonnegative(),
  consultationTotalMinutes: z.number().int().positive(),
});

export const createOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  checkoutUrl: z.string().url(),
  checkoutSessionUrl: z.string().url(),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  stripeSessionId: z.string().optional(),
});

export const joinInfoOutputSchema = appointmentParticipantSchema.extend({
  appointmentId: z.number().int().positive(),
  joinUrl: z.string().url(),
});

export const resendOutputSchema = z.object({
  ok: z.literal(true),
  devLink: z.string().url().optional(),
});

export const openMyRoomOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  joinUrl: z.string().url(),
});

export const appointmentStatusOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  stripeSessionId: z.string().nullable(),
  paidAt: z.date().nullable(),
});

export const resendDoctorOutputSchema = z.object({
  ok: z.literal(true),
  devDoctorLink: z.string().url().optional(),
});

export const issueLinksOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  patientLink: z.string().url(),
  doctorLink: z.string().url(),
  expiresAt: z.date(),
});

export const accessContextOutputSchema = z.object({
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

export const revokeTokenOutputSchema = z.object({
  ok: z.literal(true),
  revokedCount: z.number().int().nonnegative(),
});

export const completeAppointmentOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
});

export const listMineInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const listMineOutputSchema = z.array(appointmentPublicSchema);

const myAppointmentItemSchema = z.object({
  id: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  scheduledAt: z.date().nullable(),
  status: z.enum(APPOINTMENT_STATUS_VALUES),
  paymentStatus: z.enum(PAYMENT_STATUS_VALUES),
  createdAt: z.date(),
});

export const listPackagesInputSchema = z.object({
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES).optional(),
});

const appointmentPackageSchema = z.object({
  id: z.enum(APPOINTMENT_PACKAGE_VALUES),
  appointmentType: z.enum(APPOINTMENT_TYPE_VALUES),
  titleZh: z.string(),
  titleEn: z.string(),
  descriptionZh: z.string(),
  descriptionEn: z.string(),
  durationMinutes: z.number().int().positive(),
  amount: z.number().int().nonnegative(),
  currency: z.string(),
  isDefault: z.boolean(),
});

export const listPackagesOutputSchema = z.array(appointmentPackageSchema);

export const listMyAppointmentsOutputSchema = z.object({
  upcoming: z.array(myAppointmentItemSchema),
  completed: z.array(myAppointmentItemSchema),
  past: z.array(myAppointmentItemSchema),
});
