import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSLATION_PROVIDER,
  hasCjk,
  pickEnglish,
  readMessageText,
  requireDatabaseUrl,
  resolveTranslationModel,
  sanitizeTranslatedText,
  splitToChunks,
} from "../scripts/translate-triage-hospital-reference-helpers";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalTranslationModel = process.env.TRANSLATION_LLM_MODEL;
const originalLlmModel = process.env.LLM_MODEL;

afterEach(() => {
  process.env.DATABASE_URL = originalDatabaseUrl;
  process.env.TRANSLATION_LLM_MODEL = originalTranslationModel;
  process.env.LLM_MODEL = originalLlmModel;
});

describe("triage hospital reference translation helpers", () => {
  it("prefers an existing English value and rejects CJK fallbacks", () => {
    expect(hasCjk("上海")).toBe(true);
    expect(hasCjk("Shanghai")).toBe(false);
    expect(pickEnglish(" Existing ", "Translated")).toBe("Existing");
    expect(pickEnglish("上海", " Shanghai ")).toBe("Shanghai");
    expect(pickEnglish("上海", "北京")).toBeNull();
  });

  it("sanitizes scalar translation values without accepting objects", () => {
    expect(sanitizeTranslatedText("  Shanghai  ")).toBe("Shanghai");
    expect(sanitizeTranslatedText("   ")).toBeNull();
    expect(sanitizeTranslatedText(12)).toBe("12");
    expect(sanitizeTranslatedText(false)).toBe("false");
    expect(sanitizeTranslatedText({ text: "Shanghai" })).toBeNull();
  });

  it("normalizes chunk sizes to at least one item", () => {
    expect(splitToChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitToChunks([1, 2], 0)).toEqual([[1], [2]]);
  });

  it("reads text from string, array, and object LLM content shapes", () => {
    expect(readMessageText("plain")).toBe("plain");
    expect(readMessageText(["first", { text: "second" }])).toBe(
      "first\nsecond"
    );
    expect(readMessageText({ text: "object" })).toBe("object");
    expect(readMessageText({ unknown: true })).toBe("");
  });

  it("preserves environment precedence and required database validation", () => {
    delete process.env.TRANSLATION_LLM_MODEL;
    delete process.env.LLM_MODEL;
    expect(resolveTranslationModel()).toBe(DEFAULT_TRANSLATION_PROVIDER);

    process.env.LLM_MODEL = "fallback-model";
    expect(resolveTranslationModel()).toBe("fallback-model");
    process.env.TRANSLATION_LLM_MODEL = "translation-model";
    expect(resolveTranslationModel()).toBe("translation-model");

    delete process.env.DATABASE_URL;
    expect(() => requireDatabaseUrl()).toThrow("DATABASE_URL is required");
    process.env.DATABASE_URL = "postgres://example.test/medibridge";
    expect(requireDatabaseUrl()).toBe("postgres://example.test/medibridge");
  });
});
