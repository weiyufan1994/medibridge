import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getLocalUploadDir } from "../storage";
import { handleStripeWebhook } from "../stripeWebhookRoute";
import { createVisitRealtimeGateway } from "../modules/visit/realtimeGateway";
import { startAppointmentAutoCloseWorker } from "../modules/appointments/autoCloseWorker";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const visitRealtimeGateway = createVisitRealtimeGateway();
  const stopAppointmentAutoCloseWorker = startAppointmentAutoCloseWorker();
  app.set("trust proxy", true);
  app.use("/uploads", express.static(getLocalUploadDir()));
  app.post(
    "/api/payments/stripe/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => {
      void handleStripeWebhook(req, res);
    }
  );
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  server.on("upgrade", (req, socket, head) => {
    void visitRealtimeGateway.handleUpgrade(req, socket, head);
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  process.on("SIGTERM", () => {
    stopAppointmentAutoCloseWorker();
    visitRealtimeGateway.shutdown();
    server.close();
  });
}

startServer().catch(console.error);
