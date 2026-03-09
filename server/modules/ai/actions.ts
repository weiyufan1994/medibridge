import { TRPCError } from "@trpc/server";
import { processTriageChat } from "./service";
import * as aiRepo from "./repo";
import type { TrpcContext } from "../../_core/context";
import type {
  ChatTriageInput,
  ListMySessionsInput,
  SendMessageInput,
} from "./schemas";

const SESSION_MESSAGE_LIMIT = 20;
const SESSION_LIMIT_REPLY =
  "本次基础问诊已达最大深度。由于病情可能较为复杂，AI 无法给出更多建议，请立即预约下方专业医生进行人工精确诊断。";

const detectTriageLanguage = (
  messages: Array<{ role: string; content: string }>
): "en" | "zh" => {
  const lastUserMessage = [...messages]
    .reverse()
    .find(message => message.role === "user" && message.content.trim().length > 0);
  const sample = lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? "";
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

export async function getUsageSummaryAction(user: AuthUser) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const totalSessions = await aiRepo.countAiChatSessionsByUser(user.id);
  const todaySessions = await aiRepo.countAiChatSessionsByUserBetween(
    user.id,
    todayStart,
    tomorrowStart
  );

  if (user.role === "pro") {
    return {
      role: user.role,
      isGuest: user.isGuest,
      totalSessions,
      todaySessions,
      dailyLimit: null,
      remainingToday: null,
    } as const;
  }

  if (user.isGuest === 1) {
    const lifetimeLimit = 1;
    const remaining = Math.max(0, lifetimeLimit - totalSessions);
    return {
      role: user.role,
      isGuest: user.isGuest,
      totalSessions,
      todaySessions,
      dailyLimit: lifetimeLimit,
      remainingToday: remaining,
    } as const;
  }

  const dailyLimit = 1;
  const remaining = Math.max(0, dailyLimit - todaySessions);
  return {
    role: user.role,
    isGuest: user.isGuest,
    totalSessions,
    todaySessions,
    dailyLimit,
    remainingToday: remaining,
  } as const;
}

export async function listMySessionsAction(user: AuthUser, input: ListMySessionsInput) {
  return aiRepo.listAiChatSessionsByUser(user.id, input.limit);
}

export async function createSessionAction(user: TrpcContext["user"]) {
  const authUser = requireUser(user, "Please login to start triage session.");

  if (authUser.role === "pro") {
    const sessionId = await aiRepo.createAiChatSession(authUser.id);
    return { sessionId };
  }

  if (authUser.isGuest === 1) {
    const totalSessions = await aiRepo.countAiChatSessionsByUser(authUser.id);
    if (totalSessions >= 1) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "游客试用额度已尽，请验证邮箱获取每日免费问诊次数。",
      });
    }

    const sessionId = await aiRepo.createAiChatSession(authUser.id);
    return { sessionId };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(todayStart.getDate() + 1);

  const todaySessions = await aiRepo.countAiChatSessionsByUserBetween(
    authUser.id,
    todayStart,
    tomorrowStart
  );
  if (todaySessions >= 1) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "今日免费会诊次数已用完，请升级 Pro 或明天再来。",
    });
  }

  const sessionId = await aiRepo.createAiChatSession(authUser.id);
  return { sessionId };
}

export async function sendMessageAction(input: SendMessageInput, user: TrpcContext["user"]) {
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

  await aiRepo.createAiChatMessage({
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
  const triageResult = await processTriageChat(triageMessages, resolvedLang);
  const safeReply =
    typeof triageResult.reply === "string" && triageResult.reply.trim().length > 0
      ? triageResult.reply.trim()
      : SESSION_LIMIT_REPLY;

  await aiRepo.createAiChatMessage({
    sessionId: session.id,
    role: "assistant",
    content: safeReply,
  });

  if (triageResult.isComplete) {
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
    sessionStatus: triageResult.isComplete ? ("completed" as const) : ("active" as const),
    hitMessageLimit: false as const,
  };
}

export async function chatTriageAction(input: ChatTriageInput) {
  const resolvedLang =
    input.lang === "auto" ? detectTriageLanguage(input.messages) : input.lang;
  try {
    return await processTriageChat(input.messages, resolvedLang);
  } catch (error) {
    console.error("[AI] chatTriage failed:", error);
    return {
      isComplete: false,
      reply:
        resolvedLang === "zh"
          ? "我正在整理你的信息。请补充主要症状持续了多久、是否有既往病史或正在用药。"
          : "I am organizing your triage details. Please share symptom duration, medical history, and current medications.",
    };
  }
}
