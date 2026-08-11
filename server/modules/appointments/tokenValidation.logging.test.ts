import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getAppointmentTokenByHash: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));

import * as appointmentsRepo from "./repo";
import { clearRateLimitStateForTests } from "./rateLimit";
import {
  clearTokenValidationStateForTests,
  validateAppointmentAccessToken,
} from "./tokenValidation";

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
});
