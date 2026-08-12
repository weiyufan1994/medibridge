import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sourceValidator = vi.hoisted(() => vi.fn());

vi.mock("./tokenValidation", async importOriginal => {
  const actual = await importOriginal<typeof import("./tokenValidation")>();
  return {
    ...actual,
    validateAppointmentAccessToken: sourceValidator,
  };
});

vi.mock("./repo", () => ({
  getAppointmentTokenById: vi.fn(),
  getAppointmentById: vi.fn(),
  updateAppointmentById: vi.fn(),
}));

import * as appointmentsRepo from "./repo";
import { clearRateLimitStateForTests } from "./rateLimit";
import {
  exchangeAppointmentTokenForVisitChat,
  refreshVisitChatAccessToken,
  validateVisitChatAccessToken,
  validateVisitChatTokenForAppointment,
} from "./visitChatAccess";
import { issueVisitChatToken } from "./visitChatToken";

const signingSecret = "visit-chat-test-secret-at-least-32-bytes";

function requestMetadata() {
  return {
    clientIp: "203.0.113.20",
    requestId: "visit-chat-request",
    userAgent: "vitest",
  } as never;
}

function sourceTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 8,
    appointmentId: 42,
    role: "patient",
    tokenHash: "a".repeat(64),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    lastUsedAt: new Date(),
    useCount: 1,
    maxUses: 1,
    revokedAt: null,
    revokeReason: null,
    ipFirstSeen: null,
    uaFirstSeen: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function appointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 42,
    doctorId: 7,
    scheduledAt: new Date(Date.now() - 60_000),
    status: "active",
    paymentStatus: "paid",
    email: "patient@example.com",
    lastAccessAt: null,
    doctorLastAccessAt: null,
    ...overrides,
  };
}

async function validChatToken(
  input: {
    appointmentId?: number;
    role?: "patient" | "doctor";
    sourceTokenId?: number;
  } = {}
) {
  return issueVisitChatToken({
    appointmentId: input.appointmentId ?? 42,
    actorRole: input.role ?? "patient",
    sourceTokenId: input.sourceTokenId ?? 8,
    sourceExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
}

describe("visit chat access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("JWT_SECRET", signingSecret);
    vi.stubEnv("APPOINTMENT_TOKEN_FAIL_MAX_PER_IP", "50");
    clearRateLimitStateForTests();
    vi.mocked(appointmentsRepo.getAppointmentTokenById).mockResolvedValue(
      sourceTokenRow() as never
    );
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      appointment() as never
    );
    vi.mocked(appointmentsRepo.updateAppointmentById).mockResolvedValue(
      undefined as never
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exchanges a valid appointment link for a short-lived visit_chat token", async () => {
    sourceValidator.mockResolvedValue({
      appointmentId: 42,
      role: "patient",
      tokenId: 8,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const result = await exchangeAppointmentTokenForVisitChat({
      appointmentId: 42,
      token: "source-appointment-token",
      requestMetadata: requestMetadata(),
    });

    expect(sourceValidator).toHaveBeenCalledWith({
      token: "source-appointment-token",
      action: "join_room",
      expectedAppointmentId: 42,
      requestMetadata: requestMetadata(),
    });
    expect(result).toMatchObject({
      appointmentId: 42,
      role: "patient",
      purpose: "visit_chat",
    });
    expect(result.token).not.toContain("source-appointment-token");
  });

  it("accepts a valid token for its bound appointment and role", async () => {
    const issued = await validChatToken();
    await expect(
      validateVisitChatAccessToken({
        token: issued.token,
        action: "send_message",
        expectedAppointmentId: 42,
        expectedRole: "patient",
        requestMetadata: requestMetadata(),
      })
    ).resolves.toMatchObject({
      appointmentId: 42,
      role: "patient",
      sourceTokenId: 8,
    });
  });

  it("rejects an empty token before repository access", async () => {
    await expect(
      validateVisitChatAccessToken({ token: "   " })
    ).rejects.toMatchObject({ message: "TOKEN_MISSING" });
    expect(appointmentsRepo.getAppointmentTokenById).not.toHaveBeenCalled();
  });

  it("rate limits a client before verifying more signed tokens", async () => {
    vi.stubEnv("APPOINTMENT_TOKEN_FAIL_MAX_PER_IP", "1");
    clearRateLimitStateForTests();
    const metadata = requestMetadata();
    await expect(
      validateVisitChatAccessToken({
        token: "invalid-token",
        requestMetadata: metadata,
      })
    ).rejects.toMatchObject({ message: "TOKEN_INVALID" });
    await expect(
      validateVisitChatAccessToken({
        token: "another-token",
        requestMetadata: metadata,
      })
    ).rejects.toMatchObject({ message: "RATE_LIMITED" });
  });

  it.each([
    { expectedAppointmentId: 99, expectedRole: "patient" as const },
    { expectedAppointmentId: 42, expectedRole: "doctor" as const },
  ])("rejects appointment or role mismatch", async expected => {
    const issued = await validChatToken();
    await expect(
      validateVisitChatAccessToken({
        token: issued.token,
        ...expected,
        requestMetadata: requestMetadata(),
      })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "UNAUTHORIZED",
      message: "TOKEN_INVALID",
    });
  });

  it("rejects a plain appointment access token at the chat boundary", async () => {
    await expect(
      validateVisitChatAccessToken({
        token: "plain-appointment-access-token",
        requestMetadata: requestMetadata(),
      })
    ).rejects.toMatchObject({ message: "TOKEN_INVALID" });
    expect(appointmentsRepo.getAppointmentTokenById).not.toHaveBeenCalled();
  });

  it.each([
    { state: "missing", row: null, message: "TOKEN_INVALID" },
    {
      state: "revoked",
      row: sourceTokenRow({ revokedAt: new Date() }),
      message: "TOKEN_REVOKED",
    },
    {
      state: "expired",
      row: sourceTokenRow({ expiresAt: new Date(Date.now() - 1) }),
      message: "TOKEN_EXPIRED",
    },
    {
      state: "role changed",
      row: sourceTokenRow({ role: "doctor" }),
      message: "TOKEN_INVALID",
    },
  ])("rejects when the source token is $state", async ({ row, message }) => {
    vi.mocked(appointmentsRepo.getAppointmentTokenById).mockResolvedValue(
      row as never
    );
    const issued = await validChatToken();
    await expect(
      validateVisitChatAccessToken({
        token: issued.token,
        requestMetadata: requestMetadata(),
      })
    ).rejects.toMatchObject({ message });
  });

  it("rejects a visit whose appointment state is no longer allowed", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      appointment({ status: "refunded", paymentStatus: "refunded" }) as never
    );
    const issued = await validChatToken();
    await expect(
      validateVisitChatAccessToken({
        token: issued.token,
        requestMetadata: requestMetadata(),
      })
    ).rejects.toMatchObject({ message: "APPOINTMENT_NOT_ALLOWED" });
  });

  it("rejects a valid signed token when the appointment no longer exists", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      null as never
    );
    const issued = await validChatToken();
    await expect(
      validateVisitChatAccessToken({
        token: issued.token,
        requestMetadata: requestMetadata(),
      })
    ).rejects.toMatchObject({ message: "APPOINTMENT_NOT_FOUND" });
  });

  it("refreshes only from a currently valid visit_chat token", async () => {
    const issued = await validChatToken();
    const refreshed = await refreshVisitChatAccessToken({
      appointmentId: 42,
      token: issued.token,
      requestMetadata: requestMetadata(),
    });
    expect(refreshed).toMatchObject({
      appointmentId: 42,
      role: "patient",
      purpose: "visit_chat",
    });

    await expect(
      refreshVisitChatAccessToken({
        appointmentId: 42,
        token: "plain-appointment-access-token",
        requestMetadata: requestMetadata(),
      })
    ).rejects.toMatchObject({ message: "TOKEN_INVALID" });
  });

  it("does not log raw or signed token material on validation failure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const rawToken = "raw-visit-chat-token-material";

    await expect(
      validateVisitChatAccessToken({
        token: rawToken,
        requestMetadata: requestMetadata(),
      })
    ).rejects.toBeTruthy();

    const serialized = String(consoleWarn.mock.calls.at(-1)?.[0]);
    expect(serialized).toContain("visit-chat-token");
    expect(serialized).not.toContain(rawToken);
    expect(serialized).not.toContain("tokenHash");
  });

  it("logs a successful validation without token material", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const issued = await validChatToken();

    await validateVisitChatAccessToken({
      token: issued.token,
      requestMetadata: requestMetadata(),
    });

    const serialized = String(consoleInfo.mock.calls.at(-1)?.[0]);
    expect(serialized).toContain("visit-chat-token");
    expect(serialized).not.toContain(issued.token);
    expect(serialized).not.toContain("tokenHash");
  });

  it.each(["patient", "doctor"] as const)(
    "touches the appointment access timestamp for a %s chat token",
    async role => {
      vi.mocked(appointmentsRepo.getAppointmentTokenById).mockResolvedValue(
        sourceTokenRow({ role }) as never
      );
      const issued = await validChatToken({ role });

      const result = await validateVisitChatTokenForAppointment(
        42,
        issued.token,
        "read_history",
        requestMetadata()
      );

      expect(appointmentsRepo.updateAppointmentById).toHaveBeenCalledWith(
        42,
        role === "patient"
          ? { lastAccessAt: expect.any(Date) }
          : { doctorLastAccessAt: expect.any(Date) }
      );
      expect(result).toMatchObject({ role, appointment: { id: 42 } });
    }
  );
});
