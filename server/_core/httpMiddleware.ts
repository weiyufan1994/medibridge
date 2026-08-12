import express, {
  type Express,
  type Request,
  type RequestHandler,
  type Response,
} from "express";

type WebhookHandler = (req: Request, res: Response) => void | Promise<void>;

type HttpMiddlewareDependencies = {
  handleStripeWebhook: WebhookHandler;
  handlePaypalWebhook: WebhookHandler;
  registerOAuthRoutes: (app: Express) => void;
  trpcMiddleware: RequestHandler;
};

export function registerHttpMiddleware(
  app: Express,
  dependencies: HttpMiddlewareDependencies
) {
  app.post(
    "/api/payments/stripe/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => {
      void dependencies.handleStripeWebhook(req, res);
    }
  );
  app.post(
    "/api/payments/paypal/webhook",
    express.raw({ type: "application/json" }),
    (req, res) => {
      void dependencies.handlePaypalWebhook(req, res);
    }
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  dependencies.registerOAuthRoutes(app);
  app.use("/api/trpc", dependencies.trpcMiddleware);
}
