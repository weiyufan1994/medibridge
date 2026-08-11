import { describe, expect, it, vi } from "vitest";
import type { User } from "../../drizzle/schema";
import {
  createContext,
  type ContextAuthDependencies,
  type TrpcContext,
} from "./context";

const authenticatedUser = {
  id: 7,
  openId: "openid-7",
  email: "patient@example.com",
} as User;

const guestUser = {
  id: 8,
  openId: null,
  email: null,
  deviceId: "cookie-device",
  isGuest: 1,
} as User;

function createOptions(headers: Record<string, string | string[]> = {}) {
  return {
    req: { headers },
    res: {},
  } as unknown as { req: TrpcContext["req"]; res: TrpcContext["res"] };
}

function createAuth(
  overrides: Partial<ContextAuthDependencies> = {}
): ContextAuthDependencies {
  return {
    authenticateRequest: vi.fn().mockResolvedValue(authenticatedUser),
    getGuestUserByDeviceId: vi.fn(),
    ...overrides,
  };
}

describe("createContext", () => {
  it("prefers the device header and keeps the authenticated user", async () => {
    const auth = createAuth();
    const result = await createContext(
      createOptions({
        "x-device-id": " header-device ",
        cookie: "x-device-id=cookie-device",
      }),
      auth
    );

    expect(result).toMatchObject({
      user: authenticatedUser,
      userId: 7,
      deviceId: "header-device",
    });
    expect(auth.getGuestUserByDeviceId).not.toHaveBeenCalled();
  });

  it("uses the first non-empty value from a repeated device header", async () => {
    const auth = createAuth();
    const result = await createContext(
      createOptions({ "x-device-id": [" array-device ", "ignored-device"] }),
      auth
    );

    expect(result.deviceId).toBe("array-device");
  });

  it("falls back to the guest owner from the device cookie", async () => {
    const auth = createAuth({
      authenticateRequest: vi.fn().mockRejectedValue(new Error("anonymous")),
      getGuestUserByDeviceId: vi.fn().mockResolvedValue(guestUser),
    });
    const result = await createContext(
      createOptions({ cookie: "x-device-id=cookie-device" }),
      auth
    );

    expect(result).toMatchObject({
      user: guestUser,
      userId: 8,
      deviceId: "cookie-device",
    });
    expect(auth.getGuestUserByDeviceId).toHaveBeenCalledWith("cookie-device");
  });

  it("keeps public requests anonymous without a device id", async () => {
    const auth = createAuth({
      authenticateRequest: vi.fn().mockRejectedValue(new Error("anonymous")),
    });
    const result = await createContext(createOptions(), auth);

    expect(result).toMatchObject({ user: null, userId: null, deviceId: null });
    expect(auth.getGuestUserByDeviceId).not.toHaveBeenCalled();
  });
});
