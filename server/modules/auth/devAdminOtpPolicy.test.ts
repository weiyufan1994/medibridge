import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDevAdminOtpCode } from "./devAdminOtpPolicy";

const enabledDevAdminEnvironment = {
  MEDIBRIDGE_RELEASE_CHANNEL: "dev",
  DEV_ADMIN_OTP_ENABLED: "true",
  DEV_ADMIN_OTP_EMAIL: "admin@medibridge.test",
  DEV_ADMIN_OTP_CODE: "864209",
};

describe("dev admin OTP policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the server-only profile from the runtime environment", () => {
    vi.stubEnv("MEDIBRIDGE_RELEASE_CHANNEL", "dev");
    vi.stubEnv("DEV_ADMIN_OTP_ENABLED", "true");
    vi.stubEnv("DEV_ADMIN_OTP_EMAIL", "admin@medibridge.test");
    vi.stubEnv("DEV_ADMIN_OTP_CODE", "864209");

    expect(resolveDevAdminOtpCode({ email: "admin@medibridge.test" })).toBe(
      "864209"
    );
  });

  it("returns the independent code for the configured admin on dev", () => {
    expect(
      resolveDevAdminOtpCode({
        email: " Admin@MediBridge.Test ",
        env: enabledDevAdminEnvironment,
      })
    ).toBe("864209");
  });

  it.each(["main", "local", "unknown", "feature/admin", ""])(
    "fails closed for the %s release channel",
    releaseChannel => {
      expect(
        resolveDevAdminOtpCode({
          email: "admin@medibridge.test",
          env: {
            ...enabledDevAdminEnvironment,
            MEDIBRIDGE_RELEASE_CHANNEL: releaseChannel,
          },
        })
      ).toBeNull();
    }
  );

  it("rejects every email except the single configured admin", () => {
    expect(
      resolveDevAdminOtpCode({
        email: "other@medibridge.test",
        env: enabledDevAdminEnvironment,
      })
    ).toBeNull();
  });

  it("rejects a comma-separated admin configuration", () => {
    expect(
      resolveDevAdminOtpCode({
        email: "admin@medibridge.test",
        env: {
          ...enabledDevAdminEnvironment,
          DEV_ADMIN_OTP_EMAIL: "admin@medibridge.test,other@medibridge.test",
        },
      })
    ).toBeNull();
  });

  it.each([
    ["false", "864209"],
    ["TRUE-ish", "864209"],
    ["true", "12345"],
    ["true", "1234567"],
    ["true", "abcdef"],
    ["true", ""],
  ])("rejects disabled or invalid admin configuration", (enabled, code) => {
    expect(
      resolveDevAdminOtpCode({
        email: "admin@medibridge.test",
        env: {
          ...enabledDevAdminEnvironment,
          DEV_ADMIN_OTP_ENABLED: enabled,
          DEV_ADMIN_OTP_CODE: code,
        },
      })
    ).toBeNull();
  });
});
