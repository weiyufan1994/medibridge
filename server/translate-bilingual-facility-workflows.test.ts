import { describe, expect, it, vi } from "vitest";
import { translateDepartments } from "../scripts/translate-bilingual-departments";
import { translateHospitals } from "../scripts/translate-bilingual-hospitals";

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

describe("bilingual facility translation workflows", () => {
  it("returns an empty hospital run without invoking adapters", async () => {
    const { db, chain } = createEmptyDb();

    const stats = await translateHospitals(
      db,
      config,
      "translation-model",
      "translation-provider"
    );

    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(stats).toMatchObject({
      entity: "hospitals",
      batches: 0,
      scanned: 0,
      attempted: 0,
    });
  });

  it("returns an empty department run without invoking adapters", async () => {
    const { db, chain } = createEmptyDb();

    const stats = await translateDepartments(
      db,
      config,
      "translation-model",
      "translation-provider"
    );

    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(stats).toMatchObject({
      entity: "departments",
      batches: 0,
      scanned: 0,
      attempted: 0,
    });
  });
});
