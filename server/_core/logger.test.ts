import { afterEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("structured logger", () => {
  it("emits structured fields and redacts secrets recursively", () => {
    const output = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger("payments", { requestId: "request-123" });

    logger.info("checkout.created", {
      authorization: "Bearer top-secret",
      databaseUrl: "postgresql://user:password@db.example/medibridge",
      nested: {
        apiKey: "api-secret",
        email: "patient@example.com",
      },
      redirectUrl: "https://app.example/success?token=url-secret",
    });

    const serialized = String(output.mock.calls[0]?.[0]);
    const payload = JSON.parse(serialized);

    expect(payload).toMatchObject({
      level: "info",
      component: "payments",
      event: "checkout.created",
      requestId: "request-123",
      authorization: "[REDACTED]",
      databaseUrl: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", email: "[REDACTED]" },
    });
    expect(serialized).not.toContain("top-secret");
    expect(serialized).not.toContain("patient@example.com");
    expect(serialized).not.toContain("url-secret");
    expect(serialized).not.toContain("user:password");
  });

  it("serializes errors without exposing sensitive message values", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createLogger("auth");

    logger.error("session.failed", {
      error: new Error("Bearer session-secret for patient@example.com"),
    });

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).toContain("session.failed");
    expect(serialized).not.toContain("session-secret");
    expect(serialized).not.toContain("patient@example.com");
  });

  it("falls back safely when a log field cannot be read", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logger = createLogger("workers");
    const fields = Object.defineProperty({}, "unsafe", {
      enumerable: true,
      get: () => {
        throw new Error("getter-secret");
      },
    });

    expect(() => logger.warn("tick.failed", fields)).not.toThrow();
    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).toContain("Failed to serialize log fields");
    expect(serialized).not.toContain("getter-secret");
  });
});
