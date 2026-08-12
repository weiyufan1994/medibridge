import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentTokenByHash: vi.fn(),
  getAppointmentById: vi.fn(),
  updateTokenUsageIfAllowed: vi.fn(),
  saveTokenFirstSeen: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));

import { buildAppointmentAccessLink } from "./modules/appointments/linkService";
import * as appointmentsRepo from "./modules/appointments/repo";
import { clearRateLimitStateForTests } from "./modules/appointments/rateLimit";
import {
  clearTokenValidationStateForTests,
  validateAppointmentAccessToken,
} from "./modules/appointments/tokenValidation";

function makeRequestMetadata(ip = "1.2.3.4") {
  return { clientIp: ip, userAgent: "vitest-agent" } as never;
}

function paidAppointment() {
  return {
    id: 777,
    doctorId: 42,
    triageSessionId: 1,
    appointmentType: "video_call",
    scheduledAt: new Date("2026-03-04T10:00:00.000Z"),
    status: "paid",
    paymentStatus: "paid",
    amount: 100,
    currency: "usd",
    paidAt: new Date("2026-03-04T09:00:00.000Z"),
    email: "p@example.com",
    sessionId: null,
    userId: null,
    stripeSessionId: "cs_x",
    lastAccessAt: null,
    doctorLastAccessAt: null,
    createdAt: new Date("2026-03-04T09:00:00.000Z"),
    updatedAt: new Date("2026-03-04T09:00:00.000Z"),
  };
}

describe("token validation policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStateForTests();
    clearTokenValidationStateForTests();
    process.env.APPOINTMENT_TOKEN_FAIL_WINDOW_MS = "60000";
    process.env.APPOINTMENT_TOKEN_FAIL_MAX_PER_IP = "50";
    process.env.APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES = "30";
    process.env.APP_BASE_URL = "https://medibridge.test";
  });

  it("allows an active appointment to send messages", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
      id: 1,
      appointmentId: 777,
      role: "doctor",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      useCount: 0,
      maxUses: 10,
      revokedAt: null,
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      ...paidAppointment(),
      status: "active",
    } as never);
    vi.mocked(appointmentsRepo.updateTokenUsageIfAllowed).mockResolvedValue(
      1 as never
    );
    vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(
      undefined as never
    );

    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        requestMetadata: makeRequestMetadata(),
        action: "send_message",
      })
    ).resolves.toMatchObject({ role: "doctor", appointmentId: 777 });
  });

  it.each(["join_room", "read_history", "send_message"] as const)(
    "blocks %s before a future appointment starts",
    async action => {
      vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
        id: 1,
        appointmentId: 777,
        role: "patient",
        tokenHash: "a".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
        useCount: 0,
        maxUses: 10,
        revokedAt: null,
      } as never);
      vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
        ...paidAppointment(),
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      } as never);

      await expect(
        validateAppointmentAccessToken({
          token: "token-1234567890abcdef",
          requestMetadata: makeRequestMetadata(),
          action,
        })
      ).rejects.toMatchObject<Partial<TRPCError>>({
        code: "FORBIDDEN",
        message: "APPOINTMENT_NOT_STARTED",
      });
    }
  );

  it("allows a future appointment in visit-room test mode", async () => {
    process.env.VISIT_ROOM_TEST_MODE = "true";
    try {
      vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
        id: 1,
        appointmentId: 777,
        role: "patient",
        tokenHash: "a".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
        useCount: 0,
        maxUses: 10,
        revokedAt: null,
      } as never);
      vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
        ...paidAppointment(),
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      } as never);
      vi.mocked(appointmentsRepo.updateTokenUsageIfAllowed).mockResolvedValue(
        1 as never
      );
      vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(
        undefined as never
      );

      await expect(
        validateAppointmentAccessToken({
          token: "token-1234567890abcdef",
          requestMetadata: makeRequestMetadata(),
          action: "join_room",
        })
      ).resolves.toBeTruthy();
    } finally {
      delete process.env.VISIT_ROOM_TEST_MODE;
    }
  });

  it("requires APP_BASE_URL when building an access link", () => {
    delete process.env.APP_BASE_URL;
    expect(() =>
      buildAppointmentAccessLink({ appointmentId: 1, token: "abc" })
    ).toThrow("APP_BASE_URL_MISSING");
  });

  it("rate limits repeated failures from one IP", async () => {
    process.env.APPOINTMENT_TOKEN_FAIL_MAX_PER_IP = "2";
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue(
      null as never
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        validateAppointmentAccessToken({
          token: "token-1234567890abcdef",
          requestMetadata: makeRequestMetadata(),
        })
      ).rejects.toMatchObject({ message: "TOKEN_INVALID" });
    }
    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        requestMetadata: makeRequestMetadata(),
      })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "TOO_MANY_REQUESTS",
      message: "RATE_LIMITED",
    });
  });

  it("auto-revokes a token after the configured failure threshold", async () => {
    process.env.APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES = "2";
    process.env.APPOINTMENT_TOKEN_FAIL_MAX_PER_IP = "50";
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
      id: 1,
      appointmentId: 777,
      role: "patient",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      useCount: 0,
      maxUses: 1,
      revokedAt: null,
    } as never);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(
        validateAppointmentAccessToken({
          token: "token-1234567890abcdef",
          requestMetadata: makeRequestMetadata(),
          expectedRole: "doctor",
        })
      ).rejects.toThrow();
    }

    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "too_many_failed_attempts" })
    );
  });
});
