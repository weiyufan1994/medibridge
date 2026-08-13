import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  sendMessageAction: vi.fn(),
}));

vi.mock("./modules/ai/routerApi", async () => {
  const { z } = await import("zod");
  return {
    aiActions: {
      chatTriageAction: vi.fn(),
      createSessionAction: vi.fn(),
      getUsageSummaryAction: vi.fn(),
      listMySessionsAction: vi.fn(),
      sendMessageAction: actions.sendMessageAction,
    },
    aiSchemas: {
      chatTriageInputSchema: z.any(),
      createSessionInputSchema: z.any(),
      listMySessionsInputSchema: z.any(),
      sendMessageInputSchema: z.any(),
    },
  };
});

import { aiRouter } from "./routers/ai";

const requestMetadata = {
  requestId: "triage-router-request",
  clientIp: "203.0.113.10",
  userAgent: "vitest",
};
const user = { id: 7, role: "free" };

describe("ai router request metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.sendMessageAction.mockResolvedValue({
      isComplete: false,
      reply: "safe reply",
      sessionStatus: "active",
      hitMessageLimit: false,
    });
  });

  it("passes request metadata to safety-sensitive message handling", async () => {
    const caller = aiRouter.createCaller({
      user,
      requestMetadata,
      req: { headers: {} },
      res: {},
    } as never);
    const input = { sessionId: 10, content: "symptoms", lang: "en" } as const;

    await caller.sendMessage(input);

    expect(actions.sendMessageAction).toHaveBeenCalledWith(
      input,
      user,
      requestMetadata
    );
  });
});
