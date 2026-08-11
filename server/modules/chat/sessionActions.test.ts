import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../visit/publicApi", () => ({
  visitChatSessionApi: {
    getSession: vi.fn(),
    upsertSession: vi.fn(),
  },
}));

import { visitChatSessionApi as sessions } from "../visit/publicApi";
import { getSessionAction } from "./actions";

describe("chat session actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the session does not exist", async () => {
    vi.mocked(sessions.getSession).mockResolvedValue(null as never);

    await expect(
      getSessionAction({ sessionId: "missing-session" })
    ).resolves.toBeNull();
  });

  it("deserializes persisted chat history and recommendations", async () => {
    vi.mocked(sessions.getSession).mockResolvedValue({
      sessionId: "session-1",
      chatHistory: JSON.stringify([{ role: "user", content: "hello" }]),
      recommendedDoctors: JSON.stringify([
        { doctorId: 17, reason: "specialty match" },
      ]),
    } as never);

    await expect(
      getSessionAction({ sessionId: "session-1" })
    ).resolves.toMatchObject({
      sessionId: "session-1",
      chatHistory: [{ role: "user", content: "hello" }],
      recommendedDoctors: [{ doctorId: 17, reason: "specialty match" }],
    });
    expect(sessions.getSession).toHaveBeenCalledWith("session-1");
  });
});
