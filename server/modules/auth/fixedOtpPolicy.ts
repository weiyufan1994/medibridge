import { resolveDemoOtpCode } from "./demoOtpPolicy";
import { resolveDevAdminOtpCode } from "./devAdminOtpPolicy";

const LOCAL_RELEASE_CHANNEL = "local";
const DEVELOPMENT_NODE_ENV = "development";
const ENABLED_VALUE = "true";
const OTP_CODE_PATTERN = /^\d{6}$/;

type FixedOtpEnvironment = Pick<
  NodeJS.ProcessEnv,
  | "NODE_ENV"
  | "MEDIBRIDGE_RELEASE_CHANNEL"
  | "DEMO_OTP_ENABLED"
  | "DEMO_OTP_EMAILS"
  | "DEMO_OTP_CODE"
  | "DEV_ADMIN_OTP_ENABLED"
  | "DEV_ADMIN_OTP_EMAIL"
  | "DEV_ADMIN_OTP_CODE"
  | "LOCAL_OTP_ENABLED"
  | "LOCAL_OTP_EMAILS"
  | "LOCAL_OTP_CODE"
>;

function readFixedOtpEnvironment(): FixedOtpEnvironment {
  return {
    NODE_ENV: process.env.NODE_ENV,
    MEDIBRIDGE_RELEASE_CHANNEL: process.env.MEDIBRIDGE_RELEASE_CHANNEL,
    DEMO_OTP_ENABLED: process.env.DEMO_OTP_ENABLED,
    DEMO_OTP_EMAILS: process.env.DEMO_OTP_EMAILS,
    DEMO_OTP_CODE: process.env.DEMO_OTP_CODE,
    DEV_ADMIN_OTP_ENABLED: process.env.DEV_ADMIN_OTP_ENABLED,
    DEV_ADMIN_OTP_EMAIL: process.env.DEV_ADMIN_OTP_EMAIL,
    DEV_ADMIN_OTP_CODE: process.env.DEV_ADMIN_OTP_CODE,
    LOCAL_OTP_ENABLED: process.env.LOCAL_OTP_ENABLED,
    LOCAL_OTP_EMAILS: process.env.LOCAL_OTP_EMAILS,
    LOCAL_OTP_CODE: process.env.LOCAL_OTP_CODE,
  };
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map(normalizeEmail).filter(Boolean));
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === ENABLED_VALUE;
}

function hasEnabledAllowlistOverlap(
  email: string,
  env: FixedOtpEnvironment
): boolean {
  if (!isEnabled(env.DEMO_OTP_ENABLED) || !isEnabled(env.LOCAL_OTP_ENABLED)) {
    return false;
  }

  const normalizedEmail = normalizeEmail(email);
  return (
    parseAllowedEmails(env.DEMO_OTP_EMAILS).has(normalizedEmail) &&
    parseAllowedEmails(env.LOCAL_OTP_EMAILS).has(normalizedEmail)
  );
}

function hasSeparatedDevProfiles(env: FixedOtpEnvironment): boolean {
  if (
    !isEnabled(env.DEMO_OTP_ENABLED) ||
    !isEnabled(env.DEV_ADMIN_OTP_ENABLED)
  ) {
    return true;
  }

  const adminEmail = normalizeEmail(env.DEV_ADMIN_OTP_EMAIL ?? "");
  const demoCode = env.DEMO_OTP_CODE?.trim() ?? "";
  const adminCode = env.DEV_ADMIN_OTP_CODE?.trim() ?? "";
  return (
    Boolean(adminEmail) &&
    !parseAllowedEmails(env.DEMO_OTP_EMAILS).has(adminEmail) &&
    demoCode !== adminCode
  );
}

export function resolveLocalOtpCode(input: {
  email: string;
  env?: FixedOtpEnvironment;
}): string | null {
  const env = input.env ?? readFixedOtpEnvironment();
  if (env.NODE_ENV?.trim() !== DEVELOPMENT_NODE_ENV) {
    return null;
  }
  if (env.MEDIBRIDGE_RELEASE_CHANNEL?.trim() !== LOCAL_RELEASE_CHANNEL) {
    return null;
  }
  if (env.LOCAL_OTP_ENABLED?.trim().toLowerCase() !== ENABLED_VALUE) {
    return null;
  }

  const code = env.LOCAL_OTP_CODE?.trim() ?? "";
  if (!OTP_CODE_PATTERN.test(code)) {
    return null;
  }

  const allowedEmails = parseAllowedEmails(env.LOCAL_OTP_EMAILS);
  return allowedEmails.has(normalizeEmail(input.email)) ? code : null;
}

export function resolveFixedOtpCode(input: {
  email: string;
  env?: FixedOtpEnvironment;
}): string | null {
  const env = input.env ?? readFixedOtpEnvironment();
  if (!hasSeparatedDevProfiles(env)) {
    return null;
  }
  if (hasEnabledAllowlistOverlap(input.email, env)) {
    return null;
  }
  const candidates = [
    resolveDemoOtpCode({ email: input.email, env }),
    resolveDevAdminOtpCode({ email: input.email, env }),
    resolveLocalOtpCode({ email: input.email, env }),
  ].filter((code): code is string => code !== null);

  return candidates.length === 1 ? candidates[0] : null;
}
