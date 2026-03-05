import { beforeEach, describe, expect, it } from "vitest";
import { clearMetricsForTests, incrementMetric } from "./_core/metrics";
import { systemRouter } from "./_core/systemRouter";

describe("system.metrics", () => {
  beforeEach(() => {
    clearMetricsForTests();
  });

  it("returns current metric counters for admin callers", async () => {
    incrementMetric("test_counter_total");
    incrementMetric("test_counter_total");
    incrementMetric("test_tagged_total", { reason: "sample" });

    const caller = systemRouter.createCaller({
      user: {
        id: 1,
        role: "pro",
      } as never,
    } as never);

    const result = await caller.metrics();

    expect(result.generatedAt).toBeTypeOf("string");
    expect(result.counters).toEqual(
      expect.arrayContaining([
        { key: "test_counter_total", value: 2 },
        { key: "test_tagged_total{reason=sample}", value: 1 },
      ])
    );
  });
});
