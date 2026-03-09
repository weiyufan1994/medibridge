import { z } from "zod";

export const chatHistoryItemSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const sendMessageInputSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string(),
  chatHistory: z.array(chatHistoryItemSchema).optional(),
  lang: z.enum(["auto", "en", "zh"]).optional().default("auto"),
});

export const sendMessageOutputSchema = z.object({
  sessionId: z.string(),
  message: z.string(),
  recommendedDoctors: z.array(
    z.object({
      doctorId: z.number().int().positive(),
      reason: z.string(),
    })
  ),
  extraction: z.object({
    keywords: z.array(z.string()),
    symptoms: z.string(),
    duration: z.string(),
    age: z.number().nullable(),
    urgency: z.enum(["low", "medium", "high"]),
    readyForRecommendation: z.boolean(),
  }),
});

export const getSessionInputSchema = z.object({
  sessionId: z.string(),
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type GetSessionInput = z.infer<typeof getSessionInputSchema>;
