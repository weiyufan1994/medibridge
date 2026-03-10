import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMagicLinkEmail } from "./_core/mailer";

describe("mailer", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const originalResendFrom = process.env.RESEND_FROM;
  const originalMailFrom = process.env.MAIL_FROM;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "resend_test_key";
    process.env.RESEND_FROM = "Test <no-reply@resend-test.com>";
    process.env.MAIL_FROM = "Backup <no-reply@fallback.com>";
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.RESEND_API_KEY = originalResendApiKey;
    process.env.RESEND_FROM = originalResendFrom;
    process.env.MAIL_FROM = originalMailFrom;
  });

  it("sends via Resend in production", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn(async () => ""),
    } as unknown as Response);

    await sendMagicLinkEmail("user@example.com", "https://medibridge.test/visit/1?t=token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer resend_test_key",
          "Content-Type": "application/json",
        },
      })
    );

    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1]?.body as string | undefined) ?? "{}"
    );
    expect(body).toEqual({
      from: "Test <no-reply@resend-test.com>",
      to: ["user@example.com"],
      subject: "Your MediBridge appointment access link",
      text: "Use this secure link to view and manage your appointment: https://medibridge.test/visit/1?t=token",
      html: '<p>Use this secure link to view and manage your appointment:</p><p><a href="https://medibridge.test/visit/1?t=token">https://medibridge.test/visit/1?t=token</a></p>',
    });
  });

  it("uses MAIL_FROM when RESEND_FROM is not set", async () => {
    delete process.env.RESEND_FROM;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn(async () => ""),
    } as unknown as Response);

    await sendMagicLinkEmail("user@example.com", "https://medibridge.test/visit/2?t=token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1]?.body as string | undefined) ?? "{}"
    );
    expect(body.from).toBe("Backup <no-reply@fallback.com>");
  });

  it("throws when Resend is not configured in production", async () => {
    process.env.RESEND_API_KEY = "";
    const fetchMock = vi.mocked(fetch);

    await expect(
      sendMagicLinkEmail("user@example.com", "https://medibridge.test/visit/1?t=token")
    ).rejects.toThrow("Email provider is not configured for production");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when Resend request fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: vi.fn(async () => JSON.stringify({ message: "bad_api_key" })),
    } as unknown as Response);

    await expect(
      sendMagicLinkEmail("user@example.com", "https://medibridge.test/visit/3?t=token")
    ).rejects.toThrow("Failed to send email: 401 Unauthorized");
  });

  it("skips actual send in development", async () => {
    process.env.NODE_ENV = "development";
    const fetchMock = vi.mocked(fetch);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await sendMagicLinkEmail("user@example.com", "https://medibridge.test/visit/4?t=token");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith("[Mailer][DEV] To: user@example.com");
    expect(consoleSpy).toHaveBeenCalledWith("[Mailer][DEV] Magic link: https://medibridge.test/visit/4?t=token");
  });
});
