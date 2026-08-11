import { z } from "zod";
import { aiConsultationSessionSchema } from "../../../drizzle/schema";
import { historicalTriageResultSchema } from "./historyResult";

export const getHistoryOutputSchema = z.array(aiConsultationSessionSchema);

export const getMessagesBySessionIdInputSchema = z.object({
  sessionId: z.number().int().positive(),
});

const consultationMessageSchema = z.object({
  id: z.number().int().positive(),
  sessionId: z.number().int().positive(),
  role: z.enum(["user", "ai"]),
  content: z.string(),
  createdAt: z.date(),
});

export const getMessagesBySessionIdOutputSchema = z.object({
  messages: z.array(consultationMessageSchema),
  summary: z.string().nullable(),
  triageResult: historicalTriageResultSchema.nullable(),
});
