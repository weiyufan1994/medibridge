import { afterEach, describe, expect, it, vi } from "vitest";

describe("data adapter logging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.doUnmock("pg");
    vi.doUnmock("drizzle-orm/node-postgres");
    vi.doUnmock("./_core/env");
    vi.resetModules();
  });

  it("protects database connection failures", async () => {
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://private-user:private-password@database.example/medical"
    );
    vi.doMock("pg", () => ({
      Pool: class {
        constructor() {
          throw new Error(
            "postgresql://private-user:private-password@database.example/medical"
          );
        }
      },
    }));
    vi.doMock("drizzle-orm/node-postgres", () => ({ drizzle: vi.fn() }));
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getDb } = await import("./db");

    await expect(getDb()).resolves.toBeNull();

    const logged = String(consoleWarn.mock.calls[0]?.[0]);
    expect(JSON.parse(logged)).toMatchObject({
      component: "database",
      event: "connection_failed",
      errorName: "Error",
    });
    expect(logged).not.toContain("private-user");
    expect(logged).not.toContain("private-password");
    expect(logged).not.toContain("database.example");
  });

  it("logs local storage fallback without configuration values", async () => {
    vi.doMock("./_core/env", () => ({
      ENV: {
        forgeApiUrl: "",
        forgeApiKey: "",
      },
    }));
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { storageGet } = await import("./storage");

    await expect(storageGet("reports/summary.pdf")).resolves.toEqual({
      key: "reports/summary.pdf",
      url: "/uploads/reports/summary.pdf",
    });

    expect(consoleWarn).toHaveBeenCalledOnce();
    expect(JSON.parse(String(consoleWarn.mock.calls[0]?.[0]))).toMatchObject({
      component: "storage",
      event: "local_fallback_enabled",
      reason: "missing_config",
    });
  });
});
