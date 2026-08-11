import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "../../_core/context";
import { authGuestIdentityApi as guestIdentity } from "../auth/publicApi";
import * as aiRepo from "./repo";
import type { CreateSessionInput, ListMySessionsInput } from "./schemas";

type AuthUser = NonNullable<TrpcContext["user"]>;

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

export async function listMySessionsAction(
  user: AuthUser,
  input: ListMySessionsInput
) {
  return aiRepo.listAiChatSessionsByUser(user.id, input.limit);
}

async function resolveSessionOwner(
  ctx: Pick<TrpcContext, "user" | "deviceId">
) {
  if (ctx.user) {
    return ctx.user;
  }

  if (!ctx.deviceId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please login to start triage session.",
    });
  }

  const guestUser = await guestIdentity.findOrCreateGuestSessionOwner(
    ctx.deviceId
  );
  if (!guestUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Please login to start triage session.",
    });
  }

  return guestUser;
}

export async function createSessionAction(
  ctx: Pick<TrpcContext, "user" | "deviceId">,
  input: CreateSessionInput
) {
  if (!input.consentAccepted) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Please accept the triage disclaimer before starting.",
    });
  }

  const authUser = await resolveSessionOwner(ctx);

  if (authUser.role === "pro") {
    const sessionId = await aiRepo.createAiChatSession(authUser.id);
    if (input.consentAccepted) {
      await aiRepo.createTriageConsent({
        userId: authUser.id,
        sessionId,
        consentType: "triage_disclaimer",
        consentVersion: input.consentVersion,
        lang: input.lang,
      });
    }
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
    if (input.consentAccepted) {
      await aiRepo.createTriageConsent({
        userId: authUser.id,
        sessionId,
        consentType: "triage_disclaimer",
        consentVersion: input.consentVersion,
        lang: input.lang,
      });
    }
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
  if (input.consentAccepted) {
    await aiRepo.createTriageConsent({
      userId: authUser.id,
      sessionId,
      consentType: "triage_disclaimer",
      consentVersion: input.consentVersion,
      lang: input.lang,
    });
  }
  return { sessionId };
}
