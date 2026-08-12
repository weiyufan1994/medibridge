import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

describe("tRPC token transport hardening", () => {
  it("keeps client POST override and server support enabled together", () => {
    const clientSource = fs.readFileSync(
      path.join(repositoryRoot, "client/src/main.tsx"),
      "utf8"
    );
    const serverSource = fs.readFileSync(
      path.join(repositoryRoot, "server/_core/index.ts"),
      "utf8"
    );

    expect(clientSource).toMatch(/methodOverride:\s*["']POST["']/);
    expect(serverSource).toMatch(/allowMethodOverride:\s*true/);
  });
});
