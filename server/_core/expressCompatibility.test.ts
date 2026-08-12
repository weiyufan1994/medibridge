import { initTRPC } from "@trpc/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express, { type Express, type RequestHandler } from "express";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { registerHttpMiddleware } from "./httpMiddleware";
import { registerOAuthRoutes } from "./oauth";
import { serveStatic, setupVite } from "./vite";

type TestServer = {
  baseUrl: string;
  server: Server;
};

async function startTestServer(app: Express): Promise<TestServer> {
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

async function closeTestServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
}

function createHttpApp(
  overrides: Partial<Parameters<typeof registerHttpMiddleware>[1]> = {}
) {
  const app = express();
  registerHttpMiddleware(app, {
    handleStripeWebhook: (_req, res) => res.sendStatus(204),
    handlePaypalWebhook: (_req, res) => res.sendStatus(204),
    registerOAuthRoutes: () => undefined,
    trpcMiddleware: ((_req, _res, next) => next()) as RequestHandler,
    ...overrides,
  });
  return app;
}

describe("Express HTTP compatibility", () => {
  it.each([
    ["Stripe", "/api/payments/stripe/webhook"],
    ["PayPal", "/api/payments/paypal/webhook"],
  ])("preserves the raw request body for %s webhooks", async (_name, path) => {
    const payload = '{"id":"evt_raw","amount":"2900"}';
    let receivedBody: unknown;
    const handler = vi.fn((req, res) => {
      receivedBody = req.body;
      res.status(202).json({ ok: true });
    });
    const app = createHttpApp(
      path.includes("stripe")
        ? { handleStripeWebhook: handler }
        : { handlePaypalWebhook: handler }
    );
    const { baseUrl, server } = await startTestServer(app);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
      });

      expect(response.status).toBe(202);
      expect(handler).toHaveBeenCalledOnce();
      expect(Buffer.isBuffer(receivedBody)).toBe(true);
      expect((receivedBody as Buffer).equals(Buffer.from(payload))).toBe(true);
    } finally {
      await closeTestServer(server);
    }
  });

  it("mounts the tRPC middleware at the existing path", async () => {
    const t = initTRPC.create();
    const router = t.router({
      ping: t.procedure.query(() => ({ ok: true })),
    });
    const app = createHttpApp({
      trpcMiddleware: createExpressMiddleware({ router }),
    });
    const { baseUrl, server } = await startTestServer(app);

    try {
      const response = await fetch(`${baseUrl}/api/trpc/ping`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        result: { data: { ok: true } },
      });
    } finally {
      await closeTestServer(server);
    }
  });

  it("keeps the OAuth callback route and missing-parameter response", async () => {
    const app = createHttpApp({
      registerOAuthRoutes: targetApp =>
        registerOAuthRoutes(targetApp, { upsertUser: vi.fn() }),
    });
    const { baseUrl, server } = await startTestServer(app);

    try {
      const response = await fetch(`${baseUrl}/api/oauth/callback?code=only`);

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "code and state are required",
      });
    } finally {
      await closeTestServer(server);
    }
  });

  it("preserves Express default 404 and error responses", async () => {
    const app = createHttpApp();
    app.get("/error", () => {
      throw new Error("compatibility-test-error");
    });
    const { baseUrl, server } = await startTestServer(app);

    try {
      const missingResponse = await fetch(`${baseUrl}/missing`);
      const errorResponse = await fetch(`${baseUrl}/error`);

      expect(missingResponse.status).toBe(404);
      expect(missingResponse.headers.get("content-type")).toContain(
        "text/html"
      );
      expect(errorResponse.status).toBe(500);
      expect(errorResponse.headers.get("content-type")).toContain("text/html");
    } finally {
      await closeTestServer(server);
    }
  });

  it("mounts Vite middleware before the development SPA fallback", async () => {
    const app = express();
    const server = createServer(app);
    const transformIndexHtml = vi.fn(
      async (_url: string, html: string) => html
    );
    const viteMiddleware: RequestHandler = (req, res, next) => {
      if (req.path === "/@vite/client") {
        res.status(200).send("vite-client");
        return;
      }
      next();
    };

    await setupVite(app, server, async () => ({
      createViteServer: vi.fn(async () => ({
        middlewares: viteMiddleware,
        transformIndexHtml,
        ssrFixStacktrace: vi.fn(),
      })) as never,
      viteConfig: {},
    }));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const viteResponse = await fetch(`${baseUrl}/@vite/client`);
      const spaResponse = await fetch(`${baseUrl}/triage`);

      expect(await viteResponse.text()).toBe("vite-client");
      expect(spaResponse.status).toBe(200);
      expect(await spaResponse.text()).toContain("/src/main.tsx?v=");
      expect(transformIndexHtml).toHaveBeenCalledWith(
        "/triage",
        expect.stringContaining("/src/main.tsx?v=")
      );
    } finally {
      await closeTestServer(server);
    }
  });

  it("preserves the production static SPA fallback", async () => {
    const distPath = await mkdtemp(path.join(tmpdir(), "medibridge-static-"));
    await writeFile(path.join(distPath, "index.html"), "production-spa");
    const app = express();
    serveStatic(app, distPath);
    const { baseUrl, server } = await startTestServer(app);

    try {
      const response = await fetch(`${baseUrl}/patient/appointments`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("production-spa");
    } finally {
      await closeTestServer(server);
      await rm(distPath, { recursive: true });
    }
  });
});
