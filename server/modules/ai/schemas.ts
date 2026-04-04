import { z } from "zod";

const DASHBOARD_SESSION_LIST_LIMIT = 30;
const triageIntakeGenderSchema = z.enum(["male", "female", "other", "unknown"]);

const triageIntakeSchema = z.object({
  age: z.number().int().min(0).max(120).nullable(),
  gender: triageIntakeGenderSchema,
  mainSymptomAndLocation: z.string().trim().max(500),
  durationAndOnset: z.string().trim().max(500),
  traumaOrSurgery: z.string().trim().max(500),
  chronicConditions: z.string().trim().max(500),
});

export const createSessionInputSchema = z.object({
  consentAccepted: z.boolean().optional().default(false),
  consentVersion: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .optional()
    .default("stream_b_v1"),
  lang: z.enum(["en", "zh"]).optional().default("zh"),
});

export const listMySessionsInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(DASHBOARD_SESSION_LIST_LIMIT),
});

export const sendMessageInputSchema = z.object({
  sessionId: z.number().int().positive(),
  content: z.string().trim().min(1).max(2000),
  lang: z.enum(["auto", "en", "zh"]).optional().default("auto"),
  intake: triageIntakeSchema.optional(),
});

export const chatTriageInputSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.string(),
      })
    )
    .min(1),
  lang: z.enum(["auto", "en", "zh"]).optional().default("auto"),
});

export type ListMySessionsInput = z.infer<typeof listMySessionsInputSchema>;
export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type ChatTriageInput = z.infer<typeof chatTriageInputSchema>;
