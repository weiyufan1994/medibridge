import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_CACHE_ENABLED,
  computeSourceHash,
  missingTranslatedFields,
  normalizeSourceText,
  parseArgs,
  pickEnglish,
  readMessageText,
  sanitizeTranslatedText,
} from "../scripts/translate-bilingual-core";
import {
  createEntityRunStats,
  createWorkerPool,
  recordFailure,
  splitToChunks,
  withRetry,
} from "../scripts/translate-bilingual-runtime";

const originalTranslationModel = process.env.TRANSLATION_LLM_MODEL;

afterEach(() => {
  process.env.TRANSLATION_LLM_MODEL = originalTranslationModel;
});

describe("bilingual translation core", () => {
  it("parses CLI values while preserving defaults and model precedence", () => {
    process.env.TRANSLATION_LLM_MODEL = "env-model";
    expect(parseArgs([])).toMatchObject({
      entities: ["hospitals", "departments", "doctors"],
      batchSize: DEFAULT_BATCH_SIZE,
      cacheEnabled: DEFAULT_CACHE_ENABLED,
      translationModel: "env-model",
    });
    expect(
      parseArgs([
        "--entities=hospitals,doctors",
        "--batchSize=5",
        "--cacheEnabled=false",
        "--model=cli-model",
      ])
    ).toMatchObject({
      entities: ["hospitals", "doctors"],
      batchSize: 5,
      cacheEnabled: false,
      translationModel: "cli-model",
    });
  });

  it("normalizes empty markers and computes stable source hashes", () => {
    expect(normalizeSourceText(" 暂无 ")).toBeNull();
    expect(normalizeSourceText(" value ")).toBe("value");
    expect(computeSourceHash({ value: " data " })).toBe(
      computeSourceHash({ value: "data" })
    );
  });

  it("selects valid English values and counts only required missing fields", () => {
    expect(pickEnglish("Existing", "Translated")).toBe("Existing");
    expect(pickEnglish("中文", "Translated")).toBe("Translated");
    expect(pickEnglish("中文", "翻译")).toBeNull();
    expect(
      missingTranslatedFields([
        { source: "姓名", translated: "Name" },
        { source: "简介", translated: null },
        { source: null, translated: null },
      ])
    ).toBe(1);
  });

  it("reads supported LLM content shapes and rejects placeholder translations", () => {
    expect(readMessageText(["one", { text: "two" }])).toBe("one\ntwo");
    expect(readMessageText({ text: "value" })).toBe("value");
    expect(sanitizeTranslatedText("  translated  ")).toBe("translated");
    expect(sanitizeTranslatedText("not specified")).toBeNull();
  });

  it("preserves chunking, worker concurrency, retry, and failure accounting", async () => {
    expect(splitToChunks([1, 2, 3], 2)).toEqual([[1, 2], [3]]);

    const handled: number[] = [];
    await createWorkerPool([1, 2, 3], 2, async item => {
      handled.push(item);
    });
    expect(handled.sort()).toEqual([1, 2, 3]);

    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("retry");
        return "ok";
      }, 1)
    ).resolves.toBe("ok");
    expect(attempts).toBe(2);

    const stats = createEntityRunStats("hospitals", parseArgs([]));
    recordFailure(stats, new Error("failure"));
    expect(stats.failed).toBe(1);
    expect(stats.errorCounts.get("failure")).toBe(1);
  });
});
