type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

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

async function sendViaSmtp(payload: MailPayload, _config: SmtpConfig): Promise<void> {
  // SMTP skeleton: plug nodemailer/sendmail provider here in production.
  console.warn("[Mailer] SMTP config is present but SMTP transport is not implemented yet.");
  console.log(`[Mailer] Prepared SMTP message to ${payload.to} with subject: ${payload.subject}`);
}

export async function sendMagicLinkEmail(to: string, link: string): Promise<void> {
  const subject = "Your MediBridge appointment access link";
  const text = `Use this secure link to view and manage your appointment: ${link}`;
  const html = `<p>Use this secure link to view and manage your appointment:</p><p><a href=\"${link}\">${link}</a></p>`;

  if (process.env.NODE_ENV !== "production") {
    console.log(`[Mailer][DEV] To: ${to}`);
    console.log(`[Mailer][DEV] Magic link: ${link}`);
    return;
  }

  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    console.warn("[Mailer] SMTP is not configured. Set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM.");
    return;
  }

  await sendViaSmtp(
    {
      to,
      subject,
      text,
      html,
    },
    smtpConfig
  );
}
