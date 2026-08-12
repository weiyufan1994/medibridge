import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logBuildDirectoryMissing,
  logPortFallback,
  logServerStarted,
  logServerStartFailed,
} from "./runtimeLogging";

describe("runtime logging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records port selection without embedding a server URL", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

    logPortFallback(3000, 3001);
    logServerStarted(3001);

    expect(JSON.parse(String(consoleWarn.mock.calls[0]?.[0]))).toMatchObject({
      component: "server-runtime",
      event: "port_fallback",
      preferredPort: 3000,
      port: 3001,
    });
    expect(JSON.parse(String(consoleInfo.mock.calls[0]?.[0]))).toMatchObject({
      component: "server-runtime",
      event: "server_started",
      port: 3001,
    });
  });

  it("records startup failures without error messages", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const secret = "postgresql://private-user:password@database.example/app";

    logServerStartFailed(new TypeError(secret));
    logBuildDirectoryMissing();

    const failureLog = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(failureLog)).toMatchObject({
      component: "server-runtime",
      event: "server_start_failed",
      errorName: "TypeError",
    });
    expect(failureLog).not.toContain("private-user");
    expect(failureLog).not.toContain("database.example");
    expect(JSON.parse(String(consoleError.mock.calls[1]?.[0]))).toMatchObject({
      component: "server-runtime",
      event: "build_directory_missing",
    });
  });
});
