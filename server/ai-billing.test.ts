import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/ai/repo", () => ({
  createAiChatSession: vi.fn(),
  countAiChatSessionsByUser: vi.fn(),
  countAiChatSessionsByUserBetween: vi.fn(),
  getAiChatSessionById: vi.fn(),
  countAiChatMessagesBySessionId: vi.fn(),
  createAiChatMessage: vi.fn(),
  getAiChatMessagesBySessionId: vi.fn(),
  updateAiChatSessionStatus: vi.fn(),
}));

import * as aiRepo from "./modules/ai/repo";
import { aiRouter } from "./routers/ai";

function createTestContext(user: NonNullable<TrpcContext["user"]>): TrpcContext {
  return {
    user,
    userId: user.id,
    deviceId: user.deviceId ?? null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("ai billing guard on createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks guest user when lifetime free session quota is exhausted", async () => {
    vi.mocked(aiRepo.countAiChatSessionsByUser).mockResolvedValue(1 as never);

    const caller = aiRouter.createCaller(
      createTestContext({
        id: 11,
        openId: null,
        name: null,
        email: null,
        isGuest: 1,
        deviceId: "guest-device-11",
        loginMethod: "guest",
        role: "free",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      })
    );

    await expect(caller.createSession()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "游客试用额度已尽，请验证邮箱获取每日免费问诊次数。",
    });
    expect(aiRepo.createAiChatSession).not.toHaveBeenCalled();
  });

  it("blocks free user when today's free session quota is exhausted", async () => {
    vi.mocked(aiRepo.countAiChatSessionsByUserBetween).mockResolvedValue(1 as never);

    const caller = aiRouter.createCaller(
      createTestContext({
        id: 22,
        openId: "email_openid_22",
        name: "Free User",
        email: "free@example.com",
        isGuest: 0,
        deviceId: null,
        loginMethod: "otp",
        role: "free",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      })
    );

    await expect(caller.createSession()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "今日免费会诊次数已用完，请升级 Pro 或明天再来。",
    });
    expect(aiRepo.createAiChatSession).not.toHaveBeenCalled();
  });
});
