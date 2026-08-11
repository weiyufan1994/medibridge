import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getAiChatSessionById: vi.fn(),
  getLatestSessionFlagByType: vi.fn(),
}));

vi.mock("./historyResult", () => ({
  TRIAGE_RESULT_FLAG_TYPE: "triage_result_v1",
  parseStoredHistoricalTriageResult: vi.fn(),
  rebuildHistoricalTriageResultFromSummary: vi.fn(),
}));

import {
  parseStoredHistoricalTriageResult,
  rebuildHistoricalTriageResultFromSummary,
} from "./historyResult";
import { getHistoricalTriageResultForUser } from "./historicalTriageAccessActions";
import * as repo from "./repo";

describe("historical triage access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not read result flags for a missing or unowned session", async () => {
    vi.mocked(repo.getAiChatSessionById).mockResolvedValue({
      id: 77,
      userId: 999,
    } as never);

    await expect(
      getHistoricalTriageResultForUser({ sessionId: 77, userId: 501 })
    ).resolves.toBeNull();
    expect(repo.getLatestSessionFlagByType).not.toHaveBeenCalled();
  });

  it("returns the stored structured result without rebuilding", async () => {
    const session = { id: 77, userId: 501, summary: "summary" };
    const triageResult = { isComplete: true, reply: "stored" };
    vi.mocked(repo.getAiChatSessionById).mockResolvedValue(session as never);
    vi.mocked(repo.getLatestSessionFlagByType).mockResolvedValue({
      flagValue: "stored-json",
    } as never);
    vi.mocked(parseStoredHistoricalTriageResult).mockReturnValue(
      triageResult as never
    );

    await expect(
      getHistoricalTriageResultForUser({ sessionId: 77, userId: 501 })
    ).resolves.toEqual({ session, triageResult });
    expect(repo.getLatestSessionFlagByType).toHaveBeenCalledWith(
      77,
      "triage_result_v1"
    );
    expect(rebuildHistoricalTriageResultFromSummary).not.toHaveBeenCalled();
  });

  it("rebuilds from the summary when no stored result can be parsed", async () => {
    const session = { id: 77, userId: 501, summary: "legacy summary" };
    const rebuilt = { isComplete: true, reply: "rebuilt" };
    vi.mocked(repo.getAiChatSessionById).mockResolvedValue(session as never);
    vi.mocked(repo.getLatestSessionFlagByType).mockResolvedValue(null as never);
    vi.mocked(parseStoredHistoricalTriageResult).mockReturnValue(null);
    vi.mocked(rebuildHistoricalTriageResultFromSummary).mockResolvedValue(
      rebuilt as never
    );

    await expect(
      getHistoricalTriageResultForUser({ sessionId: 77, userId: 501 })
    ).resolves.toEqual({ session, triageResult: rebuilt });
    expect(rebuildHistoricalTriageResultFromSummary).toHaveBeenCalledWith(
      "legacy summary"
    );
  });
});
