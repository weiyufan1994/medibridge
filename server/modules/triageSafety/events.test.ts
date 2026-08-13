import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "../../db";
import {
  clearSessionFlagsByType,
  recordRiskEvents,
  setSessionFlag,
} from "./events";

vi.mock("../../db", () => ({ getDb: vi.fn() }));

const baseScanResult = {
  matchedRiskCodes: ["CHEST_PAIN_BREATHING", "SEVERE_BLEEDING"],
  highestSeverity: "critical" as const,
  shouldInterrupt: true,
  recommendedAction: "go_to_er" as const,
  displayMessage: { zh: "立即就医", en: "Seek care now" },
  triggerSource: "rule" as const,
  rawExcerpt: "redacted excerpt",
};

describe("triage safety event persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips risk events when storage is unavailable or no rules match", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    await recordRiskEvents({
      sessionId: 10,
      messageId: 20,
      scanResult: baseScanResult,
    });

    const insert = vi.fn();
    vi.mocked(getDb).mockResolvedValueOnce({ insert } as never);
    await recordRiskEvents({
      sessionId: 10,
      scanResult: { ...baseScanResult, matchedRiskCodes: [] },
    });

    expect(insert).not.toHaveBeenCalled();
  });

  it("persists one auditable row per matched risk code", async () => {
    const values = vi.fn(async () => undefined);
    const insert = vi.fn(() => ({ values }));
    vi.mocked(getDb).mockResolvedValue({ insert } as never);

    await recordRiskEvents({
      sessionId: 11,
      messageId: 21,
      scanResult: baseScanResult,
    });

    expect(values).toHaveBeenCalledWith([
      {
        sessionId: 11,
        messageId: 21,
        riskCode: "CHEST_PAIN_BREATHING",
        severity: "critical",
        recommendedAction: "go_to_er",
        triggerSource: "rule",
        rawExcerpt: "redacted excerpt",
      },
      {
        sessionId: 11,
        messageId: 21,
        riskCode: "SEVERE_BLEEDING",
        severity: "critical",
        recommendedAction: "go_to_er",
        triggerSource: "rule",
        rawExcerpt: "redacted excerpt",
      },
    ]);
  });

  it("uses safe persistence defaults for optional scan metadata", async () => {
    const values = vi.fn(async () => undefined);
    vi.mocked(getDb).mockResolvedValue({
      insert: vi.fn(() => ({ values })),
    } as never);

    await recordRiskEvents({
      sessionId: 12,
      scanResult: {
        ...baseScanResult,
        matchedRiskCodes: ["UNKNOWN_RISK"],
        highestSeverity: null,
        recommendedAction: null,
      },
    });

    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        sessionId: 12,
        messageId: null,
        riskCode: "UNKNOWN_RISK",
        severity: "high",
        recommendedAction: "seek_urgent_care",
      }),
    ]);
  });

  it("skips or persists a session flag according to storage availability", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    await setSessionFlag({
      sessionId: 13,
      flagType: "interrupted",
      flagValue: "value",
    });

    const values = vi.fn(async () => undefined);
    vi.mocked(getDb).mockResolvedValueOnce({
      insert: vi.fn(() => ({ values })),
    } as never);
    await setSessionFlag({
      sessionId: 13,
      flagType: "interrupted",
      flagValue: "value",
    });

    expect(values).toHaveBeenCalledWith({
      sessionId: 13,
      flagType: "interrupted",
      flagValue: "value",
    });
  });

  it("skips or clears matching session flags according to storage availability", async () => {
    vi.mocked(getDb).mockResolvedValueOnce(null);
    await clearSessionFlagsByType(14, "triage_result_v1");

    const where = vi.fn(async () => undefined);
    const deleteRows = vi.fn(() => ({ where }));
    vi.mocked(getDb).mockResolvedValueOnce({ delete: deleteRows } as never);
    await clearSessionFlagsByType(14, "triage_result_v1");

    expect(deleteRows).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
