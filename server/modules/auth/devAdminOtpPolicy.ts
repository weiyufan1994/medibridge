const DEV_RELEASE_CHANNEL = "dev";
const ENABLED_VALUE = "true";
const OTP_CODE_PATTERN = /^\d{6}$/;

export type DevAdminOtpEnvironment = Pick<
  NodeJS.ProcessEnv,
  | "MEDIBRIDGE_RELEASE_CHANNEL"
  | "DEV_ADMIN_OTP_ENABLED"
  | "DEV_ADMIN_OTP_EMAIL"
  | "DEV_ADMIN_OTP_CODE"
>;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function readDevAdminOtpEnvironment(): DevAdminOtpEnvironment {
  return {
    MEDIBRIDGE_RELEASE_CHANNEL: process.env.MEDIBRIDGE_RELEASE_CHANNEL,
    DEV_ADMIN_OTP_ENABLED: process.env.DEV_ADMIN_OTP_ENABLED,
    DEV_ADMIN_OTP_EMAIL: process.env.DEV_ADMIN_OTP_EMAIL,
    DEV_ADMIN_OTP_CODE: process.env.DEV_ADMIN_OTP_CODE,
  };
}

export function resolveDevAdminOtpCode(input: {
  email: string;
  env?: DevAdminOtpEnvironment;
}): string | null {
  const env = input.env ?? readDevAdminOtpEnvironment();
  if (env.MEDIBRIDGE_RELEASE_CHANNEL?.trim() !== DEV_RELEASE_CHANNEL) {
    return null;
  }
  if (env.DEV_ADMIN_OTP_ENABLED?.trim().toLowerCase() !== ENABLED_VALUE) {
    return null;
  }

  const configuredEmail = normalizeEmail(env.DEV_ADMIN_OTP_EMAIL ?? "");
  if (!configuredEmail || configuredEmail.includes(",")) {
    return null;
  }
  if (configuredEmail !== normalizeEmail(input.email)) {
    return null;
  }

  const code = env.DEV_ADMIN_OTP_CODE?.trim() ?? "";
  return OTP_CODE_PATTERN.test(code) ? code : null;
}
