import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email()
  .transform(value => value.toLowerCase());

export const doctorBindingStatusSchema = z.enum([
  "pending_invite",
  "active",
  "revoked",
]);

export const doctorInviteStatusSchema = z.enum([
  "pending",
  "sent",
  "accepted",
  "expired",
  "canceled",
]);

export const inviteDoctorAccountInputSchema = z.object({
  doctorId: z.number().int().positive(),
  email: emailSchema,
});

export const claimDoctorInviteInputSchema = z.object({
  token: z.string().trim().min(32).max(2048),
});

export const doctorBindingSummarySchema = z.object({
  doctorId: z.number().int().positive(),
  userId: z.number().int().positive(),
  email: z.string().email(),
  status: doctorBindingStatusSchema,
  boundAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
});

export const doctorInviteSummarySchema = z.object({
  id: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  email: z.string().email(),
  status: doctorInviteStatusSchema,
  expiresAt: z.date(),
  sentAt: z.date().nullable(),
  acceptedAt: z.date().nullable(),
});

export const doctorAccountStatusOutputSchema = z.object({
  doctorId: z.number().int().positive(),
  activeBinding: doctorBindingSummarySchema.nullable(),
  latestInvite: doctorInviteSummarySchema.nullable(),
});

export const myDoctorBindingOutputSchema = z.object({
  activeBinding: doctorBindingSummarySchema.nullable(),
});

export const inviteDoctorAccountOutputSchema = z.object({
  invite: doctorInviteSummarySchema,
  claimUrl: z.string().url(),
});

export const claimDoctorInviteOutputSchema = z.object({
  success: z.literal(true),
  binding: doctorBindingSummarySchema,
});

export const cancelInviteInputSchema = z.object({
  inviteId: z.number().int().positive(),
});

export const revokeDoctorBindingInputSchema = z.object({
  doctorId: z.number().int().positive(),
});
