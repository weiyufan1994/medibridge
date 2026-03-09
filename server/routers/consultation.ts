import { z } from "zod";
import { aiConsultationSessionSchema } from "../../drizzle/schema";
import * as aiRepo from "../modules/ai/repo";
import { publicProcedure, router } from "../_core/trpc";

const CONSULTATION_HISTORY_LIMIT = 50;

const getHistoryOutputSchema = z.array(aiConsultationSessionSchema);
const getMessagesBySessionIdInputSchema = z.object({
  sessionId: z.number().int().positive(),
});
const getMessagesBySessionIdOutputSchema = z.array(
  z.object({
    id: z.number().int().positive(),
    sessionId: z.number().int().positive(),
    role: z.enum(["user", "ai"]),
    content: z.string(),
    createdAt: z.date(),
  })
);

function buildSessionTitle(summary: string | null, sessionId: number) {
  const trimmedSummary = summary?.trim();
  if (trimmedSummary && trimmedSummary.length > 0) {
    return trimmedSummary.slice(0, 255);
  }
  return `Session #${sessionId}`;
}

export const consultationRouter = router({
  getHistory: publicProcedure.output(getHistoryOutputSchema).query(async ({ ctx }) => {
    if (!ctx.userId) {
      return [];
    }

    const sessions = await aiRepo.listAiChatSessionsByUser(
      ctx.userId,
      CONSULTATION_HISTORY_LIMIT
    );

    return sessions.map(session => ({
      id: session.id,
      userId: session.userId ?? null,
      title: buildSessionTitle(session.summary, session.id),
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }),
  getMessagesBySessionId: publicProcedure
    .input(getMessagesBySessionIdInputSchema)
    .output(getMessagesBySessionIdOutputSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.userId) {
        return [];
      }

      const session = await aiRepo.getAiChatSessionById(input.sessionId);
      if (!session || session.userId !== ctx.userId) {
        return [];
      }

      const messages = await aiRepo.getAiChatMessagesBySessionId(input.sessionId);
      return messages.map(message => ({
        id: message.id,
        sessionId: message.sessionId,
        role: message.role === "assistant" ? ("ai" as const) : ("user" as const),
        content: message.content,
        createdAt: message.createdAt,
      }));
    }),
});
