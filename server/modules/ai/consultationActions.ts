import { createLogger } from "../../_core/logger";
import {
  parseStoredHistoricalTriageResult,
  rebuildHistoricalTriageResultFromSummary,
  TRIAGE_RESULT_FLAG_TYPE,
} from "./historyResult";
import * as repo from "./repo";

const logger = createLogger("ai-consultation-history");
const CONSULTATION_HISTORY_LIMIT = 50;

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

  const firstMessageTitle = normalizeSessionTitleCandidate(
    input.firstUserMessage
  );
  if (firstMessageTitle) {
    return firstMessageTitle;
  }

  if (Number.isInteger(input.sessionId) && input.sessionId > 0) {
    return `Session #${input.sessionId}`;
  }

  return "New session";
}

export async function getConsultationHistory(userId: number | null) {
  if (!userId) {
    return [];
  }

  const sessions = await repo.listAiChatSessionsByUser(
    userId,
    CONSULTATION_HISTORY_LIMIT
  );
  let firstUserMessagesBySessionId = new Map<number, string>();
  try {
    firstUserMessagesBySessionId = await repo.listFirstUserMessagesBySessionIds(
      sessions.map(session => session.id)
    );
  } catch (error) {
    logger.error("title_lookup_failed", {
      sessionCount: sessions.length,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
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
}

export async function getConsultationMessages(input: {
  sessionId: number;
  userId: number | null;
}) {
  if (!input.userId) {
    return emptyConsultationMessages();
  }

  const session = await repo.getAiChatSessionById(input.sessionId);
  if (!session || session.userId !== input.userId) {
    return emptyConsultationMessages();
  }

  const messages = await repo.getAiChatMessagesBySessionId(input.sessionId);
  const storedResultFlag = await repo.getLatestSessionFlagByType(
    input.sessionId,
    TRIAGE_RESULT_FLAG_TYPE
  );
  const storedTriageResult = parseStoredHistoricalTriageResult(
    storedResultFlag?.flagValue
  );
  const triageResult =
    storedTriageResult ??
    (await rebuildHistoricalTriageResultFromSummary(session.summary));

  return {
    messages: messages.map(message => ({
      id: message.id,
      sessionId: message.sessionId,
      role: message.role === "assistant" ? ("ai" as const) : ("user" as const),
      content: message.content,
      createdAt: message.createdAt,
    })),
    summary: session.summary ?? null,
    triageResult,
  };
}

function emptyConsultationMessages() {
  return {
    messages: [],
    summary: null,
    triageResult: null,
  };
}
