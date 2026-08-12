import { SignJWT, errors, jwtVerify } from "jose";

export const VISIT_CHAT_TOKEN_PURPOSE = "visit_chat" as const;
export const VISIT_CHAT_TOKEN_TTL_SECONDS = 10 * 60;

const VISIT_CHAT_TOKEN_ISSUER = "medibridge";
const VISIT_CHAT_TOKEN_AUDIENCE = "medibridge-visit-chat";

export type VisitChatTokenClaims = {
  appointmentId: number;
  actorRole: "patient" | "doctor";
  sourceTokenId: number;
  purpose: typeof VISIT_CHAT_TOKEN_PURPOSE;
  issuedAt: Date;
  expiresAt: Date;
};

export type VisitChatTokenVerification =
  | { ok: true; claims: VisitChatTokenClaims }
  | { ok: false; reason: "TOKEN_EXPIRED" | "TOKEN_INVALID" };

function getSigningKey() {
  const secret = (process.env.JWT_SECRET ?? "").trim();
  if (!secret) {
    throw new Error("VISIT_CHAT_TOKEN_SECRET_MISSING");
  }
  return new TextEncoder().encode(secret);
}

function toEpochSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function isActorRole(value: unknown): value is "patient" | "doctor" {
  return value === "patient" || value === "doctor";
}

export async function issueVisitChatToken(input: {
  appointmentId: number;
  actorRole: "patient" | "doctor";
  sourceTokenId: number;
  sourceExpiresAt: Date;
  now?: Date;
}) {
  const issuedAt = input.now ?? new Date();
  const shortExpiry = new Date(
    issuedAt.getTime() + VISIT_CHAT_TOKEN_TTL_SECONDS * 1000
  );
  const requestedExpiresAt = new Date(
    Math.min(shortExpiry.getTime(), input.sourceExpiresAt.getTime())
  );
  const expiresAt = new Date(toEpochSeconds(requestedExpiresAt) * 1000);
  if (expiresAt.getTime() <= issuedAt.getTime()) {
    throw new Error("VISIT_CHAT_TOKEN_SOURCE_EXPIRED");
  }

  const token = await new SignJWT({
    appointmentId: input.appointmentId,
    actorRole: input.actorRole,
    sourceTokenId: input.sourceTokenId,
    purpose: VISIT_CHAT_TOKEN_PURPOSE,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(VISIT_CHAT_TOKEN_ISSUER)
    .setAudience(VISIT_CHAT_TOKEN_AUDIENCE)
    .setIssuedAt(toEpochSeconds(issuedAt))
    .setExpirationTime(toEpochSeconds(expiresAt))
    .sign(getSigningKey());

  return { token, expiresAt };
}

export async function verifyVisitChatToken(
  token: string,
  now: Date = new Date()
): Promise<VisitChatTokenVerification> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
      issuer: VISIT_CHAT_TOKEN_ISSUER,
      audience: VISIT_CHAT_TOKEN_AUDIENCE,
      currentDate: now,
    });
    const appointmentId = payload.appointmentId;
    const actorRole = payload.actorRole;
    const sourceTokenId = payload.sourceTokenId;
    const purpose = payload.purpose;
    const issuedAtSeconds = payload.iat;
    const expiresAtSeconds = payload.exp;
    if (
      !Number.isInteger(appointmentId) ||
      Number(appointmentId) <= 0 ||
      !isActorRole(actorRole) ||
      !Number.isInteger(sourceTokenId) ||
      Number(sourceTokenId) <= 0 ||
      purpose !== VISIT_CHAT_TOKEN_PURPOSE ||
      !Number.isInteger(issuedAtSeconds) ||
      !Number.isInteger(expiresAtSeconds) ||
      Number(expiresAtSeconds) <= Number(issuedAtSeconds) ||
      Number(expiresAtSeconds) - Number(issuedAtSeconds) >
        VISIT_CHAT_TOKEN_TTL_SECONDS
    ) {
      return { ok: false, reason: "TOKEN_INVALID" };
    }

    return {
      ok: true,
      claims: {
        appointmentId: Number(appointmentId),
        actorRole,
        sourceTokenId: Number(sourceTokenId),
        purpose,
        issuedAt: new Date(Number(issuedAtSeconds) * 1000),
        expiresAt: new Date(Number(expiresAtSeconds) * 1000),
      },
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      return { ok: false, reason: "TOKEN_EXPIRED" };
    }
    return { ok: false, reason: "TOKEN_INVALID" };
  }
}
