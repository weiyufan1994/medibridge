import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestMetadata } from "@shared/requestMetadata";

vi.mock("./tokenValidation", () => ({
  revokeAppointmentAccessToken: vi.fn(),
  validateAppointmentAccessToken: vi.fn(),
}));

import {
  revokeAppointmentAccessToken,
  validateAppointmentAccessToken,
} from "./tokenValidation";
import {
  revokeAccessTokenByInput,
  validateAccessTokenContext,
} from "./tokenActions";

const requestMetadata: RequestMetadata = {
  clientIp: "198.51.100.7",
  forwardedHost: null,
  forwardedProto: null,
  host: "medibridge.test",
  protocol: "https",
  requestId: "request-1",
  userAgent: "Token-Action-Test/1.0",
};

describe("appointment token actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the public access context after validation", async () => {
    const expiresAt = new Date("2026-08-20T09:30:00.000Z");
    vi.mocked(validateAppointmentAccessToken).mockResolvedValue({
      appointmentId: 9001,
      role: "patient",
      tokenId: 71,
      tokenHash: "a".repeat(64),
      expiresAt,
      displayInfo: { patientEmail: "patient@example.com", doctorId: 42 },
      appointment: { id: 9001 },
      tokenRecord: { id: 71 },
    } as never);

    await expect(
      validateAccessTokenContext({
        token: "patient-access-token",
        requestMetadata,
      })
    ).resolves.toEqual({
      appointmentId: 9001,
      role: "patient",
      tokenId: 71,
      tokenHash: "a".repeat(64),
      expiresAt,
      displayInfo: { patientEmail: "patient@example.com", doctorId: 42 },
    });
    expect(validateAppointmentAccessToken).toHaveBeenCalledWith({
      token: "patient-access-token",
      requestMetadata,
    });
  });

  it("propagates validation failures without returning partial context", async () => {
    vi.mocked(validateAppointmentAccessToken).mockRejectedValue(
      new Error("token expired")
    );

    await expect(
      validateAccessTokenContext({ token: "expired-access-token" })
    ).rejects.toThrow("token expired");
  });

  it("maps every optional revoke filter and returns the affected count", async () => {
    vi.mocked(revokeAppointmentAccessToken).mockResolvedValue(2);

    await expect(
      revokeAccessTokenByInput({
        appointmentId: 9001,
        role: "doctor",
        token: "doctor-access-token",
        revokeReason: "manual_security_revoke",
      })
    ).resolves.toEqual({ ok: true, revokedCount: 2 });

    expect(revokeAppointmentAccessToken).toHaveBeenCalledWith({
      appointmentId: 9001,
      role: "doctor",
      token: "doctor-access-token",
      reason: "manual_security_revoke",
    });
  });

  it("preserves omitted filters and propagates revoke failures", async () => {
    vi.mocked(revokeAppointmentAccessToken).mockRejectedValue(
      new Error("revoke failed")
    );

    await expect(
      revokeAccessTokenByInput({ token: "patient-access-token" })
    ).rejects.toThrow("revoke failed");

    expect(revokeAppointmentAccessToken).toHaveBeenCalledWith({
      appointmentId: undefined,
      role: undefined,
      token: "patient-access-token",
      reason: undefined,
    });
  });
});
