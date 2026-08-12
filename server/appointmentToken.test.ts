import { describe, expect, it } from "vitest";
import {
  generateToken,
  hashToken,
  verifyToken,
} from "./_core/appointmentToken";

describe("appointment token utils", () => {
  it("generates high-entropy token and verifies hash", () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(40);

    const tokenHash = hashToken(token);
    expect(tokenHash).toHaveLength(64);

    expect(verifyToken(token, tokenHash)).toBe(true);
    expect(verifyToken(`${token}_wrong`, tokenHash)).toBe(false);
  });

  it("rejects a malformed hash without attempting a timing comparison", () => {
    expect(verifyToken("appointment-token", "too-short")).toBe(false);
  });

  it("hashes the exact UTF-8 token value", () => {
    expect(hashToken("预约-token")).toBe(
      "1d989bd26b43acb13a3bc8be34594605ed00b78797ecf17b5dff04e3a1d9e552"
    );
  });
});
