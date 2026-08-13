import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/appointmentToken", () => ({
  generateToken: vi.fn(),
  hashToken: vi.fn(),
}));

vi.mock("./repo", () => ({
  createAppointmentTokenIfMissing: vi.fn(),
  revokeAppointmentTokens: vi.fn(),
}));

vi.mock("./linkService", () => ({
  buildAppointmentAccessLink: vi.fn(),
}));

import { generateToken, hashToken } from "../../_core/appointmentToken";
import { buildAppointmentAccessLink } from "./linkService";
import * as appointmentsRepo from "./repo";
import {
  createAccessTokenRecord,
  generateAppointmentAccessToken,
  getAppointmentTokenTtlHours,
  getRoleMaxUses,
  getTokenAutoRevokeThreshold,
  issueAppointmentAccessLinks,
} from "./tokenService";

const TOKEN_ENV_NAMES = [
  "APPOINTMENT_TOKEN_TTL_HOURS",
  "APPOINTMENT_DOCTOR_TOKEN_MAX_USES",
  "APPOINTMENT_PATIENT_TOKEN_MAX_USES",
  "APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES",
] as const;

const baseNow = new Date("2026-08-13T00:00:00.000Z");

describe("appointment token service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(baseNow);
    for (const name of TOKEN_ENV_NAMES) {
      delete process.env[name];
    }
    vi.mocked(generateToken).mockReturnValue("generated-token");
    vi.mocked(hashToken).mockImplementation(token => `hash:${token}`);
    vi.mocked(buildAppointmentAccessLink).mockImplementation(
      ({ appointmentId, token }) => `/visit/${appointmentId}?t=${token}`
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const name of TOKEN_ENV_NAMES) {
      delete process.env[name];
    }
  });

  it("uses safe defaults when numeric token configuration is absent", () => {
    expect(getAppointmentTokenTtlHours()).toBe(24);
    expect(getRoleMaxUses("patient")).toBe(1);
    expect(getRoleMaxUses("doctor")).toBe(20);
    expect(getTokenAutoRevokeThreshold()).toBe(30);
  });

  it("uses finite positive numeric token configuration", () => {
    process.env.APPOINTMENT_TOKEN_TTL_HOURS = "48";
    process.env.APPOINTMENT_PATIENT_TOKEN_MAX_USES = "2";
    process.env.APPOINTMENT_DOCTOR_TOKEN_MAX_USES = "25";
    process.env.APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES = "12";

    expect(getAppointmentTokenTtlHours()).toBe(48);
    expect(getRoleMaxUses("patient")).toBe(2);
    expect(getRoleMaxUses("doctor")).toBe(25);
    expect(getTokenAutoRevokeThreshold()).toBe(12);
  });

  it("rejects non-finite and non-positive numeric token configuration", () => {
    process.env.APPOINTMENT_TOKEN_TTL_HOURS = "not-a-number";
    process.env.APPOINTMENT_PATIENT_TOKEN_MAX_USES = "0";
    process.env.APPOINTMENT_DOCTOR_TOKEN_MAX_USES = "-1";
    process.env.APPOINTMENT_TOKEN_AUTO_REVOKE_FAILURES = "Infinity";

    expect(getAppointmentTokenTtlHours()).toBe(24);
    expect(getRoleMaxUses("patient")).toBe(1);
    expect(getRoleMaxUses("doctor")).toBe(20);
    expect(getTokenAutoRevokeThreshold()).toBe(30);
  });

  it("returns the generated token together with its hash", () => {
    expect(generateAppointmentAccessToken()).toEqual({
      token: "generated-token",
      tokenHash: "hash:generated-token",
    });
    expect(hashToken).toHaveBeenCalledWith("generated-token");
  });

  it("creates a patient token record with service defaults", async () => {
    const dbExecutor = { transaction: vi.fn() } as never;
    vi.mocked(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).mockResolvedValue(undefined);

    await expect(
      createAccessTokenRecord({
        appointmentId: 42,
        role: "patient",
        dbExecutor,
      })
    ).resolves.toEqual({
      token: "generated-token",
      tokenHash: "hash:generated-token",
      expiresAt: new Date("2026-08-14T00:00:00.000Z"),
      maxUses: 1,
    });
    expect(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).toHaveBeenCalledWith({
      appointmentId: 42,
      role: "patient",
      tokenHash: "hash:generated-token",
      expiresAt: new Date("2026-08-14T00:00:00.000Z"),
      maxUses: 1,
      createdBy: "system",
      dbExecutor,
    });
  });

  it("preserves explicit expiry, limits, and creator values", async () => {
    const expiresAt = new Date("2026-08-13T02:00:00.000Z");

    await expect(
      createAccessTokenRecord({
        appointmentId: 43,
        role: "doctor",
        expiresAt,
        maxUses: 7,
        createdBy: "admin:9",
      })
    ).resolves.toMatchObject({ expiresAt, maxUses: 7 });
    expect(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 43,
        role: "doctor",
        expiresAt,
        maxUses: 7,
        createdBy: "admin:9",
      })
    );
  });

  it("normalizes a null creator to the system actor", async () => {
    await createAccessTokenRecord({
      appointmentId: 44,
      role: "doctor",
      createdBy: null,
    });

    expect(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).toHaveBeenCalledWith(expect.objectContaining({ createdBy: "system" }));
  });

  it("propagates persistence failures without returning token material", async () => {
    vi.mocked(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).mockRejectedValue(new Error("token write failed"));

    await expect(
      createAccessTokenRecord({ appointmentId: 42, role: "patient" })
    ).rejects.toThrow("token write failed");
  });

  it("revokes old tokens before issuing patient and doctor links", async () => {
    const dbExecutor = { transaction: vi.fn() } as never;
    vi.mocked(generateToken)
      .mockReturnValueOnce("patient-token")
      .mockReturnValueOnce("doctor-token");

    const result = await issueAppointmentAccessLinks({
      appointmentId: 51,
      createdBy: "staff:3",
      patientMaxUses: 3,
      doctorMaxUses: 30,
      dbExecutor,
    });

    expect(appointmentsRepo.revokeAppointmentTokens).toHaveBeenCalledWith({
      appointmentId: 51,
      reason: "reissued",
      dbExecutor,
    });
    expect(
      vi.mocked(appointmentsRepo.revokeAppointmentTokens).mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(appointmentsRepo.createAppointmentTokenIfMissing).mock
        .invocationCallOrder[0]
    );
    expect(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        role: "patient",
        tokenHash: "hash:patient-token",
        maxUses: 3,
        createdBy: "staff:3",
        dbExecutor,
      })
    );
    expect(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        role: "doctor",
        tokenHash: "hash:doctor-token",
        maxUses: 30,
        createdBy: "staff:3",
        dbExecutor,
      })
    );
    expect(result).toMatchObject({
      patient: { token: "patient-token", maxUses: 3 },
      doctor: { token: "doctor-token", maxUses: 30 },
      expiresAt: new Date("2026-08-14T00:00:00.000Z"),
      patientLink: "/visit/51?t=patient-token",
      doctorLink: "/visit/51?t=doctor-token",
    });
  });

  it("stops before token creation when revocation fails", async () => {
    vi.mocked(appointmentsRepo.revokeAppointmentTokens).mockRejectedValue(
      new Error("revoke failed")
    );

    await expect(
      issueAppointmentAccessLinks({ appointmentId: 52 })
    ).rejects.toThrow("revoke failed");
    expect(generateToken).not.toHaveBeenCalled();
    expect(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).not.toHaveBeenCalled();
    expect(buildAppointmentAccessLink).not.toHaveBeenCalled();
  });

  it("stops before doctor creation when patient persistence fails", async () => {
    vi.mocked(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).mockRejectedValueOnce(new Error("patient write failed"));

    await expect(
      issueAppointmentAccessLinks({ appointmentId: 53 })
    ).rejects.toThrow("patient write failed");
    expect(generateToken).toHaveBeenCalledTimes(1);
    expect(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).toHaveBeenCalledTimes(1);
    expect(buildAppointmentAccessLink).not.toHaveBeenCalled();
  });

  it("does not expose links when doctor persistence fails", async () => {
    vi.mocked(appointmentsRepo.createAppointmentTokenIfMissing)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("doctor write failed"));

    await expect(
      issueAppointmentAccessLinks({ appointmentId: 54 })
    ).rejects.toThrow("doctor write failed");
    expect(generateToken).toHaveBeenCalledTimes(2);
    expect(
      appointmentsRepo.createAppointmentTokenIfMissing
    ).toHaveBeenCalledTimes(2);
    expect(buildAppointmentAccessLink).not.toHaveBeenCalled();
  });
});
