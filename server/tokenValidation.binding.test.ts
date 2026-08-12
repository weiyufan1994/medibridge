import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentTokenByHash: vi.fn(),
  getAppointmentById: vi.fn(),
  updateTokenUsageIfAllowed: vi.fn(),
  saveTokenFirstSeen: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import { clearRateLimitStateForTests } from "./modules/appointments/rateLimit";
import {
  clearTokenValidationStateForTests,
  validateAppointmentAccessToken,
} from "./modules/appointments/tokenValidation";

function validTokenRow() {
  return {
    id: 1,
    appointmentId: 777,
    role: "patient",
    tokenHash: "a".repeat(64),
    expiresAt: new Date(Date.now() + 60_000),
    useCount: 0,
    maxUses: 1,
    revokedAt: null,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearRateLimitStateForTests();
  clearTokenValidationStateForTests();
  process.env.APPOINTMENT_TOKEN_FAIL_MAX_PER_IP = "50";
  process.env.APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES = "30";
});

describe("appointment token binding", () => {
  it("rejects an empty token before hashing or repository access", async () => {
    await expect(
      validateAppointmentAccessToken({ token: "   " })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "TOKEN_MISSING",
    });
    expect(appointmentsRepo.getAppointmentTokenByHash).not.toHaveBeenCalled();
  });

  it("rejects a token bound to another appointment", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue(
      validTokenRow()
    );

    await expect(
      validateAppointmentAccessToken({
        token: "token-1234567890abcdef",
        expectedAppointmentId: 778,
      })
    ).rejects.toMatchObject({ message: "TOKEN_INVALID" });
    expect(appointmentsRepo.getAppointmentById).not.toHaveBeenCalled();
  });

  it("rejects a valid token whose appointment was deleted", async () => {
    vi.mocked(appointmentsRepo.getAppointmentTokenByHash).mockResolvedValue(
      validTokenRow()
    );
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      null as never
    );

    await expect(
      validateAppointmentAccessToken({ token: "token-1234567890abcdef" })
    ).rejects.toMatchObject({ message: "APPOINTMENT_NOT_FOUND" });
  });
});
