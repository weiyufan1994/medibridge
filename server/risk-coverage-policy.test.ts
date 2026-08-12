import { describe, expect, it } from "vitest";
import {
  CLEANUP_BATCHES,
  classifyHighRiskFile,
  compareCoverageExceptions,
  getLineHits,
  isApplicationSource,
  parseChangedLines,
  summarizeLines,
  validateCoveragePolicy,
} from "../scripts/risk-coverage-policy.mjs";

const validException = {
  file: "server/_core/cookies.ts",
  currentLineCoverage: 64,
  targetLineCoverage: 90,
  cleanupBatch: CLEANUP_BATCHES.auth,
};

const validPolicy = {
  changedLinesMinimum: 80,
  highRiskLinesTarget: 90,
  exceptions: [validException],
};

describe("risk coverage policy", () => {
  it("classifies every declared high-risk domain and ignores maps", () => {
    expect(classifyHighRiskFile("server/_core/cookies.ts")).toBe(
      CLEANUP_BATCHES.auth
    );
    expect(classifyHighRiskFile("server/routers/auth.ts")).toBe(
      CLEANUP_BATCHES.auth
    );
    expect(classifyHighRiskFile("server/stripeWebhookProcessor.ts")).toBe(
      CLEANUP_BATCHES.payments
    );
    expect(
      classifyHighRiskFile("server/modules/appointments/tokenValidation.ts")
    ).toBe(CLEANUP_BATCHES.appointments);
    expect(classifyHighRiskFile("server/routers/appointments.ts")).toBe(
      CLEANUP_BATCHES.appointments
    );
    expect(
      classifyHighRiskFile("server/modules/visit/realtimeGateway.ts")
    ).toBe(CLEANUP_BATCHES.appointments);
    expect(classifyHighRiskFile("server/modules/triageSafety/scan.ts")).toBe(
      CLEANUP_BATCHES.medical
    );
    expect(
      classifyHighRiskFile("server/modules/referrals/notificationWorker.ts")
    ).toBe(CLEANUP_BATCHES.workers);
    expect(
      classifyHighRiskFile("client/src/features/map/actions.ts")
    ).toBeNull();
  });

  it("limits changed-line coverage to application sources", () => {
    expect(isApplicationSource("server/modules/auth/actions.ts")).toBe(true);
    expect(isApplicationSource("client/src/App.tsx")).toBe(true);
    expect(isApplicationSource("shared/types.ts")).toBe(true);
    expect(isApplicationSource("server/example.test.ts")).toBe(false);
    expect(isApplicationSource("scripts/check-risk-coverage.mjs")).toBe(false);
  });

  it("rejects wildcard, misplaced, duplicate, and weakened exceptions", () => {
    const failures = validateCoveragePolicy({
      changedLinesMinimum: 79,
      highRiskLinesTarget: 89,
      exceptions: [
        { ...validException, file: "server/modules/auth/*.ts" },
        validException,
        { ...validException, currentLineCoverage: 90 },
        {
          ...validException,
          file: "server/modules/payments/stripe.ts",
          cleanupBatch: CLEANUP_BATCHES.auth,
        },
      ],
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        "changedLinesMinimum must be 80",
        "highRiskLinesTarget must be 90",
        "exception must use an exact server source path: server/modules/auth/*.ts",
        "duplicate exception: server/_core/cookies.ts",
        "invalid current coverage: server/_core/cookies.ts",
        "incorrect cleanup batch: server/modules/payments/stripe.ts",
      ])
    );
  });

  it("allows only removal or a higher baseline for an existing exception", () => {
    expect(compareCoverageExceptions(validPolicy, validPolicy)).toEqual([]);
    expect(
      compareCoverageExceptions(validPolicy, {
        ...validPolicy,
        exceptions: [],
      })
    ).toEqual([]);
    expect(
      compareCoverageExceptions(validPolicy, {
        ...validPolicy,
        exceptions: [{ ...validException, currentLineCoverage: 70 }],
      })
    ).toEqual([]);
    expect(
      compareCoverageExceptions(validPolicy, {
        ...validPolicy,
        exceptions: [{ ...validException, currentLineCoverage: 60 }],
      })
    ).toEqual([
      "coverage exception baseline cannot decrease: server/_core/cookies.ts",
    ]);
    expect(
      compareCoverageExceptions({ ...validPolicy, exceptions: [] }, validPolicy)
    ).toEqual(["new coverage exception is forbidden: server/_core/cookies.ts"]);
  });

  it("extracts added lines and computes executable-line coverage", () => {
    const changed = parseChangedLines(
      [
        "diff --git a/server/example.ts b/server/example.ts",
        "+++ b/server/example.ts",
        "@@ -1,0 +2,3 @@",
        "+one",
        "+two",
        "+three",
        "@@ -10 +20 @@",
        "+replacement",
      ].join("\n")
    );
    expect([...changed.get("server/example.ts")!]).toEqual([2, 3, 4, 20]);

    const lineHits = getLineHits({
      statementMap: {
        0: { start: { line: 2 } },
        1: { start: { line: 3 } },
        2: { start: { line: 3 } },
      },
      s: { 0: 1, 1: 0, 2: 2 },
    });
    expect(summarizeLines(lineHits)).toEqual({
      covered: 2,
      total: 2,
      percentage: 100,
    });
    expect(summarizeLines(lineHits, new Set([2]))).toEqual({
      covered: 1,
      total: 1,
      percentage: 100,
    });
  });
});
