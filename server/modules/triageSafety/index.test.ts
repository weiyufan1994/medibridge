import { describe, expect, it } from "vitest";
import * as triageSafety from "./index";

describe("triage safety module exports", () => {
  it("keeps the documented safety capabilities available", () => {
    expect(Object.keys(triageSafety).sort()).toEqual([
      "DEFAULT_TRIAGE_RISK_RULES",
      "clearSessionFlagsByType",
      "recordRiskEvents",
      "scanMessage",
      "setSessionFlag",
    ]);
  });
});
