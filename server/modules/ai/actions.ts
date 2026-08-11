import { TRPCError } from "@trpc/server";
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

export async function sendMessageAction(
  input: SendMessageInput,
  user: TrpcContext["user"]
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
  try {
    const riskScan = safety.scanMessage({
      latestMessage: input.content,
      priorMessages: triageMessages.slice(0, -1),
      lang: resolvedLang,
    });

    if (riskScan.shouldInterrupt && riskScan.displayMessage) {
      const localizedReply = resolveLocalizedReply(
        riskScan.displayMessage,
        resolvedLang
      );
      const assistantMessageId = await aiRepo.createAiChatMessage({
        sessionId: session.id,
        role: "assistant",
        content: localizedReply,
      });
      await safety.recordRiskEvents({
        sessionId: session.id,
        messageId: userMessageId,
        scanResult: riskScan,
      });
      await safety.setSessionFlag({
        sessionId: session.id,
        flagType: "interrupted",
        flagValue: JSON.stringify({
          riskCodes: riskScan.matchedRiskCodes,
          severity: riskScan.highestSeverity,
          assistantMessageId,
        }),
      });
      await safety.clearSessionFlagsByType(session.id, TRIAGE_RESULT_FLAG_TYPE);
      await safety.setSessionFlag({
        sessionId: session.id,
        flagType: TRIAGE_RESULT_FLAG_TYPE,
        flagValue: serializeHistoricalTriageResult({
          isComplete: true,
          reply: localizedReply,
          interruptionMessage: riskScan.displayMessage,
          interrupted: true,
          riskCodes: riskScan.matchedRiskCodes,
        }),
      });
      await aiRepo.updateAiChatSessionStatus(session.id, "completed");
      return {
        isComplete: true,
        reply: localizedReply,
        interruptionMessage: riskScan.displayMessage,
        sessionStatus: "completed" as const,
        hitMessageLimit: false as const,
        interrupted: true as const,
        riskCodes: riskScan.matchedRiskCodes,
      };
    }
  } catch (error) {
    logger.error("safety_scan_failed", {
      sessionId: session.id,
      errorName: error instanceof Error ? error.name : "UnknownError",
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
