import { describe, expect, it } from "vitest";
import { parseOptionalNonNegativeInteger } from "@/features/admin/hooks/useAdminConsole";

describe("parseOptionalNonNegativeInteger", () => {
  it("returns undefined for empty or whitespace input", () => {
    expect(parseOptionalNonNegativeInteger("")).toBeUndefined();
    expect(parseOptionalNonNegativeInteger("   ")).toBeUndefined();
  });

  it("parses valid non-negative integers", () => {
    expect(parseOptionalNonNegativeInteger("0")).toBe(0);
    expect(parseOptionalNonNegativeInteger(" 42 ")).toBe(42);
  });

  it("returns undefined for invalid values", () => {
    expect(parseOptionalNonNegativeInteger("-1")).toBeUndefined();
    expect(parseOptionalNonNegativeInteger("1.5")).toBeUndefined();
    expect(parseOptionalNonNegativeInteger("abc")).toBeUndefined();
  });
});
