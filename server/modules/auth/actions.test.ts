import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("crypto", () => ({
  default: { randomInt: vi.fn(() => 42) },
}));
vi.mock("../../_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
  })),
}));
vi.mock("../../_core/sdk", () => ({
  sdk: { createSessionToken: vi.fn(async () => "session-token") },
}));
vi.mock("../doctorAccounts/publicApi", () => ({
  doctorAccountAccessApi: { getActiveBindingByUserId: vi.fn() },
}));

import { COOKIE_NAME } from "@shared/const";
import { sdk } from "../../_core/sdk";
import { doctorAccountAccessApi } from "../doctorAccounts/publicApi";
import {
  consumeOtpCode,
  getMeUser,
  requestOtpAction,
  setSessionCookieByUser,
} from "./actions";

const req = { protocol: "https", headers: {} } as never;
const res = { cookie: vi.fn(), clearCookie: vi.fn() };

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    openId: "open-10",
    name: "Patient",
    email: "patient@example.com",
    isGuest: 0,
    deviceId: null,
    role: "free",
    loginMethod: "otp",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  } as never;
}

describe("auth actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects session creation without a formal open id", async () => {
    await expect(
      setSessionCookieByUser({
        req,
        res,
        user: { id: 1, openId: null, name: null, email: null },
      })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(sdk.createSessionToken).not.toHaveBeenCalled();
  });

  it.each([
    [
      { id: 1, openId: "open-1", name: "Named", email: "mail@example.com" },
      "Named",
    ],
    [
      { id: 2, openId: "open-2", name: null, email: "mail@example.com" },
      "mail@example.com",
    ],
    [{ id: 3, openId: "open-3", name: null, email: null }, "user-3"],
  ])(
    "creates a session using the available display name",
    async (sessionUser, name) => {
      await setSessionCookieByUser({ req, res, user: sessionUser });
      expect(sdk.createSessionToken).toHaveBeenCalledWith(sessionUser.openId, {
        name,
      });
      expect(res.cookie).toHaveBeenCalledWith(
        COOKIE_NAME,
        "session-token",
        expect.objectContaining({ httpOnly: true, secure: true })
      );
    }
  );

  it("returns null for anonymous users and skips binding lookup for guests", async () => {
    await expect(getMeUser(null)).resolves.toBeNull();
    await expect(getMeUser(user({ isGuest: 1 }))).resolves.toMatchObject({
      id: 10,
      doctorBinding: null,
    });
    expect(
      doctorAccountAccessApi.getActiveBindingByUserId
    ).not.toHaveBeenCalled();
  });

  it("normalizes nullable fields on an active doctor binding", async () => {
    vi.mocked(
      doctorAccountAccessApi.getActiveBindingByUserId
    ).mockResolvedValue({
      doctorId: 20,
      userId: 10,
      email: "doctor@example.com",
      status: "active",
      boundAt: undefined,
      revokedAt: undefined,
    } as never);
    await expect(getMeUser(user())).resolves.toMatchObject({
      doctorBinding: {
        doctorId: 20,
        boundAt: null,
        revokedAt: null,
      },
    });
  });

  it("accepts an OTP once and rejects invalid or replayed codes", () => {
    requestOtpAction({ email: "otp@example.com" });
    expect(() =>
      consumeOtpCode({ email: "otp@example.com", code: "000041" })
    ).toThrowError("Invalid OTP code");
    expect(() =>
      consumeOtpCode({ email: "otp@example.com", code: "000042" })
    ).not.toThrow();
    expect(() =>
      consumeOtpCode({ email: "otp@example.com", code: "000042" })
    ).toThrowError("OTP has expired or does not exist");
  });

  it("expires an OTP after ten minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    expect(requestOtpAction({ email: "expired@example.com" })).toEqual({
      success: true,
      expiresInMs: 600_000,
    });
    vi.advanceTimersByTime(600_001);
    expect(() =>
      consumeOtpCode({ email: "expired@example.com", code: "000042" })
    ).toThrowError("OTP has expired or does not exist");
  });

  it("accepts the fixed demo code for an allowlisted email on dev", () => {
    vi.stubEnv("MEDIBRIDGE_RELEASE_CHANNEL", "dev");
    vi.stubEnv("DEMO_OTP_ENABLED", "true");
    vi.stubEnv("DEMO_OTP_EMAILS", "demo@medibridge.test");
    vi.stubEnv("DEMO_OTP_CODE", "482731");

    requestOtpAction({ email: "demo@medibridge.test" });

    expect(() =>
      consumeOtpCode({
        email: "demo@medibridge.test",
        code: "482731",
      })
    ).not.toThrow();
  });

  it("accepts the fixed local code only in the local development runtime", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MEDIBRIDGE_RELEASE_CHANNEL", "local");
    vi.stubEnv("LOCAL_OTP_ENABLED", "true");
    vi.stubEnv("LOCAL_OTP_EMAILS", "local@medibridge.test");
    vi.stubEnv("LOCAL_OTP_CODE", "135790");

    requestOtpAction({ email: "local@medibridge.test" });

    expect(() =>
      consumeOtpCode({
        email: "local@medibridge.test",
        code: "135790",
      })
    ).not.toThrow();
  });

  it("uses a random code on main even when demo variables remain configured", () => {
    vi.stubEnv("MEDIBRIDGE_RELEASE_CHANNEL", "main");
    vi.stubEnv("DEMO_OTP_ENABLED", "true");
    vi.stubEnv("DEMO_OTP_EMAILS", "demo-main@medibridge.test");
    vi.stubEnv("DEMO_OTP_CODE", "482731");

    requestOtpAction({ email: "demo-main@medibridge.test" });

    expect(() =>
      consumeOtpCode({
        email: "demo-main@medibridge.test",
        code: "482731",
      })
    ).toThrowError("Invalid OTP code");
    expect(() =>
      consumeOtpCode({
        email: "demo-main@medibridge.test",
        code: "000042",
      })
    ).not.toThrow();
  });

  it("uses a random code on main even when local variables remain configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MEDIBRIDGE_RELEASE_CHANNEL", "main");
    vi.stubEnv("LOCAL_OTP_ENABLED", "true");
    vi.stubEnv("LOCAL_OTP_EMAILS", "local-main@medibridge.test");
    vi.stubEnv("LOCAL_OTP_CODE", "135790");

    requestOtpAction({ email: "local-main@medibridge.test" });

    expect(() =>
      consumeOtpCode({
        email: "local-main@medibridge.test",
        code: "135790",
      })
    ).toThrowError("Invalid OTP code");
    expect(() =>
      consumeOtpCode({
        email: "local-main@medibridge.test",
        code: "000042",
      })
    ).not.toThrow();
  });
});
