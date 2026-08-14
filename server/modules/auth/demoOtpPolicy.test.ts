import { describe, expect, it } from "vitest";
import { resolveDemoOtpCode } from "./demoOtpPolicy";

const enabledDevEnvironment = {
  MEDIBRIDGE_RELEASE_CHANNEL: "dev",
  DEMO_OTP_ENABLED: "true",
  DEMO_OTP_EMAILS: "demo@medibridge.test, second@medibridge.test",
  DEMO_OTP_CODE: "482731",
};

describe("demo OTP policy", () => {
  it("returns the fixed code for an allowlisted email on the dev release", () => {
    expect(
      resolveDemoOtpCode({
        email: " Demo@MediBridge.Test ",
        env: enabledDevEnvironment,
      })
    ).toBe("482731");
  });

  it.each(["main", "unknown", "feature/demo", ""])(
    "fails closed for the %s release channel",
    releaseChannel => {
      expect(
        resolveDemoOtpCode({
          email: "demo@medibridge.test",
          env: {
            ...enabledDevEnvironment,
            MEDIBRIDGE_RELEASE_CHANNEL: releaseChannel,
          },
        })
      ).toBeNull();
    }
  );

  it("rejects emails outside the explicit allowlist", () => {
    expect(
      resolveDemoOtpCode({
        email: "other@medibridge.test",
        env: enabledDevEnvironment,
      })
    ).toBeNull();
  });

  it.each([
    ["false", "482731"],
    ["TRUE-ish", "482731"],
    ["true", "12345"],
    ["true", "1234567"],
    ["true", "abcdef"],
    ["true", ""],
  ])("rejects disabled or invalid configuration", (enabled, code) => {
    expect(
      resolveDemoOtpCode({
        email: "demo@medibridge.test",
        env: {
          ...enabledDevEnvironment,
          DEMO_OTP_ENABLED: enabled,
          DEMO_OTP_CODE: code,
        },
      })
    ).toBeNull();
  });
});
