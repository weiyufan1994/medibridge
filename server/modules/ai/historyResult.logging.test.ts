import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./hospitalRouting", () => ({
  buildHospitalRouting: vi.fn(),
}));

import { buildHospitalRouting } from "./hospitalRouting";
import { rebuildHistoricalTriageResultFromSummary } from "./historyResult";

describe("historical triage result logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("omits the medical summary from routing failure logs", async () => {
    vi.mocked(buildHospitalRouting).mockRejectedValue(
      new Error("private routing detail")
    );
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const summary = [
      "年龄/性别：36岁 / 男",
      "核心症状与部位：private symptom narrative",
      "发病时间与急缓：2天",
    ].join("；");

    const result = await rebuildHistoricalTriageResultFromSummary(summary);

    expect(result).toMatchObject({ isComplete: true, summary });
    expect(result?.routing).toBeUndefined();
    const serialized = String(consoleWarn.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "ai-triage-history",
      event: "routing_rebuild_failed",
      lang: "zh",
      errorName: "Error",
    });
    expect(serialized).not.toContain("private symptom narrative");
    expect(serialized).not.toContain("private routing detail");
  });
});
