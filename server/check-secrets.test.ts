import { describe, expect, it } from "vitest";
import { collectFileViolations } from "../scripts/check-secrets.mjs";

describe("secret gate retired map capability", () => {
  it("rejects the retired adapter path", () => {
    expect(
      collectFileViolations(
        "server/_core/map.ts",
        "export const unused = true;"
      )
    ).toEqual(["server/_core/map.ts: retired map capability"]);
  });

  it("rejects former map proxy markers in source files", () => {
    const marker = ["", "v1", "maps", "proxy"].join("/");

    expect(
      collectFileViolations(
        "server/newAdapter.ts",
        `const endpoint = ${marker};`
      )
    ).toEqual(["server/newAdapter.ts: retired map capability marker"]);
  });

  it("does not scan prose for implementation markers", () => {
    const marker = ["", "api", "maps", "script"].join("/");

    expect(
      collectFileViolations("docs/adr/example.md", `Retired: ${marker}`)
    ).toEqual([]);
  });
});
