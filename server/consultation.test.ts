import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/ai/repo", () => ({
  listAiChatSessionsByUser: vi.fn(),
  listFirstUserMessagesBySessionIds: vi.fn(),
  getAiChatSessionById: vi.fn(),
  getAiChatMessagesBySessionId: vi.fn(),
  getLatestSessionFlagByType: vi.fn(),
}));

import * as aiRepo from "./modules/ai/repo";
import { consultationRouter } from "./routers/consultation";

function createTestContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "openid-7",
      email: "patient@example.com",
      name: "Patient",
      isGuest: 0,
      deviceId: null,
      loginMethod: "otp",
      role: "free",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    userId: 7,
    deviceId: "device-7",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("consultation.getHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiRepo.getLatestSessionFlagByType).mockResolvedValue(
      null as never
    );
  });

  it("returns session history with first user message titles", async () => {
    vi.mocked(aiRepo.listAiChatSessionsByUser).mockResolvedValue([
      {
        id: 11,
        userId: 7,
        status: "active",
        summary: null,
        summaryGeneratedAt: null,
        createdAt: new Date("2026-03-18T02:00:00.000Z"),
        updatedAt: new Date("2026-03-18T02:05:00.000Z"),
      },
    ] as never);
    vi.mocked(aiRepo.listFirstUserMessagesBySessionIds).mockResolvedValue(
      new Map([[11, "腹痛拉稀一天"]]) as never
    );

    const caller = consultationRouter.createCaller(createTestContext());
    const result = await caller.getHistory();

    expect(result).toEqual([
      expect.objectContaining({
        id: 11,
        title: "腹痛拉稀一天",
        status: "active",
      }),
    ]);
  });

  it("normalizes a stored summary before using it as the title", async () => {
    vi.mocked(aiRepo.listAiChatSessionsByUser).mockResolvedValue([
      {
        id: 13,
        userId: 7,
        status: "completed",
        summary: "  胸闷   两天  ",
        createdAt: new Date("2026-03-18T02:00:00.000Z"),
        updatedAt: new Date("2026-03-18T02:05:00.000Z"),
      },
    ] as never);
    vi.mocked(aiRepo.listFirstUserMessagesBySessionIds).mockResolvedValue(
      new Map([[13, "ignored first message"]]) as never
    );

    const caller = consultationRouter.createCaller(createTestContext());

    await expect(caller.getHistory()).resolves.toEqual([
      expect.objectContaining({ id: 13, title: "胸闷 两天" }),
    ]);
  });

  it("falls back to session ids when title lookup fails", async () => {
    vi.mocked(aiRepo.listAiChatSessionsByUser).mockResolvedValue([
      {
        id: 12,
        userId: 7,
        status: "completed",
        summary: null,
        summaryGeneratedAt: null,
        createdAt: new Date("2026-03-17T03:00:00.000Z"),
        updatedAt: new Date("2026-03-17T03:20:00.000Z"),
      },
    ] as never);
    vi.mocked(aiRepo.listFirstUserMessagesBySessionIds).mockRejectedValue(
      new Error("broken title lookup") as never
    );

    const caller = consultationRouter.createCaller(createTestContext());
    const result = await caller.getHistory();

    expect(result).toEqual([
      expect.objectContaining({
        id: 12,
        title: "Session #12",
        status: "completed",
      }),
    ]);
  });

  it("returns persisted triage results for historical sessions", async () => {
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue({
      id: 11,
      userId: 7,
      status: "completed",
      summary:
        "年龄/性别：36岁 / 男\n核心症状与部位：胸闷\n发病时间与急缓：2天，突然出现",
      summaryGeneratedAt: new Date("2026-03-18T02:05:00.000Z"),
      createdAt: new Date("2026-03-18T02:00:00.000Z"),
      updatedAt: new Date("2026-03-18T02:05:00.000Z"),
    } as never);
    vi.mocked(aiRepo.getAiChatMessagesBySessionId).mockResolvedValue([
      {
        id: 100,
        sessionId: 11,
        role: "user",
        content: "我今年36岁，男，我觉得胸闷",
        createdAt: new Date("2026-03-18T02:01:00.000Z"),
      },
      {
        id: 101,
        sessionId: 11,
        role: "assistant",
        content: "已根据您提供的关键信息完成极速分诊。",
        createdAt: new Date("2026-03-18T02:02:00.000Z"),
      },
    ] as never);
    vi.mocked(aiRepo.getLatestSessionFlagByType).mockResolvedValue({
      id: 1,
      sessionId: 11,
      flagType: "triage_result_v1",
      flagValue: JSON.stringify({
        isComplete: true,
        reply: "已根据您提供的关键信息完成极速分诊。",
        summary:
          "年龄/性别：36岁 / 男\n核心症状与部位：胸闷\n发病时间与急缓：2天，突然出现",
        routing: {
          possibilitySummary: "症状更偏向心血管方向，建议先看心内科。",
          recommendedDepartment: {
            zh: "心内科",
            en: "Cardiology",
            matchedSpecialtyKey: "cardiology",
          },
          hospitals: [],
        },
        extraction: {
          symptoms: "胸闷",
          duration: "2天，突然出现",
          age: 36,
          urgency: "medium",
        },
      }),
      createdAt: new Date("2026-03-18T02:02:00.000Z"),
    } as never);

    const caller = consultationRouter.createCaller(createTestContext());
    const result = await caller.getMessagesBySessionId({ sessionId: 11 });

    expect(result).toEqual({
      messages: [
        expect.objectContaining({
          id: 100,
          sessionId: 11,
          role: "user",
          content: "我今年36岁，男，我觉得胸闷",
        }),
        expect.objectContaining({
          id: 101,
          sessionId: 11,
          role: "ai",
          content: "已根据您提供的关键信息完成极速分诊。",
        }),
      ],
      summary:
        "年龄/性别：36岁 / 男\n核心症状与部位：胸闷\n发病时间与急缓：2天，突然出现",
      triageResult: expect.objectContaining({
        isComplete: true,
        reply: "已根据您提供的关键信息完成极速分诊。",
        routing: expect.objectContaining({
          recommendedDepartment: expect.objectContaining({
            zh: "心内科",
            en: "Cardiology",
          }),
        }),
      }),
    });
  });

  it("returns an empty message result for anonymous callers", async () => {
    const context = createTestContext();
    context.user = null;
    context.userId = null;
    const caller = consultationRouter.createCaller(context);

    await expect(
      caller.getMessagesBySessionId({ sessionId: 11 })
    ).resolves.toEqual({
      messages: [],
      summary: null,
      triageResult: null,
    });
    expect(aiRepo.getAiChatSessionById).not.toHaveBeenCalled();
  });

  it("does not expose another user's consultation session", async () => {
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue({
      id: 11,
      userId: 99,
      summary: null,
    } as never);
    const caller = consultationRouter.createCaller(createTestContext());

    await expect(
      caller.getMessagesBySessionId({ sessionId: 11 })
    ).resolves.toEqual({
      messages: [],
      summary: null,
      triageResult: null,
    });
    expect(aiRepo.getAiChatMessagesBySessionId).not.toHaveBeenCalled();
  });
});
