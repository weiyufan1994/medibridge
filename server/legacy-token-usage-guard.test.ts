import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SERVER_ROOT = path.resolve(__dirname);
const RUNTIME_TS_FILE = /\.ts$/;

function listRuntimeFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRuntimeFiles(abs));
      continue;
    }
    if (!RUNTIME_TS_FILE.test(entry.name)) {
      continue;
    }
    if (entry.name.endsWith(".test.ts")) {
      continue;
    }
    files.push(abs);
  }

  return files;
}

describe("legacy appointment token usage guard", () => {
  it("does not allow runtime reads from deprecated appointment token columns", () => {
    const files = listRuntimeFiles(SERVER_ROOT);
    const forbiddenPatterns = [
      /verifyToken\([^\n]*appointment\.(accessTokenHash|doctorTokenHash)\)/,
      /getAppointmentByAccessTokenHash\(/,
      /appointment\.(accessTokenHash|doctorTokenHash|accessTokenExpiresAt|accessTokenRevokedAt|doctorTokenRevokedAt)\b/,
    ];

    const violations: Array<{ file: string; pattern: string }> = [];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(source)) {
          violations.push({
            file: path.relative(path.resolve(__dirname, ".."), file),
            pattern: String(pattern),
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
