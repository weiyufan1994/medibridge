import { z } from "zod";
import {
  REFERRAL_ORDER_STATUS_VALUES,
  REFERRAL_REFUND_REASON_CODE_VALUES,
} from "../../../shared/referrals";

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

const createDateSchema = z
  .union([z.string().datetime(), z.date()])
  .transform(value => (value instanceof Date ? value : new Date(value)))
  .refine(value => !Number.isNaN(value.getTime()), "Invalid datetime");

const referralOrderStatusSchema = z.enum(REFERRAL_ORDER_STATUS_VALUES);

export const listReferralContactsInputSchema = z.object({
  hospitalId: z.number().int().positive().optional(),
});

export const listReferralDepartmentsInputSchema = z.object({
  hospitalId: z.number().int().positive(),
});

export const claimOrderInputSchema = z.object({
  orderId: z.number().int().positive(),
});

export const assignOrderInputSchema = z.object({
  orderId: z.number().int().positive(),
  assigneeId: z.number().int().positive(),
});

export const assignOrderContactInputSchema = z.object({
  orderId: z.number().int().positive(),
  contactId: z.number().int().positive(),
});

export const updateOrderStatusInputSchema = z.object({
  orderId: z.number().int().positive(),
  toStatus: referralOrderStatusSchema,
  reason: z.string().trim().min(3).max(240),
});

export const addInternalNoteInputSchema = z.object({
  orderId: z.number().int().positive(),
  note: z.string().trim().min(1).max(4000),
});

export const publishPatientProgressUpdateInputSchema = z.object({
  orderId: z.number().int().positive(),
  detail: z.string().trim().min(1).max(4000),
});

export const recordContactAttemptInputSchema = z.object({
  orderId: z.number().int().positive(),
  outcome: z.enum(["connected", "no_response", "failed"]),
  note: z.string().trim().min(1).max(4000),
});

export const recordBookingResultInputSchema = z.object({
  orderId: z.number().int().positive(),
  outcome: z.enum(["progressing", "failed", "scheduled"]),
  note: z.string().trim().min(1).max(4000),
});

export const beginTimeCoordinationInputSchema = z.object({
  orderId: z.number().int().positive(),
  note: z.string().trim().min(1).max(4000),
});

export const setConsultationTimeInputSchema = z.object({
  orderId: z.number().int().positive(),
  consultationTime: createDateSchema,
  timeZone: z.string().trim().min(1).max(64).refine(isValidTimeZone, {
    message: "Consultation time zone must be a valid IANA time zone",
  }),
  providerName: z.string().trim().min(1).max(255),
  platform: z.string().trim().min(1).max(120),
  joinUrl: z
    .string()
    .url()
    .max(1024)
    .refine(value => value.startsWith("https://"), {
      message: "Consultation join URL must use HTTPS",
    }),
  instructions: z.string().trim().min(1).max(4000),
  note: z.string().trim().max(4000).optional(),
});

export const initiateRefundInputSchema = z.object({
  orderId: z.number().int().positive(),
  reasonCode: z.enum(REFERRAL_REFUND_REASON_CODE_VALUES),
  reasonDetail: z.string().trim().min(1).max(4000),
});

export const reviewRefundInputSchema = z.object({
  orderId: z.number().int().positive(),
  refundRequestId: z.number().int().positive(),
  approve: z.boolean(),
  note: z.string().trim().max(4000).optional(),
});

export const upsertHospitalInputSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(255),
  nameEn: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  cityEn: z.string().trim().max(100).optional(),
  isActive: z.boolean(),
});

export const upsertContactInputSchema = z.object({
  id: z.number().int().positive().optional(),
  hospitalId: z.number().int().positive(),
  departmentId: z.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  roleType: z.string().trim().min(1).max(120),
  languages: z.array(z.string().trim().min(1).max(32)).max(20),
  specialtyTags: z.array(z.string().trim().min(1).max(64)).max(20),
  avgResponseTimeMinutes: z.number().int().positive().optional(),
  successRate: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean(),
  internalNotes: z.string().trim().max(4000).optional(),
});

export const toggleCatalogActiveInputSchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
});

export const updateHospitalActiveInputSchema = z.object({
  hospitalId: z.number().int().positive(),
  isActive: z.boolean(),
});

export const updateContactActiveInputSchema = z.object({
  contactId: z.number().int().positive(),
  isActive: z.boolean(),
});
