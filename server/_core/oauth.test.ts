import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
    exchangeCodeForToken: vi.fn(),
    getUserInfo: vi.fn(),
  },
}));

vi.mock("./cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  })),
}));

import type { Request, RequestHandler, Response } from "express";
import { ONE_YEAR_MS } from "@shared/const";
import { registerOAuthRoutes } from "./oauth";
import { sdk } from "./sdk";

function registerHandler(upsertUser = vi.fn()) {
  let handler: RequestHandler | undefined;
  const app = {
    get: vi.fn((_path: string, callback: RequestHandler) => {
      handler = callback;
    }),
  };
  registerOAuthRoutes(app as never, { upsertUser });
  return {
    get handler() {
      return handler;
    },
    upsertUser,
  };
}

function createResponse() {
  const response = {
    cookie: vi.fn(),
    json: vi.fn(),
    redirect: vi.fn(),
    status: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response as unknown as Response;
}

describe("registerOAuthRoutes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects callbacks missing code or state", async () => {
    const route = registerHandler();
    const response = createResponse();

    await route.handler?.(
      { query: { code: "oauth-code" } } as unknown as Request,
      response,
      vi.fn()
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "code and state are required",
    });
    expect(sdk.exchangeCodeForToken).not.toHaveBeenCalled();
  });

  it("upserts the user, writes the session cookie, and redirects", async () => {
    const route = registerHandler();
    const response = createResponse();
    vi.mocked(sdk.exchangeCodeForToken).mockResolvedValue({
      accessToken: "access-token",
    } as never);
    vi.mocked(sdk.getUserInfo).mockResolvedValue({
      openId: "openid-7",
      name: "Patient",
      email: "patient@example.com",
      loginMethod: "google",
    } as never);
    vi.mocked(sdk.createSessionToken).mockResolvedValue("session-token");

    await route.handler?.(
      {
        query: { code: "oauth-code", state: "oauth-state" },
      } as unknown as Request,
      response,
      vi.fn()
    );

    expect(route.upsertUser).toHaveBeenCalledWith({
      openId: "openid-7",
      name: "Patient",
      email: "patient@example.com",
      loginMethod: "google",
      lastSignedIn: expect.any(Date),
    });
    expect(response.cookie).toHaveBeenCalledWith(
      "app_session_id",
      "session-token",
      expect.objectContaining({ maxAge: ONE_YEAR_MS })
    );
    expect(response.redirect).toHaveBeenCalledWith(302, "/");
  });

  it("rejects user info without an openId", async () => {
    const route = registerHandler();
    const response = createResponse();
    vi.mocked(sdk.exchangeCodeForToken).mockResolvedValue({
      accessToken: "access-token",
    } as never);
    vi.mocked(sdk.getUserInfo).mockResolvedValue({ name: "Patient" } as never);

    await route.handler?.(
      {
        query: { code: "oauth-code", state: "oauth-state" },
      } as unknown as Request,
      response,
      vi.fn()
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: "openId missing from user info",
    });
    expect(route.upsertUser).not.toHaveBeenCalled();
  });

  it("preserves the callback failure response", async () => {
    const route = registerHandler();
    const response = createResponse();
    vi.mocked(sdk.exchangeCodeForToken).mockRejectedValue(
      new Error("upstream unavailable")
    );

    await route.handler?.(
      {
        headers: { "x-request-id": "oauth-request-1" },
        query: { code: "oauth-code", state: "oauth-state" },
      } as unknown as Request,
      response,
      vi.fn()
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      error: "OAuth callback failed",
    });
  });
});
