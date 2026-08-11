import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../admin/publicApi", () => ({
  adminStaffDirectoryApi: {
    listAssignableStaff: vi.fn(),
  },
}));

vi.mock("../ai/publicApi", () => ({
  aiHistoricalTriageApi: {
    getForUser: vi.fn(),
  },
}));

import { adminStaffDirectoryApi } from "../admin/publicApi";
import { aiHistoricalTriageApi } from "../ai/publicApi";
import {
  getTriageRecommendationsAction,
  listAssignableAgentsAction,
} from "./actions";

describe("referral cross-module actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves the forbidden error when a triage session is not owned", async () => {
    vi.mocked(aiHistoricalTriageApi.getForUser).mockResolvedValue(null);

    await expect(
      getTriageRecommendationsAction({ id: 501 } as never, {
        triageSessionId: 77,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Triage session not found",
    });
    expect(aiHistoricalTriageApi.getForUser).toHaveBeenCalledWith({
      sessionId: 77,
      userId: 501,
    });
  });

  it("returns the admin module's assignable staff projection", async () => {
    const staff = [
      {
        id: 1,
        email: "ops@example.com",
        name: "Ops",
        role: "ops",
      },
    ];
    vi.mocked(adminStaffDirectoryApi.listAssignableStaff).mockResolvedValue(
      staff as never
    );

    await expect(listAssignableAgentsAction()).resolves.toEqual(staff);
  });
});
