import { createLogger } from "./logger";

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const logger = createLogger("mailer");

type ResendConfig = {
  apiKey: string;
  from: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (process.env.RESEND_FROM ?? process.env.MAIL_FROM)?.trim();

  if (!apiKey || !from) {
    return null;
  }

  return {
    apiKey,
    from,
  };
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.MAIL_FROM?.trim();

  if (!host || !portRaw || !user || !pass || !from) {
    return null;
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from,
  };
}

function normalizeFromAddress(from: string): string {
  return from.trim();
}

async function sendViaResend(
  payload: MailPayload,
  config: ResendConfig
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: normalizeFromAddress(config.from),
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Failed to send email: ${response.status} ${response.statusText}${
        detail ? ` - ${detail}` : ""
      }`
    );
  }
}

async function sendViaSmtp(
  payload: MailPayload,
  _config: SmtpConfig
): Promise<void> {
  // SMTP placeholder kept for local debugging and future expansion.
  // Production path now prefers Resend API and does not use SMTP.
  logger.warn("smtp.transport_unimplemented");
  logger.info("smtp.message_prepared");
}

async function sendConfiguredMail(
  payload: MailPayload,
  config: ResendConfig,
  messageType: "magic_link" | "transactional" | "doctor_invite"
) {
  try {
    await sendViaResend(payload, config);
  } catch (error) {
    logger.error("send.failed", { provider: "resend", messageType });
    throw error;
  }
}

export async function sendMagicLinkEmail(
  to: string,
  link: string
): Promise<void> {
  const subject = "Your MediBridge appointment access link";
  const text = `Use this secure link to view and manage your appointment: ${link}`;
  const html = `<p>Use this secure link to view and manage your appointment:</p><p><a href=\"${link}\">${link}</a></p>`;

  if (process.env.NODE_ENV !== "production") {
    logger.info("magic_link.preview_suppressed");
    return;
  }

  const config = getResendConfig();
  if (!config) {
    logger.warn("configuration.missing", { provider: "resend" });
    if (getSmtpConfig()) {
      logger.warn("smtp.fallback_unavailable");
    }
    throw new Error(
      "Email provider is not configured for production. Set RESEND_API_KEY."
    );
  }

  await sendConfiguredMail(
    {
      to,
      subject,
      text,
      html,
    },
    config,
    "magic_link"
  );
}

export async function sendTransactionalEmail(
  payload: MailPayload
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    logger.info("transactional.preview_suppressed");
    return;
  }

  const config = getResendConfig();
  if (!config) {
    logger.warn("configuration.missing", { provider: "resend" });
    throw new Error(
      "Email provider is not configured for production. Set RESEND_API_KEY."
    );
  }

  await sendConfiguredMail(payload, config, "transactional");
}

export async function sendDoctorInviteEmail(
  to: string,
  claimUrl: string,
  input: { expiresAt: Date }
): Promise<void> {
  const expiresAt = input.expiresAt.toISOString();
  const subject = "Your MediBridge doctor workbench invite";
  const text =
    `You have been invited to activate your MediBridge doctor workbench.\n` +
    `Sign in with this email address, then complete the claim here: ${claimUrl}\n` +
    `This link expires at ${expiresAt}.`;
  const html =
    `<p>You have been invited to activate your MediBridge doctor workbench.</p>` +
    `<p>Please sign in with this email address, then complete the claim here:</p>` +
    `<p><a href="${claimUrl}">${claimUrl}</a></p>` +
    `<p>This invite expires at ${expiresAt}.</p>`;

  if (process.env.NODE_ENV !== "production") {
    logger.info("doctor_invite.preview_suppressed", { expiresAt });
    return;
  }

  const config = getResendConfig();
  if (!config) {
    logger.warn("configuration.missing", { provider: "resend" });
    if (getSmtpConfig()) {
      logger.warn("smtp.fallback_unavailable");
    }
    throw new Error(
      "Email provider is not configured for production. Set RESEND_API_KEY."
    );
  }

  await sendConfiguredMail(
    {
      to,
      subject,
      text,
      html,
    },
    config,
    "doctor_invite"
  );
}
