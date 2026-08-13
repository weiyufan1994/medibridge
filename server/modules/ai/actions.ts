import { TRPCError } from "@trpc/server";
import type { RequestMetadata } from "@shared/requestMetadata";
import type { LocalizedText } from "@shared/types";
import {
  serializeHistoricalTriageResult,
  TRIAGE_RESULT_FLAG_TYPE,
} from "./historyResult";
import { processTriageChat } from "./service";
import * as aiRepo from "./repo";
import type { TrpcContext } from "../../_core/context";
import { triageKnowledgeApi as knowledge } from "../triageKnowledge/publicApi";
import { triageSafetyApi as safety } from "../triageSafety/publicApi";
import type { ChatTriageInput, SendMessageInput } from "./schemas";
import { createLogger } from "../../_core/logger";

export {
  createSessionAction,
  getUsageSummaryAction,
  listMySessionsAction,
} from "./sessionActions";

const SESSION_MESSAGE_LIMIT = 20;
const logger = createLogger("ai-triage");
const SESSION_LIMIT_REPLY =
  "本次基础问诊已达最大深度。由于病情可能较为复杂，AI 无法继续细分，请尽快查看建议专科和参考医院并线下就诊。";
const SAFETY_CHECK_UNAVAILABLE_REPLY: LocalizedText = {
  zh: "安全检查暂时无法完成，因此本次不会继续生成 AI 分诊建议。请稍后重试；如有胸痛、呼吸困难、意识异常、大出血或其他严重或快速加重的症状，请立即联系当地急救服务或前往急诊。",
  en: "The safety check is temporarily unavailable, so AI triage will not continue for this message. Please try again shortly. If you have chest pain, trouble breathing, altered consciousness, heavy bleeding, or other severe or rapidly worsening symptoms, contact local emergency services or go to the emergency department immediately.",
};

const detectTriageLanguage = (
  messages: Array<{ role: string; content: string }>
): "en" | "zh" => {
  const lastUserMessage = [...messages]
    .reverse()
    .find(
      message => message.role === "user" && message.content.trim().length > 0
    );
  const sample =
    lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? "";
  return /[\u4e00-\u9fff]/.test(sample) ? "zh" : "en";
};

type AuthUser = NonNullable<TrpcContext["user"]>;

function requireUser(user: TrpcContext["user"], message: string): AuthUser {
  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message,
    });
  }
  return user;
}

const resolveLocalizedReply = (message: LocalizedText, lang: "en" | "zh") =>
  message[lang];

type TriageRequestMetadata = Pick<RequestMetadata, "requestId">;

async function persistSafetyOutcome(input: {
  event: string;
  operation: () => Promise<unknown>;
  requestMetadata?: TriageRequestMetadata;
  sessionId: number;
}) {
  try {
    return await input.operation();
  } catch (error) {
    logger.error(input.event, {
      sessionId: input.sessionId,
      requestId: input.requestMetadata?.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return null;
  }
}

async function returnSafetyUnavailable(input: {
  lang: "en" | "zh";
  requestMetadata?: TriageRequestMetadata;
  sessionId: number;
}) {
  const reply = resolveLocalizedReply(
    SAFETY_CHECK_UNAVAILABLE_REPLY,
    input.lang
  );
  await persistSafetyOutcome({
    event: "safety_fallback_message_persistence_failed",
    operation: () =>
      aiRepo.createAiChatMessage({
        sessionId: input.sessionId,
        role: "assistant",
        content: reply,
      }),
    requestMetadata: input.requestMetadata,
    sessionId: input.sessionId,
  });

  return {
    isComplete: false as const,
    reply,
    sessionStatus: "active" as const,
    hitMessageLimit: false as const,
  };
}

async function returnSafetyInterruption(input: {
  displayMessage: LocalizedText;
  lang: "en" | "zh";
  requestMetadata?: TriageRequestMetadata;
  riskScan: ReturnType<typeof safety.scanMessage>;
  sessionId: number;
  userMessageId: number | null;
}) {
  const reply = resolveLocalizedReply(input.displayMessage, input.lang);
  const assistantMessageId = await persistSafetyOutcome({
    event: "safety_interruption_message_persistence_failed",
    operation: () =>
      aiRepo.createAiChatMessage({
        sessionId: input.sessionId,
        role: "assistant",
        content: reply,
      }),
    requestMetadata: input.requestMetadata,
    sessionId: input.sessionId,
  });

  await persistSafetyOutcome({
    event: "safety_risk_event_persistence_failed",
    operation: () =>
      safety.recordRiskEvents({
        sessionId: input.sessionId,
        messageId: input.userMessageId,
        scanResult: input.riskScan,
      }),
    requestMetadata: input.requestMetadata,
    sessionId: input.sessionId,
  });
  await persistSafetyOutcome({
    event: "safety_interruption_flag_persistence_failed",
    operation: () =>
      safety.setSessionFlag({
        sessionId: input.sessionId,
        flagType: "interrupted",
        flagValue: JSON.stringify({
          riskCodes: input.riskScan.matchedRiskCodes,
          severity: input.riskScan.highestSeverity,
          assistantMessageId,
        }),
      }),
    requestMetadata: input.requestMetadata,
    sessionId: input.sessionId,
  });
  await persistSafetyOutcome({
    event: "safety_result_clear_failed",
    operation: () =>
      safety.clearSessionFlagsByType(input.sessionId, TRIAGE_RESULT_FLAG_TYPE),
    requestMetadata: input.requestMetadata,
    sessionId: input.sessionId,
  });
  await persistSafetyOutcome({
    event: "safety_result_persistence_failed",
    operation: () =>
      safety.setSessionFlag({
        sessionId: input.sessionId,
        flagType: TRIAGE_RESULT_FLAG_TYPE,
        flagValue: serializeHistoricalTriageResult({
          isComplete: true,
          reply,
          interruptionMessage: input.displayMessage,
          interrupted: true,
          riskCodes: input.riskScan.matchedRiskCodes,
        }),
      }),
    requestMetadata: input.requestMetadata,
    sessionId: input.sessionId,
  });
  await persistSafetyOutcome({
    event: "safety_session_completion_failed",
    operation: () =>
      aiRepo.updateAiChatSessionStatus(input.sessionId, "completed"),
    requestMetadata: input.requestMetadata,
    sessionId: input.sessionId,
  });

  return {
    isComplete: true as const,
    reply,
    interruptionMessage: input.displayMessage,
    sessionStatus: "completed" as const,
    hitMessageLimit: false as const,
    interrupted: true as const,
    riskCodes: input.riskScan.matchedRiskCodes,
  };
}

export async function sendMessageAction(
  input: SendMessageInput,
  user: TrpcContext["user"],
  requestMetadata?: TriageRequestMetadata
) {
  const authUser = requireUser(user, "Please login to continue triage.");

  const session = await aiRepo.getAiChatSessionById(input.sessionId);
  if (!session) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Triage session not found",
    });
  }
  if (session.userId !== authUser.id) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not allowed to access this triage session",
    });
  }

  const messageCount = await aiRepo.countAiChatMessagesBySessionId(session.id);
  if (messageCount >= SESSION_MESSAGE_LIMIT - 1) {
    if (messageCount < SESSION_MESSAGE_LIMIT) {
      await aiRepo.createAiChatMessage({
        sessionId: session.id,
        role: "assistant",
        content: SESSION_LIMIT_REPLY,
      });
    }
    await aiRepo.updateAiChatSessionStatus(session.id, "completed");
    return {
      isComplete: true,
      reply: SESSION_LIMIT_REPLY,
      sessionStatus: "completed" as const,
      hitMessageLimit: true as const,
    };
  }

  const userMessageId = await aiRepo.createAiChatMessage({
    sessionId: session.id,
    role: "user",
    content: input.content,
  });

  const allMessages = await aiRepo.getAiChatMessagesBySessionId(session.id);
  const triageMessages = allMessages.map(message => ({
    role: message.role,
    content: message.content,
  }));
  const resolvedLang =
    input.lang === "auto" ? detectTriageLanguage(triageMessages) : input.lang;
  let riskScan: ReturnType<typeof safety.scanMessage>;
  try {
    riskScan = safety.scanMessage({
      latestMessage: input.content,
      priorMessages: triageMessages.slice(0, -1),
      lang: resolvedLang,
    });
  } catch (error) {
    logger.error("safety_scan_failed", {
      sessionId: session.id,
      requestId: requestMetadata?.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return returnSafetyUnavailable({
      lang: resolvedLang,
      requestMetadata,
      sessionId: session.id,
    });
  }

  if (riskScan.shouldInterrupt && riskScan.displayMessage) {
    return returnSafetyInterruption({
      displayMessage: riskScan.displayMessage,
      lang: resolvedLang,
      requestMetadata,
      riskScan,
      sessionId: session.id,
      userMessageId,
    });
  }

  let knowledgeContext:
    | Awaited<ReturnType<typeof knowledge.runRetrieval>>
    | undefined;
  try {
    knowledgeContext =
      (await knowledge.runRetrieval({
        latestMessage: input.content,
        sessionSummary: session.summary,
      })) ?? undefined;
    if (knowledgeContext) {
      await safety.setSessionFlag({
        sessionId: session.id,
        flagType: "knowledge_trace",
        flagValue: JSON.stringify(knowledgeContext.trace),
      });
    }
  } catch (error) {
    logger.error("knowledge_retrieval_failed", {
      sessionId: session.id,
      requestId: requestMetadata?.requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  const triageResult = await processTriageChat(
    triageMessages,
    resolvedLang,
    knowledgeContext ?? undefined,
    input.intake ?? undefined
  );
  const safeReply =
    typeof triageResult.reply === "string" &&
    triageResult.reply.trim().length > 0
      ? triageResult.reply.trim()
      : SESSION_LIMIT_REPLY;

  await aiRepo.createAiChatMessage({
    sessionId: session.id,
    role: "assistant",
    content: safeReply,
  });

  if (triageResult.isComplete) {
    await safety.clearSessionFlagsByType(session.id, TRIAGE_RESULT_FLAG_TYPE);
    await safety.setSessionFlag({
      sessionId: session.id,
      flagType: TRIAGE_RESULT_FLAG_TYPE,
      flagValue: serializeHistoricalTriageResult({
        ...triageResult,
        reply: safeReply,
      }),
    });
    await aiRepo.updateAiChatSessionStatus(session.id, "completed");
    if (triageResult.summary && triageResult.summary.trim().length > 0) {
      await aiRepo.setAiChatSessionSummaryIfEmpty(
        session.id,
        triageResult.summary.trim()
      );
    }
  }

  return {
    ...triageResult,
    reply: safeReply,
    sessionStatus: triageResult.isComplete
      ? ("completed" as const)
      : ("active" as const),
    hitMessageLimit: false as const,
  };
}

export async function chatTriageAction(input: ChatTriageInput) {
  const resolvedLang =
    input.lang === "auto" ? detectTriageLanguage(input.messages) : input.lang;
  try {
    return await processTriageChat(input.messages, resolvedLang);
  } catch (error) {
    logger.error("chat_failed", {
      lang: resolvedLang,
      messageCount: input.messages.length,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      isComplete: false,
      reply:
        resolvedLang === "zh"
          ? "如果方便，请先告诉我年龄和性别。然后我继续按 4 个问题帮你确认：1. 最主要的不适是什么，在哪个部位？2. 这个症状多久了，是突然发生还是慢慢加重？3. 是否和外伤或近期手术有关？4. 有没有需要特别注意的基础疾病？没有可直接写“无”。"
          : 'If you are comfortable, please start with your age and gender. Then I will continue with 4 quick questions: 1. What is the main symptom, and where is it located? 2. How long has it been happening, and did it start suddenly or gradually? 3. Is it related to any recent injury or surgery? 4. Do you have any important underlying conditions? If not, write "none".',
    };
  }
}
