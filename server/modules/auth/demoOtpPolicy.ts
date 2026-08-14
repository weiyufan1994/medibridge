const DEV_RELEASE_CHANNEL = "dev";
const ENABLED_VALUE = "true";
const OTP_CODE_PATTERN = /^\d{6}$/;

type DemoOtpEnvironment = Pick<
  NodeJS.ProcessEnv,
  | "MEDIBRIDGE_RELEASE_CHANNEL"
  | "DEMO_OTP_ENABLED"
  | "DEMO_OTP_EMAILS"
  | "DEMO_OTP_CODE"
>;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set((value ?? "").split(",").map(normalizeEmail).filter(Boolean));
}

export function resolveDemoOtpCode(input: {
  email: string;
  env?: DemoOtpEnvironment;
}): string | null {
  const env = input.env ?? process.env;
  if (env.MEDIBRIDGE_RELEASE_CHANNEL?.trim() !== DEV_RELEASE_CHANNEL) {
    return null;
  }
  if (env.DEMO_OTP_ENABLED?.trim().toLowerCase() !== ENABLED_VALUE) {
    return null;
  }

  const code = env.DEMO_OTP_CODE?.trim() ?? "";
  if (!OTP_CODE_PATTERN.test(code)) {
    return null;
  }

  const allowedEmails = parseAllowedEmails(env.DEMO_OTP_EMAILS);
  return allowedEmails.has(normalizeEmail(input.email)) ? code : null;
}
