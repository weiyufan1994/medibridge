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

function normalizeSessionTitleCandidate(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\s+/g, " ").slice(0, 255);
}

function buildSessionTitle(input: {
  summary: string | null;
  firstUserMessage?: string | null;
  sessionId: number;
}) {
  const summaryTitle = normalizeSessionTitleCandidate(input.summary);
  if (summaryTitle) {
    return summaryTitle;
  }

  const firstMessageTitle = normalizeSessionTitleCandidate(input.firstUserMessage);
  if (firstMessageTitle) {
    return firstMessageTitle;
  }

  const sessionId = input.sessionId;
  if (Number.isInteger(sessionId) && sessionId > 0) {
    return `Session #${sessionId}`;
  }

  return "New session";
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
    let firstUserMessagesBySessionId = new Map<number, string>();
    try {
      firstUserMessagesBySessionId = await aiRepo.listFirstUserMessagesBySessionIds(
        sessions.map(session => session.id)
      );
    } catch (error) {
      console.error("[consultation.getHistory] failed to resolve first user messages", error);
    }

    return sessions.map(session => ({
      id: session.id,
      userId: session.userId ?? null,
      title: buildSessionTitle({
        summary: session.summary,
        firstUserMessage: firstUserMessagesBySessionId.get(session.id) ?? null,
        sessionId: session.id,
      }),
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
