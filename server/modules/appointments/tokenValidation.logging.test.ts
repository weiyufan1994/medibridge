import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getAppointmentTokenByHash: vi.fn(),
  getAppointmentById: vi.fn(),
  updateTokenUsageIfAllowed: vi.fn(),
  saveTokenFirstSeen: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));

import * as appointmentsRepo from "./repo";
import { clearRateLimitStateForTests } from "./rateLimit";
import {
  clearTokenValidationStateForTests,
  revokeAppointmentAccessToken,
  validateAppointmentAccessToken,
} from "./tokenValidation";

function validTokenRow() {
  return {
    id: 7,
    appointmentId: 77,
    role: "doctor",
    tokenHash: "a".repeat(64),
    expiresAt: new Date(Date.now() + 60_000),
    lastUsedAt: null,
    useCount: 0,
    maxUses: 20,
    revokedAt: null,
  } as never;
}

function activeAppointment() {
  return {
    id: 77,
    doctorId: 12,
    email: "patient@example.com",
    scheduledAt: new Date(Date.now() - 60_000),
    status: "active",
    paymentStatus: "paid",
  } as never;
}

describe("appointment token logging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APPOINTMENT_TOKEN_FAIL_MAX_PER_IP", "50");
    vi.stubEnv("APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES", "30");
    clearRateLimitStateForTests();
    clearTokenValidationStateForTests();
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue(
      null as never
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("correlates a failure without logging the token or hash", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    await expect(
      validateAppointmentAccessToken({
        token: "raw-appointment-access-value",
        requestMetadata: {
          clientIp: "203.0.113.20",
          requestId: "request-token-validation",
          userAgent: "vitest",
        } as never,
      })
    ).rejects.toMatchObject({ message: "TOKEN_INVALID" });

    const serialized = String(consoleWarn.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "appointment-token",
      event: "validation_failed",
      reason: "TOKEN_INVALID",
      requestId: "request-token-validation",
      clientIp: "203.0.113.20",
    });
    expect(serialized).not.toContain("raw-appointment-access-value");
    expect(serialized).not.toContain("tokenHashPrefix");
  });

  it("correlates a successful validation without logging token material", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue(
      validTokenRow()
    );
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      activeAppointment()
    );
    vi.mocked(appointmentsRepo.saveTokenFirstSeen).mockResolvedValue(
      undefined as never
    );
    const consoleInfo = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await expect(
      validateAppointmentAccessToken({
        token: "raw-success-token",
        action: "send_message",
        requestMetadata: {
          clientIp: "203.0.113.21",
          requestId: "request-token-success",
          userAgent: "vitest",
        } as never,
      })
    ).resolves.toMatchObject({ appointmentId: 77, role: "doctor", tokenId: 7 });

    const serialized = String(consoleInfo.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "appointment-token",
      event: "validation_succeeded",
      appointmentId: 77,
      role: "doctor",
      tokenId: "[REDACTED]",
      clientIp: "203.0.113.21",
      requestId: "request-token-success",
    });
    expect(serialized).not.toContain("raw-success-token");
    expect(serialized).not.toContain("tokenHash");
  });

  it("hashes an explicit token before revoking it", async () => {
    vi.mocked(appointmentsRepo.revokeAppointmentTokens).mockResolvedValue(
      1 as never
    );

    await expect(
      revokeAppointmentAccessToken({
        appointmentId: 78,
        role: "patient",
        token: "raw-revoke-token",
        reason: "security_review",
      })
    ).resolves.toBe(1);

    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith({
      appointmentId: 78,
      role: "patient",
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      reason: "security_review",
    });
  });

  it("uses the manual reason when revoking without a token", async () => {
    vi.mocked(appointmentsRepo.revokeAppointmentTokens).mockResolvedValue(
      2 as never
    );

    await expect(
      revokeAppointmentAccessToken({ appointmentId: 79 })
    ).resolves.toBe(2);
    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith({
      appointmentId: 79,
      role: undefined,
      tokenHash: undefined,
      reason: "manual_revoke",
    });
  });
});
