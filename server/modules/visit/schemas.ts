import { z } from "zod";

export const accessInputSchema = z.object({
  appointmentId: z.number().int().positive(),
  token: z.string().min(16).max(512),
});

export const getMessagesInputSchema = accessInputSchema.extend({
  limit: z.number().int().min(1).max(200).optional().default(50),
  beforeCursor: z.string().trim().min(1).optional(),
});

export const roomGetMessagesInputSchema = z.object({
  token: z.string().trim().min(16).max(512),
  limit: z.number().int().min(1).max(200).optional().default(50),
  beforeCursor: z.string().trim().min(1).optional(),
});

export const sendMessageInputSchema = accessInputSchema.extend({
  content: z.string().trim().min(1).max(4000),
  sourceLanguage: z.string().trim().min(2).max(8).optional().default("auto"),
  targetLanguage: z.string().trim().min(2).max(8).optional().default("auto"),
  clientMessageId: z.string().trim().min(1).max(128).optional(),
  clientMsgId: z.string().trim().min(1).max(128).optional(),
});

export const pollMessagesInputSchema = accessInputSchema.extend({
  afterCreatedAt: z
    .union([z.string().datetime(), z.date()])
    .transform(value => (value instanceof Date ? value : new Date(value)))
    .optional(),
  afterId: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

export const messageSchema = z.object({
  id: z.number().int().positive(),
  senderType: z.enum(["patient", "doctor", "system"]),
  content: z.string(),
  originalContent: z.string(),
  translatedContent: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  createdAt: z.date(),
  clientMessageId: z.string().nullable(),
});

export const roomGetMessagesOutputSchema = z.object({
  appointmentId: z.number().int().positive(),
  role: z.enum(["patient", "doctor"]),
  messages: z.array(messageSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const getMessagesOutputSchema = z.object({
  messages: z.array(messageSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const sendMessageOutputSchema = z.object({
  id: z.number().int().positive(),
  senderType: z.enum(["patient", "doctor", "system"]),
  createdAt: z.date(),
});

export const pollMessagesOutputSchema = z.object({
  messages: z.array(messageSchema),
});

export type RoomGetMessagesInput = z.infer<typeof roomGetMessagesInputSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesInputSchema>;
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type PollMessagesInput = z.infer<typeof pollMessagesInputSchema>;
export type SendMessageOutput = z.infer<typeof sendMessageOutputSchema>;
