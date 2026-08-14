import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
) as { scripts?: { dev?: string } };

describe("local development auth runtime", () => {
  it("marks pnpm dev as local development", () => {
    expect(packageJson.scripts?.dev).toContain(
      "MEDIBRIDGE_RELEASE_CHANNEL=local"
    );
    expect(packageJson.scripts?.dev).toContain("NODE_ENV=development");
  });
});
