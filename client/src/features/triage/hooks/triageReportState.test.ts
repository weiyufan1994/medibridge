import { describe, expect, it } from "vitest";
import { shouldLockInputForReportGeneration } from "@/features/triage/hooks/triageReportState";

describe("triageReportState", () => {
  it("locks input when latest assistant message indicates report generation", () => {
    const shouldLock = shouldLockInputForReportGeneration({
      triageResult: { isComplete: false },
      messages: [
        { role: "assistant", content: "我们将为您生成分诊报告，请稍等。" },
      ],
    });

    expect(shouldLock).toBe(true);
  });

  it("locks input when assistant starts organizing triage details before final suggestion", () => {
    const shouldLock = shouldLockInputForReportGeneration({
      triageResult: { isComplete: false },
      messages: [
        {
          role: "assistant",
          content: "我现在为您整理分诊信息，稍后请留意最后的分诊建议。",
        },
      ],
    });

    expect(shouldLock).toBe(true);
  });

  it("does not lock input once triage is complete", () => {
    const shouldLock = shouldLockInputForReportGeneration({
      triageResult: { isComplete: true },
      messages: [
        { role: "assistant", content: "我们将为您生成分诊报告，请稍等。" },
      ],
    });

    expect(shouldLock).toBe(false);
  });

  it("does not lock input for ordinary follow-up questions", () => {
    const shouldLock = shouldLockInputForReportGeneration({
      triageResult: { isComplete: false },
      messages: [
        { role: "assistant", content: "请补充症状持续多久？" },
      ],
    });

    expect(shouldLock).toBe(false);
  });
});
