import { z } from "zod";

export const emailInputSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform(value => value.toLowerCase()),
});

export const verifyOtpInputSchema = emailInputSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/),
  deviceId: z.string().trim().min(8).max(128),
});

export const verifyMagicLinkInputSchema = z.object({
  token: z.string().trim().min(16).max(2048),
  appointmentId: z.number().int().positive().optional(),
});

export const requestOtpOutputSchema = z.object({
  success: z.literal(true),
  expiresInMs: z.number().int().positive(),
});

export const verifyOtpAndMergeOutputSchema = z.object({
  success: z.literal(true),
  userId: z.number().int().positive(),
  mergedGuestUserId: z.number().int().positive().nullable(),
});

export const verifyMagicLinkOutputSchema = z.object({
  success: z.literal(true),
  userId: z.number().int().positive(),
  appointmentId: z.number().int().positive(),
});

export const logoutOutputSchema = z.object({
  success: z.literal(true),
});

export type RequestOtpInput = z.infer<typeof emailInputSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpInputSchema>;
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkInputSchema>;
