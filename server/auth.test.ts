import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { COOKIE_NAME } from "../shared/const";

vi.mock("crypto", () => {
  const randomInt = vi.fn(() => 123456);
  const createHash = vi.fn(() => ({
    update: vi.fn(() => ({
      digest: vi.fn(() => "f".repeat(64)),
    })),
  }));

  return {
    default: {
      randomInt,
      createHash,
    },
    randomInt,
    createHash,
  };
});

vi.mock("./modules/auth/repo", () => ({
  findOrCreateFormalUserByEmail: vi.fn(),
  getGuestUserByDeviceId: vi.fn(),
  mergeGuestDataIntoFormalUser: vi.fn(),
  getFormalUserByEmail: vi.fn(),
}));

vi.mock("./modules/appointments/repo", () => ({
  bindAppointmentsToUserByEmail: vi.fn(),
  getAppointmentById: vi.fn(),
  updateAppointmentById: vi.fn(),
}));

vi.mock("./modules/appointments/tokenValidation", () => ({
  validateAppointmentAccessToken: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(async () => "mock-session-token"),
  },
}));

vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: vi.fn(() => ({
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
  })),
}));

import * as authRepo from "./modules/auth/repo";
import * as appointmentsRepo from "./modules/appointments/repo";
import { authRouter } from "./routers/auth";

function createTestContext(): TrpcContext {
  return {
    user: null,
    userId: null,
    deviceId: "device-abc-123456",
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth.verifyOtpAndMerge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges guest-owned data into formal user after OTP verification", async () => {
    const ctx = createTestContext();
    const caller = authRouter.createCaller(ctx);

    vi.mocked(authRepo.findOrCreateFormalUserByEmail).mockResolvedValue({
      id: 200,
      openId: "email_openid_200",
      email: "merge@example.com",
      name: null,
      isGuest: 0,
      deviceId: null,
      loginMethod: "otp",
      role: "free",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never);

    vi.mocked(authRepo.getGuestUserByDeviceId).mockResolvedValue({
      id: 100,
      openId: null,
      email: null,
      name: null,
      isGuest: 1,
      deviceId: "device-abc-123456",
      loginMethod: "guest",
      role: "free",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never);

    await caller.requestOtp({ email: "merge@example.com" });

    const result = await caller.verifyOtpAndMerge({
      email: "merge@example.com",
      code: "123456",
      deviceId: "device-abc-123456",
    });

    expect(authRepo.mergeGuestDataIntoFormalUser).toHaveBeenCalledTimes(1);
    expect(authRepo.mergeGuestDataIntoFormalUser).toHaveBeenCalledWith({
      guestUserId: 100,
      formalUserId: 200,
    });
    expect(appointmentsRepo.bindAppointmentsToUserByEmail).toHaveBeenCalledWith(
      "merge@example.com",
      200
    );
    expect(ctx.res.cookie).toHaveBeenCalledWith(
      COOKIE_NAME,
      "mock-session-token",
      expect.objectContaining({
        httpOnly: true,
        path: "/",
      })
    );
    expect(result).toMatchObject({
      success: true,
      userId: 200,
      mergedGuestUserId: 100,
    });
  });
});
