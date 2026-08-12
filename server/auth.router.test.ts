import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/auth/actions", () => ({
  getMeUser: vi.fn(),
  logoutAction: vi.fn(),
  requestOtpAction: vi.fn(),
}));
vi.mock("./workflows/authGuestUpgrade/publicApi", () => ({
  verifyMagicLinkAction: vi.fn(),
  verifyOtpAndMergeAction: vi.fn(),
}));

import * as authActions from "./modules/auth/actions";
import {
  verifyMagicLinkAction,
  verifyOtpAndMergeAction,
} from "./workflows/authGuestUpgrade/publicApi";
import { authRouter } from "./routers/auth";

const requestMetadata = {
  clientIp: "203.0.113.10",
  forwardedHost: null,
  forwardedProto: null,
  host: "medibridge.test",
  protocol: "https",
  requestId: "request-1",
  userAgent: "vitest-agent",
};

function caller(user: unknown = null) {
  return authRouter.createCaller({
    user,
    req: { protocol: "https", headers: {} },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
    deviceId: "device-12345678",
    requestMetadata,
  } as never);
}

describe("auth router delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates me and normalizes OTP email input", async () => {
    const currentUser = { id: 12 };
    vi.mocked(authActions.getMeUser).mockResolvedValue({ id: 12 } as never);
    vi.mocked(authActions.requestOtpAction).mockReturnValue({
      success: true,
      expiresInMs: 600_000,
    });

    await expect(caller(currentUser).me()).resolves.toEqual({ id: 12 });
    expect(authActions.getMeUser).toHaveBeenCalledWith(currentUser);
    await expect(
      caller().requestOtp({ email: " Patient@Example.COM " })
    ).resolves.toEqual({ success: true, expiresInMs: 600_000 });
    expect(authActions.requestOtpAction).toHaveBeenCalledWith({
      email: "patient@example.com",
    });
  });

  it("delegates OTP verification with request and response context", async () => {
    vi.mocked(verifyOtpAndMergeAction).mockResolvedValue({
      success: true,
      userId: 20,
      mergedGuestUserId: null,
    });
    await expect(
      caller().verifyOtpAndMerge({
        email: "patient@example.com",
        code: "123456",
        deviceId: "device-12345678",
      })
    ).resolves.toEqual({ success: true, userId: 20, mergedGuestUserId: null });
    expect(verifyOtpAndMergeAction).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          email: "patient@example.com",
          code: "123456",
          deviceId: "device-12345678",
        },
        req: expect.any(Object),
        res: expect.any(Object),
      })
    );
  });

  it("delegates magic-link verification with device and request metadata", async () => {
    vi.mocked(verifyMagicLinkAction).mockResolvedValue({
      success: true,
      userId: 21,
      appointmentId: 31,
    });
    await expect(
      caller().verifyMagicLink({
        token: "0123456789abcdef",
        appointmentId: 31,
      })
    ).resolves.toEqual({ success: true, userId: 21, appointmentId: 31 });
    expect(verifyMagicLinkAction).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { token: "0123456789abcdef", appointmentId: 31 },
        deviceId: "device-12345678",
        requestMetadata,
      })
    );
  });

  it("delegates logout and retains input validation", async () => {
    vi.mocked(authActions.logoutAction).mockReturnValue({ success: true });
    await expect(caller().logout()).resolves.toEqual({ success: true });
    expect(authActions.logoutAction).toHaveBeenCalledWith({
      req: expect.any(Object),
      res: expect.any(Object),
    });
    await expect(
      caller().requestOtp({ email: "invalid" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
