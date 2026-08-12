import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VISIT_CHAT_TOKEN_PURPOSE,
  VISIT_CHAT_TOKEN_TTL_SECONDS,
  issueVisitChatToken,
  verifyVisitChatToken,
} from "./visitChatToken";

const signingSecret = "visit-chat-test-secret-at-least-32-bytes";
const baseNow = new Date("2026-08-13T00:00:00.000Z");

async function signClaims(
  claims: Record<string, unknown>,
  options: {
    issuer?: string;
    audience?: string;
    issuedAt?: number;
    expiresAt?: number;
  } = {}
) {
  const issuedAt = options.issuedAt ?? Math.floor(baseNow.getTime() / 1000);
  const expiresAt =
    options.expiresAt ?? issuedAt + VISIT_CHAT_TOKEN_TTL_SECONDS;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(options.issuer ?? "medibridge")
    .setAudience(options.audience ?? "medibridge-visit-chat")
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(new TextEncoder().encode(signingSecret));
}

describe("visit chat token cryptographic contract", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", signingSecret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues a short-lived, purpose-scoped appointment and role token", async () => {
    const result = await issueVisitChatToken({
      appointmentId: 42,
      actorRole: "doctor",
      sourceTokenId: 9,
      sourceExpiresAt: new Date(baseNow.getTime() + 24 * 60 * 60 * 1000),
      now: baseNow,
    });

    const verified = await verifyVisitChatToken(result.token, baseNow);
    expect(verified).toEqual({
      ok: true,
      claims: {
        appointmentId: 42,
        actorRole: "doctor",
        sourceTokenId: 9,
        purpose: VISIT_CHAT_TOKEN_PURPOSE,
        issuedAt: baseNow,
        expiresAt: new Date(
          baseNow.getTime() + VISIT_CHAT_TOKEN_TTL_SECONDS * 1000
        ),
      },
    });
  });

  it("never outlives the source appointment token", async () => {
    const sourceExpiresAt = new Date(baseNow.getTime() + 90_000);
    const result = await issueVisitChatToken({
      appointmentId: 42,
      actorRole: "patient",
      sourceTokenId: 10,
      sourceExpiresAt,
      now: baseNow,
    });

    expect(result.expiresAt).toEqual(sourceExpiresAt);
    await expect(
      verifyVisitChatToken(
        result.token,
        new Date(sourceExpiresAt.getTime() + 1)
      )
    ).resolves.toEqual({ ok: false, reason: "TOKEN_EXPIRED" });
  });

  it("rejects expired and tampered tokens", async () => {
    const result = await issueVisitChatToken({
      appointmentId: 42,
      actorRole: "patient",
      sourceTokenId: 10,
      sourceExpiresAt: new Date(baseNow.getTime() + 24 * 60 * 60 * 1000),
      now: baseNow,
    });
    const tampered = `${result.token.slice(0, -1)}${
      result.token.endsWith("a") ? "b" : "a"
    }`;

    await expect(
      verifyVisitChatToken(
        result.token,
        new Date(baseNow.getTime() + VISIT_CHAT_TOKEN_TTL_SECONDS * 1000 + 1)
      )
    ).resolves.toEqual({ ok: false, reason: "TOKEN_EXPIRED" });
    await expect(verifyVisitChatToken(tampered, baseNow)).resolves.toEqual({
      ok: false,
      reason: "TOKEN_INVALID",
    });
  });

  it.each([
    {
      name: "wrong purpose",
      claims: {
        appointmentId: 42,
        actorRole: "patient",
        sourceTokenId: 10,
        purpose: "appointment_access",
      },
    },
    {
      name: "wrong role",
      claims: {
        appointmentId: 42,
        actorRole: "admin",
        sourceTokenId: 10,
        purpose: VISIT_CHAT_TOKEN_PURPOSE,
      },
    },
    {
      name: "missing source binding",
      claims: {
        appointmentId: 42,
        actorRole: "patient",
        purpose: VISIT_CHAT_TOKEN_PURPOSE,
      },
    },
  ])("rejects $name claims", async ({ claims }) => {
    const token = await signClaims(claims);
    await expect(verifyVisitChatToken(token, baseNow)).resolves.toEqual({
      ok: false,
      reason: "TOKEN_INVALID",
    });
  });

  it("rejects tokens with the wrong issuer, audience, or excessive TTL", async () => {
    const claims = {
      appointmentId: 42,
      actorRole: "patient",
      sourceTokenId: 10,
      purpose: VISIT_CHAT_TOKEN_PURPOSE,
    };
    const issuedAt = Math.floor(baseNow.getTime() / 1000);
    const [wrongIssuer, wrongAudience, excessiveTtl] = await Promise.all([
      signClaims(claims, { issuer: "other-service" }),
      signClaims(claims, { audience: "other-audience" }),
      signClaims(claims, {
        issuedAt,
        expiresAt: issuedAt + VISIT_CHAT_TOKEN_TTL_SECONDS + 1,
      }),
    ]);

    for (const token of [wrongIssuer, wrongAudience, excessiveTtl]) {
      await expect(verifyVisitChatToken(token, baseNow)).resolves.toEqual({
        ok: false,
        reason: "TOKEN_INVALID",
      });
    }
  });

  it("fails closed when the existing signing secret is unavailable", async () => {
    vi.stubEnv("JWT_SECRET", "");
    await expect(
      issueVisitChatToken({
        appointmentId: 42,
        actorRole: "patient",
        sourceTokenId: 10,
        sourceExpiresAt: new Date(baseNow.getTime() + 60_000),
        now: baseNow,
      })
    ).rejects.toThrow("VISIT_CHAT_TOKEN_SECRET_MISSING");
    await expect(verifyVisitChatToken("not-a-token", baseNow)).resolves.toEqual(
      {
        ok: false,
        reason: "TOKEN_INVALID",
      }
    );
  });
});
