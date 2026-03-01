import crypto from "crypto";

const TOKEN_SIZE_BYTES = 32;

export function generateToken(): string {
  return crypto.randomBytes(TOKEN_SIZE_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyToken(token: string, tokenHash: string): boolean {
  const computedHash = hashToken(token);

  const expected = Buffer.from(tokenHash, "utf8");
  const actual = Buffer.from(computedHash, "utf8");

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}
