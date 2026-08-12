import { describe, expect, it, vi } from "vitest";
import { translateDoctors } from "../scripts/translate-bilingual-doctors";

const createEmptyDb = () => {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue([]),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return {
    db: { select: vi.fn(() => chain) } as never,
    chain,
  };
};

const config = {
  batchSize: 10,
  llmBatchSize: 5,
  concurrency: 1,
  cacheEnabled: true,
  maxRetries: 0,
  rateLimitMs: 0,
  apiCallsLogInterval: 100,
} as never;

describe("bilingual doctor translation workflow", () => {
  it("returns an empty run without invoking translation adapters", async () => {
    const { db, chain } = createEmptyDb();

    const stats = await translateDoctors(
      db,
      config,
      "translation-model",
      "translation-provider"
    );

    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(stats).toMatchObject({
      entity: "doctors",
      batches: 0,
      scanned: 0,
      attempted: 0,
    });
  });
});
