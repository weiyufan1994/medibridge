import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const app = { set: vi.fn(), use: vi.fn() };
  const express = Object.assign(
    vi.fn(() => app),
    {
      static: vi.fn(() => vi.fn()),
    }
  );
  const server = {
    on: vi.fn(),
    listen: vi.fn((_port: number, callback: () => void) => callback()),
    close: vi.fn(),
  };
  const portProbe = {
    listen: vi.fn((_port: number, callback: () => void) => callback()),
    close: vi.fn((callback: () => void) => callback()),
    on: vi.fn(),
  };

  return {
    app,
    express,
    server,
    portProbe,
    gateway: { handleUpgrade: vi.fn(), shutdown: vi.fn() },
    stopAppointment: vi.fn(),
    stopFulfillment: vi.fn(),
    stopNotification: vi.fn(),
    stopRetention: vi.fn(),
    startAppointment: vi.fn(),
    startFulfillment: vi.fn(),
    startNotification: vi.fn(),
    startRetention: vi.fn(),
  };
});

vi.mock("./loadEnv", () => ({}));
vi.mock("express", () => ({ default: mocks.express }));
vi.mock("http", () => ({ createServer: vi.fn(() => mocks.server) }));
vi.mock("net", () => ({
  default: { createServer: vi.fn(() => mocks.portProbe) },
}));
vi.mock("@trpc/server/adapters/express", () => ({
  createExpressMiddleware: vi.fn(() => vi.fn()),
}));
vi.mock("./oauth", () => ({ registerOAuthRoutes: vi.fn() }));
vi.mock("../routers", () => ({ appRouter: {} }));
vi.mock("./context", () => ({ createContext: vi.fn() }));
vi.mock("./vite", () => ({ serveStatic: vi.fn(), setupVite: vi.fn() }));
vi.mock("../storage", () => ({ getLocalUploadDir: vi.fn(() => "/tmp") }));
vi.mock("../stripeWebhookRoute", () => ({ handleStripeWebhook: vi.fn() }));
vi.mock("../paypalWebhookRoute", () => ({ handlePaypalWebhook: vi.fn() }));
vi.mock("../modules/visit/realtimeGateway", () => ({
  createVisitRealtimeGateway: vi.fn(() => mocks.gateway),
}));
vi.mock("../workflows/appointmentAutoClose/publicApi", () => ({
  startAppointmentAutoCloseWorker: mocks.startAppointment,
}));
vi.mock("../modules/referrals/fulfillmentWorker", () => ({
  startReferralFulfillmentWorker: mocks.startFulfillment,
}));
vi.mock("../modules/referrals/notificationWorker", () => ({
  startReferralNotificationWorker: mocks.startNotification,
}));
vi.mock("../modules/admin/retentionCleanupWorker", () => ({
  startRetentionCleanupWorker: mocks.startRetention,
}));
vi.mock("../modules/auth/publicApi", () => ({
  authOAuthApi: {},
  authSessionApi: {},
}));
vi.mock("./requestId", () => ({ requestIdMiddleware: vi.fn() }));
vi.mock("./httpMiddleware", () => ({ registerHttpMiddleware: vi.fn() }));
vi.mock("./runtimeLogging", () => ({
  logPortFallback: vi.fn(),
  logServerStarted: vi.fn(),
  logServerStartFailed: vi.fn(),
}));

describe("server worker lifecycle composition", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("starts and stops the retention worker with the other runtime workers", async () => {
    mocks.startAppointment.mockReturnValue(mocks.stopAppointment);
    mocks.startFulfillment.mockReturnValue(mocks.stopFulfillment);
    mocks.startNotification.mockReturnValue(mocks.stopNotification);
    mocks.startRetention.mockReturnValue(mocks.stopRetention);
    let terminate: NodeJS.SignalsListener | undefined;
    vi.spyOn(process, "on").mockImplementation((event, listener) => {
      if (event === "SIGTERM") {
        terminate = listener as NodeJS.SignalsListener;
      }
      return process;
    });

    await import("./index");
    await vi.waitFor(() => expect(mocks.startRetention).toHaveBeenCalledOnce());

    terminate?.("SIGTERM");

    expect(mocks.stopAppointment).toHaveBeenCalledOnce();
    expect(mocks.stopFulfillment).toHaveBeenCalledOnce();
    expect(mocks.stopNotification).toHaveBeenCalledOnce();
    expect(mocks.stopRetention).toHaveBeenCalledOnce();
    expect(mocks.gateway.shutdown).toHaveBeenCalledOnce();
    expect(mocks.server.close).toHaveBeenCalledOnce();
  });
});
