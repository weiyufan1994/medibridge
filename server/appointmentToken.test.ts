import { describe, expect, it } from "vitest";
import { generateToken, hashToken, verifyToken } from "./_core/appointmentToken";

describe("appointment token utils", () => {
  it("generates high-entropy token and verifies hash", () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(40);

    const tokenHash = hashToken(token);
    expect(tokenHash).toHaveLength(64);

    expect(verifyToken(token, tokenHash)).toBe(true);
    expect(verifyToken(`${token}_wrong`, tokenHash)).toBe(false);
  });
});
