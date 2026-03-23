import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./modules/ai/repo", () => ({
  listAiChatSessionsByUser: vi.fn(),
  listFirstUserMessagesBySessionIds: vi.fn(),
  getAiChatSessionById: vi.fn(),
  getAiChatMessagesBySessionId: vi.fn(),
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
});
