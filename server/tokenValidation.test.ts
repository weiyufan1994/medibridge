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
import { clearMetricsForTests, getMetricsSnapshot } from "./_core/metrics";
import {
  clearTokenValidationStateForTests,
  validateAppointmentAccessToken,
} from "./modules/appointments/tokenValidation";

function makeReq(ip = "1.2.3.4") {
  return {
    ip,
    headers: {
      "user-agent": "vitest-agent",
    },
  } as never;
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

describe("token validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimitStateForTests();
    clearTokenValidationStateForTests();
    clearMetricsForTests();
    process.env.APPOINTMENT_TOKEN_FAIL_WINDOW_MS = "60000";
    process.env.APPOINTMENT_TOKEN_FAIL_MAX_PER_IP = "50";
    process.env.APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES = "30";
    process.env.APP_BASE_URL = "https://medibridge.test";
  });

  it("valid token resolves role and appointment context", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
      id: 1,
      appointmentId: 777,
      role: "patient",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      lastUsedAt: null,
      useCount: 0,
      maxUses: 1,
      revokedAt: null,
      revokeReason: null,
      ipFirstSeen: null,
      uaFirstSeen: null,
      createdAt: new Date(),
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      paidAppointment() as never
    );
    vi.mocked(appointmentsRepo.updateTokenUsageIfAllowed).mockResolvedValue(1 as never);
    vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(undefined as never);

    const result = await validateAppointmentAccessToken({
      token: "token-1234567890abcdef",
      req: makeReq(),
    });

    expect(result.role).toBe("patient");
    expect(result.appointmentId).toBe(777);
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "appointment_token_validation_success_total",
          value: 1,
        }),
      ])
    );
    expect(appointmentsRepo.saveTokenFirstSeen).toHaveBeenCalledWith(
      expect.objectContaining({ tokenId: 1, ip: "1.2.3.4" })
    );
  });

  it("expired token is rejected", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
      id: 1,
      appointmentId: 777,
      role: "patient",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() - 1),
      useCount: 0,
      maxUses: 1,
      revokedAt: null,
    } as never);

    await expect(
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "UNAUTHORIZED",
      message: "TOKEN_EXPIRED",
    });
    expect(getMetricsSnapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "appointment_token_validation_failed_total{reason=TOKEN_EXPIRED}",
          value: 1,
        }),
      ])
    );
  });

  it("revoked token is rejected", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
      id: 1,
      appointmentId: 777,
      role: "patient",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      useCount: 0,
      maxUses: 1,
      revokedAt: new Date(),
    } as never);

    await expect(
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "UNAUTHORIZED",
      message: "TOKEN_REVOKED",
    });
  });

  it("maxUses=1 concurrent validation only succeeds once", async () => {
    let updateCalls = 0;
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
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      paidAppointment() as never
    );
    vi.mocked(appointmentsRepo.updateTokenUsageIfAllowed).mockImplementation(async () => {
      updateCalls += 1;
      return updateCalls === 1 ? 1 : 0;
    });

    const [a, b] = await Promise.allSettled([
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() }),
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() }),
    ]);

    const fulfilled = [a, b].filter(item => item.status === "fulfilled");
    const rejected = [a, b].filter(item => item.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      message: "TOKEN_MAX_USES",
    });
  });

  it("non-existing token returns TOKEN_INVALID", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue(null as never);

    await expect(
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "UNAUTHORIZED",
      message: "TOKEN_INVALID",
    });
  });

  it("appointment in pending_payment is blocked with APPOINTMENT_NOT_ALLOWED", async () => {
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
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      ...paidAppointment(),
      status: "pending_payment",
      paymentStatus: "pending",
    } as never);

    await expect(
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "FORBIDDEN",
      message: "APPOINTMENT_NOT_ALLOWED",
    });
  });

  it.each([
    { status: "pending_payment", paymentStatus: "pending" },
    { status: "expired", paymentStatus: "expired" },
    { status: "refunded", paymentStatus: "refunded" },
    { status: "canceled", paymentStatus: "canceled" },
    { status: "pending_payment", paymentStatus: "failed" },
  ])(
    "status matrix blocks room access for $status/$paymentStatus",
    async ({ status, paymentStatus }) => {
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
      vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
        ...paidAppointment(),
        status,
        paymentStatus,
      } as never);

      await expect(
        validateAppointmentAccessToken({
          token: "token-1234567890abcdef",
          req: makeReq(),
          action: "join_room",
        })
      ).rejects.toMatchObject<Partial<TRPCError>>({
        code: "FORBIDDEN",
        message: "APPOINTMENT_NOT_ALLOWED",
      });
    }
  );

  it("paid appointment can join and can send message", async () => {
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
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      paidAppointment() as never
    );
    vi.mocked(appointmentsRepo.updateTokenUsageIfAllowed).mockResolvedValue(1 as never);
    vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(undefined as never);

    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        req: makeReq(),
        action: "join_room",
      })
    ).resolves.toBeTruthy();

    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        req: makeReq(),
        action: "send_message",
      })
    ).resolves.toMatchObject({
      role: "patient",
      appointmentId: 777,
    });
  });

  it("join_room allows idempotent reuse within active session window", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
      id: 1,
      appointmentId: 777,
      role: "patient",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      useCount: 1,
      maxUses: 1,
      lastUsedAt: new Date(Date.now() - 30_000),
      revokedAt: null,
      revokeReason: null,
      ipFirstSeen: null,
      uaFirstSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      paidAppointment() as never
    );
    vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(undefined as never);

    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        req: makeReq(),
        action: "join_room",
      })
    ).resolves.toBeTruthy();
    expect(appointmentsRepo.updateTokenUsageIfAllowed).not.toHaveBeenCalled();
  });

  it("send_message is allowed after join consumed maxUses", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue({
      id: 1,
      appointmentId: 777,
      role: "patient",
      tokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      useCount: 1,
      maxUses: 1,
      lastUsedAt: new Date(Date.now() - 20 * 60 * 1000),
      revokedAt: null,
      revokeReason: null,
      ipFirstSeen: null,
      uaFirstSeen: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      paidAppointment() as never
    );
    vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(undefined as never);

    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        req: makeReq(),
        action: "send_message",
      })
    ).resolves.toMatchObject({
      role: "patient",
      appointmentId: 777,
    });
    expect(appointmentsRepo.updateTokenUsageIfAllowed).not.toHaveBeenCalled();
  });

  it("active appointment allows send message", async () => {
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
    vi.mocked(appointmentsRepo.updateTokenUsageIfAllowed).mockResolvedValue(1 as never);
    vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(undefined as never);

    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        req: makeReq(),
        action: "send_message",
      })
    ).resolves.toMatchObject({
      role: "doctor",
      appointmentId: 777,
    });
  });

  it("APP_BASE_URL missing throws when building access link", () => {
    delete process.env.APP_BASE_URL;
    expect(() =>
      buildAppointmentAccessLink({
        appointmentId: 1,
        token: "abc",
      })
    ).toThrow("APP_BASE_URL_MISSING");
  });

  it("IP failure rate limit returns TOO_MANY_REQUESTS", async () => {
    process.env.APPOINTMENT_TOKEN_FAIL_MAX_PER_IP = "2";
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue(null as never);

    await expect(
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() })
    ).rejects.toMatchObject({ message: "TOKEN_INVALID" });
    await expect(
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() })
    ).rejects.toMatchObject({ message: "TOKEN_INVALID" });
    await expect(
      validateAppointmentAccessToken({ token: "token-1234567890abcdef", req: makeReq() })
    ).rejects.toMatchObject<Partial<TRPCError>>({
      code: "TOO_MANY_REQUESTS",
      message: "RATE_LIMITED",
    });
  });

  it("failed attempts over threshold auto-revoke token", async () => {
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

    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        req: makeReq(),
        expectedRole: "doctor",
      })
    ).rejects.toThrow();
    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        req: makeReq(),
        expectedRole: "doctor",
      })
    ).rejects.toThrow();

    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "too_many_failed_attempts" })
    );
  });
});
