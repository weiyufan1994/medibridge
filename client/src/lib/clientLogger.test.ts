import { afterEach, describe, expect, it, vi } from "vitest";
import { createClientLogger } from "./clientLogger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("client logger", () => {
  it("emits structured error metadata without messages or stacks", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createClientLogger("ai-triage");
    const error = Object.assign(
      new Error(
        "Bearer visit-token for patient@example.com at https://app.test?t=secret"
      ),
      { data: { code: "UNAUTHORIZED" } }
    );

    logger.error("message.send_failed", error);

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      level: "error",
      component: "ai-triage",
      event: "message.send_failed",
      errorName: "Error",
      errorCode: "UNAUTHORIZED",
    });
    expect(serialized).not.toContain("visit-token");
    expect(serialized).not.toContain("patient@example.com");
    expect(serialized).not.toContain("app.test");
    expect(serialized).not.toContain("secret");
  });

  it("rejects unsafe labels and error codes without reading error details", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createClientLogger("component patient@example.com");
    const error = {
      name: "Error patient@example.com",
      message: "token=must-not-appear",
      code: "TOP_SECRET_TOKEN",
    };

    logger.error("event token=must-not-appear", error);

    const serialized = String(output.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "client",
      event: "error.unclassified",
      errorName: "UnknownError",
    });
    expect(serialized).not.toContain("patient@example.com");
    expect(serialized).not.toContain("must-not-appear");
    expect(serialized).not.toContain("TOP_SECRET_TOKEN");
  });

  it("handles hostile error objects without throwing or exposing getters", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const logger = createClientLogger("api-client");
    const error = Object.defineProperty({}, "name", {
      get: () => {
        throw new Error("getter-secret");
      },
    });

    expect(() => logger.error("query.failed", error)).not.toThrow();
    const serialized = String(output.mock.calls[0]?.[0]);
    expect(serialized).toContain("UnknownError");
    expect(serialized).not.toContain("getter-secret");
  });
});
