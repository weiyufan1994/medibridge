import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/sdk", () => ({
  sdk: {
    getUserInfoWithJwt: vi.fn(),
    verifySession: vi.fn(),
  },
}));

vi.mock("./repo", () => ({
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

import { sdk } from "../../_core/sdk";
import * as repo from "./repo";
import { authenticateRequest } from "./sessionAuthentication";

const user = {
  id: 7,
  openId: "openid-7",
  email: "patient@example.com",
  name: "Patient",
  isGuest: 0,
  deviceId: null,
  loginMethod: "oauth",
  role: "free",
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  lastSignedIn: new Date("2026-08-10T00:00:00.000Z"),
};

describe("authenticateRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("preserves the invalid-cookie error", async () => {
    vi.mocked(sdk.verifySession).mockResolvedValue(null);

    await expect(authenticateRequest("session-token")).rejects.toMatchObject({
      message: "Invalid session cookie",
      statusCode: 403,
    });
    expect(repo.getUserByOpenId).not.toHaveBeenCalled();
  });

  it("returns an existing user and refreshes lastSignedIn", async () => {
    vi.mocked(sdk.verifySession).mockResolvedValue({
      openId: "openid-7",
      appId: "medibridge",
      name: "Patient",
    });
    vi.mocked(repo.getUserByOpenId).mockResolvedValue(user as never);

    await expect(authenticateRequest("session-token")).resolves.toEqual(user);
    expect(repo.upsertUser).toHaveBeenCalledOnce();
    expect(repo.upsertUser).toHaveBeenCalledWith({
      openId: "openid-7",
      lastSignedIn: expect.any(Date),
    });
  });

  it("syncs a missing user from OAuth before returning it", async () => {
    vi.mocked(sdk.verifySession).mockResolvedValue({
      openId: "openid-7",
      appId: "medibridge",
      name: "Patient",
    });
    vi.mocked(repo.getUserByOpenId)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(user as never);
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      openId: "openid-7",
      name: "Patient",
      email: "patient@example.com",
      loginMethod: "google",
    } as never);

    await expect(authenticateRequest("session-token")).resolves.toEqual(user);
    expect(sdk.getUserInfoWithJwt).toHaveBeenCalledWith("session-token");
    expect(repo.upsertUser).toHaveBeenNthCalledWith(1, {
      openId: "openid-7",
      name: "Patient",
      email: "patient@example.com",
      loginMethod: "google",
      lastSignedIn: expect.any(Date),
    });
    expect(repo.upsertUser).toHaveBeenNthCalledWith(2, {
      openId: "openid-7",
      lastSignedIn: expect.any(Date),
    });
  });

  it("preserves the OAuth sync failure error", async () => {
    vi.mocked(sdk.verifySession).mockResolvedValue({
      openId: "openid-7",
      appId: "medibridge",
      name: "Patient",
    });
    vi.mocked(repo.getUserByOpenId).mockResolvedValue(undefined);
    vi.mocked(sdk.getUserInfoWithJwt).mockRejectedValue(
      new Error("upstream unavailable")
    );

    await expect(authenticateRequest("session-token")).rejects.toMatchObject({
      message: "Failed to sync user info",
      statusCode: 403,
    });
  });

  it("preserves the user-not-found error after an empty OAuth sync", async () => {
    vi.mocked(sdk.verifySession).mockResolvedValue({
      openId: "openid-7",
      appId: "medibridge",
      name: "Patient",
    });
    vi.mocked(repo.getUserByOpenId).mockResolvedValue(undefined);
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      openId: "openid-7",
      name: "Patient",
    } as never);

    await expect(authenticateRequest("session-token")).rejects.toMatchObject({
      message: "User not found",
      statusCode: 403,
    });
  });
});
