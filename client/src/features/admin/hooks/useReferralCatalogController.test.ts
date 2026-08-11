import { describe, expect, it } from "vitest";
import { splitReferralCatalogListInput } from "./useReferralCatalogController";

describe("splitReferralCatalogListInput", () => {
  it("trims entries and removes empty values", () => {
    expect(splitReferralCatalogListInput(" zh, en, , cantonese ")).toEqual([
      "zh",
      "en",
      "cantonese",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(splitReferralCatalogListInput(" ,  , ")).toEqual([]);
  });
});
