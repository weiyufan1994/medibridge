import { describe, expect, it } from "vitest";
import { resolveFixedOtpCode, resolveLocalOtpCode } from "./fixedOtpPolicy";

const enabledLocalEnvironment = {
  NODE_ENV: "development",
  MEDIBRIDGE_RELEASE_CHANNEL: "local",
  LOCAL_OTP_ENABLED: "true",
  LOCAL_OTP_EMAILS: "local@medibridge.test, second@medibridge.test",
  LOCAL_OTP_CODE: "135790",
};

describe("fixed OTP policy", () => {
  it("returns the local code for an allowlisted email in pnpm dev", () => {
    expect(
      resolveLocalOtpCode({
        email: " Local@MediBridge.Test ",
        env: enabledLocalEnvironment,
      })
    ).toBe("135790");
  });

  it.each(["dev", "main", "unknown", ""])(
    "rejects the local code for the %s release channel",
    releaseChannel => {
      expect(
        resolveLocalOtpCode({
          email: "local@medibridge.test",
          env: {
            ...enabledLocalEnvironment,
            MEDIBRIDGE_RELEASE_CHANNEL: releaseChannel,
          },
        })
      ).toBeNull();
    }
  );

  it("rejects the local code outside development mode", () => {
    expect(
      resolveLocalOtpCode({
        email: "local@medibridge.test",
        env: { ...enabledLocalEnvironment, NODE_ENV: "production" },
      })
    ).toBeNull();
  });

  it("rejects emails outside the local allowlist", () => {
    expect(
      resolveLocalOtpCode({
        email: "other@medibridge.test",
        env: enabledLocalEnvironment,
      })
    ).toBeNull();
  });

  it.each([
    ["false", "135790"],
    ["TRUE-ish", "135790"],
    ["true", "12345"],
    ["true", "1234567"],
    ["true", "abcdef"],
    ["true", ""],
  ])("rejects disabled or invalid local configuration", (enabled, code) => {
    expect(
      resolveLocalOtpCode({
        email: "local@medibridge.test",
        env: {
          ...enabledLocalEnvironment,
          LOCAL_OTP_ENABLED: enabled,
          LOCAL_OTP_CODE: code,
        },
      })
    ).toBeNull();
  });

  it("preserves the existing fixed demo code on the dev release", () => {
    expect(
      resolveFixedOtpCode({
        email: "demo@medibridge.test",
        env: {
          NODE_ENV: "production",
          MEDIBRIDGE_RELEASE_CHANNEL: "dev",
          DEMO_OTP_ENABLED: "true",
          DEMO_OTP_EMAILS: "demo@medibridge.test",
          DEMO_OTP_CODE: "482731",
        },
      })
    ).toBe("482731");
  });

  it("keeps the public demo and dev admin codes independent", () => {
    const env = {
      NODE_ENV: "production",
      MEDIBRIDGE_RELEASE_CHANNEL: "dev",
      DEMO_OTP_ENABLED: "true",
      DEMO_OTP_EMAILS: "demo@medibridge.test",
      DEMO_OTP_CODE: "482731",
      DEV_ADMIN_OTP_ENABLED: "true",
      DEV_ADMIN_OTP_EMAIL: "admin@medibridge.test",
      DEV_ADMIN_OTP_CODE: "864209",
    };

    expect(resolveFixedOtpCode({ email: "demo@medibridge.test", env })).toBe(
      "482731"
    );
    expect(resolveFixedOtpCode({ email: "admin@medibridge.test", env })).toBe(
      "864209"
    );
  });

  it("fails closed when the dev admin email enters the demo allowlist", () => {
    expect(
      resolveFixedOtpCode({
        email: "admin@medibridge.test",
        env: {
          NODE_ENV: "production",
          MEDIBRIDGE_RELEASE_CHANNEL: "dev",
          DEMO_OTP_ENABLED: "true",
          DEMO_OTP_EMAILS: "demo@medibridge.test,admin@medibridge.test",
          DEMO_OTP_CODE: "482731",
          DEV_ADMIN_OTP_ENABLED: "true",
          DEV_ADMIN_OTP_EMAIL: "admin@medibridge.test",
          DEV_ADMIN_OTP_CODE: "864209",
        },
      })
    ).toBeNull();
  });

  it("fails closed when public demo and dev admin codes are identical", () => {
    const env = {
      NODE_ENV: "production",
      MEDIBRIDGE_RELEASE_CHANNEL: "dev",
      DEMO_OTP_ENABLED: "true",
      DEMO_OTP_EMAILS: "demo@medibridge.test",
      DEMO_OTP_CODE: "482731",
      DEV_ADMIN_OTP_ENABLED: "true",
      DEV_ADMIN_OTP_EMAIL: "admin@medibridge.test",
      DEV_ADMIN_OTP_CODE: "482731",
    };

    expect(
      resolveFixedOtpCode({ email: "demo@medibridge.test", env })
    ).toBeNull();
    expect(
      resolveFixedOtpCode({ email: "admin@medibridge.test", env })
    ).toBeNull();
  });

  it("fails closed when enabled local and demo allowlists overlap", () => {
    expect(
      resolveFixedOtpCode({
        email: "shared@medibridge.test",
        env: {
          ...enabledLocalEnvironment,
          LOCAL_OTP_EMAILS: "shared@medibridge.test",
          DEMO_OTP_ENABLED: "true",
          DEMO_OTP_EMAILS: "shared@medibridge.test",
          DEMO_OTP_CODE: "482731",
        },
      })
    ).toBeNull();
  });
});
