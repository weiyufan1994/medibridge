import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  createAiChatSession: vi.fn(),
  getAiChatSessionById: vi.fn(),
  listAiChatSessionsForAdmin: vi.fn(),
  listLatestKnowledgeFlagsForAdmin: vi.fn(),
  listTriageRiskEventsForAdmin: vi.fn(),
}));

import { aiTriageSessionApi } from "./publicApi";
import * as repo from "./repo";

describe("aiTriageSessionApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a triage session for the requested user", async () => {
    vi.mocked(repo.createAiChatSession).mockResolvedValue(71);

    await expect(aiTriageSessionApi.createForUser(19)).resolves.toBe(71);
    expect(repo.createAiChatSession).toHaveBeenCalledWith(19);
  });

  it("returns a project-owned snapshot for an existing session", async () => {
    vi.mocked(repo.getAiChatSessionById).mockResolvedValue({
      id: 71,
      userId: 19,
      status: "completed",
      summary: "Triage summary",
      summaryGeneratedAt: new Date("2026-08-09T00:00:00.000Z"),
      createdAt: new Date("2026-08-09T00:00:00.000Z"),
      updatedAt: new Date("2026-08-09T00:01:00.000Z"),
    });

    await expect(aiTriageSessionApi.getById(71)).resolves.toEqual({
      id: 71,
      userId: 19,
      status: "completed",
      summary: "Triage summary",
    });
    expect(repo.getAiChatSessionById).toHaveBeenCalledWith(71);
  });

  it("preserves a missing session result", async () => {
    vi.mocked(repo.getAiChatSessionById).mockResolvedValue(null);

    await expect(aiTriageSessionApi.getById(404)).resolves.toBeNull();
  });
});
