import { z } from "zod";
import {
  REFERRAL_ACTOR_TYPE_VALUES,
  REFERRAL_ORDER_STATUS_VALUES,
  REFERRAL_PAYMENT_STATUS_VALUES,
  REFERRAL_REFUND_REASON_CODE_VALUES,
  REFUND_REQUEST_STATUS_VALUES,
} from "../../../shared/referrals";

const localizedTextSchema = z.object({
  zh: z.string(),
  en: z.string(),
});

const createDateSchema = z
  .union([z.string().datetime(), z.date()])
  .transform(value => (value instanceof Date ? value : new Date(value)))
  .refine(value => !Number.isNaN(value.getTime()), "Invalid datetime");

const referralOrderStatusSchema = z.enum(REFERRAL_ORDER_STATUS_VALUES);
const referralPaymentStatusSchema = z.enum(REFERRAL_PAYMENT_STATUS_VALUES);
const refundRequestStatusSchema = z.enum(REFUND_REQUEST_STATUS_VALUES);
const referralActorTypeSchema = z.enum(REFERRAL_ACTOR_TYPE_VALUES);

export const getTriageRecommendationsInputSchema = z.object({
  triageSessionId: z.number().int().positive(),
});

export const referralTriageRecommendationOutputSchema = z.object({
  triageSessionId: z.number().int().positive(),
  summary: z.string().nullable(),
  recommendedDepartment: localizedTextSchema.nullable(),
  hospitals: z.array(
    z.object({
      hospitalName: z.string(),
      city: z.string().nullable(),
      specialtyRank: z.number().nullable(),
      specialtyScore: z.number().nullable(),
      generalGrade: z.string().nullable(),
      stemRank: z.number().nullable(),
      matchedHospitalId: z.number().nullable(),
      matchedDepartmentId: z.number().nullable(),
      reason: z.string(),
    })
  ),
});

const rankedHospitalSelectionInputFields = {
  triageSessionId: z.number().int().positive(),
  rankedHospitalIndex: z.number().int().min(0).optional(),
  hospitalId: z.number().int().positive().optional(),
} as const;

function withRankedHospitalSelectionConstraint<
  T extends z.ZodObject<typeof rankedHospitalSelectionInputFields>
>(schema: T) {
  return schema.refine(
    value =>
      typeof value.rankedHospitalIndex === "number" ||
      typeof value.hospitalId === "number",
    {
      message: "A ranked hospital selection is required",
      path: ["rankedHospitalIndex"],
    }
  );
}

export const getSelectionContextInputSchema = withRankedHospitalSelectionConstraint(
  z.object(rankedHospitalSelectionInputFields)
);

export const referralHospitalSchema = z.object({
  id: z.number().int().positive(),
  name: localizedTextSchema,
  city: localizedTextSchema,
  level: localizedTextSchema,
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});

export const referralDepartmentSchema = z.object({
  id: z.number().int().positive(),
  name: localizedTextSchema,
  isActive: z.boolean(),
});

export const referralDisplayHospitalSchema = z.object({
  id: z.number().int().positive().nullable(),
  name: localizedTextSchema,
  city: localizedTextSchema,
  level: localizedTextSchema,
  imageUrl: z.string().nullable(),
  isLocalCatalogMatch: z.boolean(),
});

export const referralDisplayDepartmentSchema = z.object({
  id: z.number().int().positive().nullable(),
  name: localizedTextSchema,
  isLocalCatalogMatch: z.boolean(),
});

export const referralContactSchema = z.object({
  id: z.number().int().positive(),
  hospitalId: z.number().int().positive(),
  departmentId: z.number().int().positive(),
  name: z.string(),
  roleType: z.string(),
  languages: z.array(z.string()),
  specialtyTags: z.array(z.string()),
  avgResponseTimeMinutes: z.number().int().positive().nullable(),
  successRate: z.number().int().min(0).max(100).nullable(),
  isActive: z.boolean(),
});

const nullableReferralContactSchema = referralContactSchema.nullable();

export const selectionContextOutputSchema = z.object({
  triageSessionId: z.number().int().positive(),
  triageSummary: z.string().nullable(),
  recommendationReason: z.string().nullable(),
  manualFulfillmentRequired: z.boolean(),
  hospital: referralDisplayHospitalSchema,
  department: referralDisplayDepartmentSchema,
  contacts: z.array(referralContactSchema),
});

export const createOrderDraftInputSchema = withRankedHospitalSelectionConstraint(
  z.object({
    ...rankedHospitalSelectionInputFields,
    contactId: z.number().int().positive().optional(),
    agreementAccepted: z.literal(true),
    agreementVersion: z.string().trim().min(1).max(32),
    agreementLang: z.enum(["zh", "en"]),
  })
);

export const referralOrderSummarySchema = z.object({
  id: z.number().int().positive(),
  status: referralOrderStatusSchema,
  paymentStatus: referralPaymentStatusSchema,
  manualFulfillmentRequired: z.boolean(),
  totalAmount: z.number().int().nonnegative(),
  currency: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  paidAt: z.date().nullable(),
});

export const createOrderDraftOutputSchema = referralOrderSummarySchema;

export const createPaymentSessionInputSchema = z.object({
  orderId: z.number().int().positive(),
});

export const createPaymentSessionOutputSchema = z.object({
  orderId: z.number().int().positive(),
  status: referralOrderStatusSchema,
  paymentStatus: referralPaymentStatusSchema,
  checkoutSessionUrl: z.string().url(),
  paymentSessionId: z.string().optional(),
});

export const confirmMockPaymentInputSchema = z.object({
  orderId: z.number().int().positive(),
});

export const confirmReturnedPaymentSessionInputSchema = z.object({
  paymentSessionId: z.string().trim().min(8).max(255),
});

export const confirmMockPaymentOutputSchema = z.object({
  ok: z.literal(true),
  orderId: z.number().int().positive(),
  status: referralOrderStatusSchema,
  paymentStatus: referralPaymentStatusSchema,
  paymentSessionId: z.string().nullable(),
});

export const listMineOrdersInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const myReferralOrderItemSchema = z.object({
  id: z.number().int().positive(),
  status: referralOrderStatusSchema,
  paymentStatus: referralPaymentStatusSchema,
  totalAmount: z.number().int().nonnegative(),
  currency: z.string(),
  consultationTime: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  manualFulfillmentRequired: z.boolean(),
  hospital: referralDisplayHospitalSchema,
  department: referralDisplayDepartmentSchema,
  contact: nullableReferralContactSchema,
  refundStatus: refundRequestStatusSchema.nullable(),
});

export const listMineOrdersOutputSchema = z.array(myReferralOrderItemSchema);

export const getOrderDetailInputSchema = z.object({
  orderId: z.number().int().positive(),
});

export const referralOrderTimelineEventSchema = z.object({
  id: z.number().int().positive(),
  fromStatus: referralOrderStatusSchema.nullable(),
  toStatus: referralOrderStatusSchema,
  actorType: referralActorTypeSchema,
  actorId: z.number().int().positive().nullable(),
  reason: z.string().nullable(),
  createdAt: z.date(),
});

export const referralOrderOperationSchema = z.object({
  id: z.number().int().positive(),
  actionType: z.string(),
  operatorType: referralActorTypeSchema,
  operatorId: z.number().int().positive().nullable(),
  actionPayload: z.unknown().nullable(),
  createdAt: z.date(),
});

export const refundRequestSchema = z.object({
  id: z.number().int().positive(),
  reasonCode: z.enum(REFERRAL_REFUND_REASON_CODE_VALUES),
  reasonDetail: z.string().nullable(),
  status: refundRequestStatusSchema,
  requestedBy: z.number().int().positive().nullable(),
  reviewedBy: z.number().int().positive().nullable(),
  approvedAt: z.date().nullable(),
  refundedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const referralOrderDetailOutputSchema = z.object({
  order: referralOrderSummarySchema.extend({
    triageSessionId: z.number().int().positive(),
    consultationTime: z.date().nullable(),
    assignedAgentId: z.number().int().positive().nullable(),
    agreementAcceptedAt: z.date(),
    agreementVersion: z.string(),
    agreementLang: z.enum(["zh", "en"]),
    refundReason: z.string().nullable(),
    completedAt: z.date().nullable(),
    refundedAt: z.date().nullable(),
  }),
  triageSummary: z.string().nullable(),
  recommendationReason: z.string().nullable(),
  hospital: referralDisplayHospitalSchema,
  department: referralDisplayDepartmentSchema,
  contact: nullableReferralContactSchema,
  timeline: z.array(referralOrderTimelineEventSchema),
  operations: z.array(referralOrderOperationSchema),
  refundRequest: refundRequestSchema.nullable(),
});

export const adminReferralOrderDetailOutputSchema = referralOrderDetailOutputSchema.extend({
  patient: z.object({
    id: z.number().int().positive(),
    email: z.string().email().nullable(),
    role: z.string().nullable(),
  }),
});

export const listOrdersInputSchema = z.object({
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(20),
  status: referralOrderStatusSchema.optional(),
  assignedToMe: z.boolean().optional(),
  hospitalId: z.number().int().positive().optional(),
  sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const adminReferralOrderListItemSchema = z.object({
  id: z.number().int().positive(),
  patientUserId: z.number().int().positive(),
  patientEmail: z.string().email().nullable(),
  status: referralOrderStatusSchema,
  paymentStatus: referralPaymentStatusSchema,
  totalAmount: z.number().int().nonnegative(),
  currency: z.string(),
  consultationTime: z.date().nullable(),
  assignedAgentId: z.number().int().positive().nullable(),
  hospitalName: localizedTextSchema,
  departmentName: localizedTextSchema,
  contactName: z.string().nullable(),
  manualFulfillmentRequired: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  urgencyMinutes: z.number().int().nonnegative(),
});

export const listOrdersOutputSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().min(1),
  items: z.array(adminReferralOrderListItemSchema),
});

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

export const setConsultationTimeInputSchema = z.object({
  orderId: z.number().int().positive(),
  consultationTime: createDateSchema,
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

export const listReferralContactsOutputSchema = z.array(referralContactSchema);
export const listReferralHospitalsOutputSchema = z.array(referralHospitalSchema);
export const listReferralDepartmentsOutputSchema = z.array(referralDepartmentSchema);

export const assignableAgentSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  role: z.string(),
});

export const listAssignableAgentsOutputSchema = z.array(assignableAgentSchema);
