import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("crypto", () => ({
  default: {
    createHash: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => "a".repeat(64)),
      })),
    })),
  },
}));

vi.mock("../../modules/auth/publicApi", () => ({
  authAccountApi: {
    consumeOtpCode: vi.fn(),
    findOrCreateFormalUserByEmail: vi.fn(),
    getGuestUserByDeviceId: vi.fn(),
    getUserById: vi.fn(),
    setSessionCookieByUser: vi.fn(),
  },
}));

vi.mock("../../modules/appointments/publicApi", () => ({
  appointmentAuthApi: {
    bindAppointmentsToUserByEmail: vi.fn(),
    getAppointmentById: vi.fn(),
    reassignAppointmentsFromGuest: vi.fn(),
    updateAppointmentById: vi.fn(),
    validateAppointmentAccessToken: vi.fn(),
  },
}));

vi.mock("../../modules/visit/publicApi", () => ({
  visitGuestAssetApi: {
    reassignVisitAssetsFromGuest: vi.fn(),
  },
}));

vi.mock("../../modules/ai/publicApi", () => ({
  aiGuestAssetApi: {
    reassignTriageSessionsFromGuest: vi.fn(),
  },
}));

import { TRPCError } from "@trpc/server";
import { aiGuestAssetApi } from "../../modules/ai/publicApi";
import { appointmentAuthApi } from "../../modules/appointments/publicApi";
import { authAccountApi } from "../../modules/auth/publicApi";
import { visitGuestAssetApi } from "../../modules/visit/publicApi";
import { verifyMagicLinkAction, verifyOtpAndMergeAction } from "./actions";
import { mergeGuestAssetsIntoFormalUser } from "./guestAssets";

const req = { headers: {}, protocol: "https" } as never;
const res = { cookie: vi.fn(), clearCookie: vi.fn() } as never;

function formalUser(id = 200) {
  return {
    id,
    openId: `email_${id}`,
    email: "patient@example.com",
    name: null,
    isGuest: 0,
  };
}

function guestUser(id = 100) {
  return {
    id,
    openId: null,
    email: null,
    name: null,
    isGuest: 1,
  };
}

describe("auth guest upgrade workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves each owned asset before binding appointments and creating a session", async () => {
    vi.mocked(authAccountApi.findOrCreateFormalUserByEmail).mockResolvedValue(
      formalUser() as never
    );
    vi.mocked(authAccountApi.getGuestUserByDeviceId).mockResolvedValue(
      guestUser() as never
    );

    const result = await verifyOtpAndMergeAction({
      payload: {
        email: "patient@example.com",
        code: "123456",
        deviceId: "device-12345678",
      },
      req,
      res,
    });

    const reassignment = { guestUserId: 100, formalUserId: 200 };
    expect(authAccountApi.consumeOtpCode).toHaveBeenCalledWith({
      email: "patient@example.com",
      code: "123456",
    });
    expect(
      appointmentAuthApi.reassignAppointmentsFromGuest
    ).toHaveBeenCalledWith(reassignment);
    expect(
      visitGuestAssetApi.reassignVisitAssetsFromGuest
    ).toHaveBeenCalledWith(reassignment);
    expect(
      aiGuestAssetApi.reassignTriageSessionsFromGuest
    ).toHaveBeenCalledWith(reassignment);
    const appointmentCall = vi.mocked(
      appointmentAuthApi.reassignAppointmentsFromGuest
    ).mock.invocationCallOrder[0];
    const visitCall = vi.mocked(visitGuestAssetApi.reassignVisitAssetsFromGuest)
      .mock.invocationCallOrder[0];
    const aiCall = vi.mocked(aiGuestAssetApi.reassignTriageSessionsFromGuest)
      .mock.invocationCallOrder[0];
    expect(appointmentCall).toBeLessThan(visitCall);
    expect(visitCall).toBeLessThan(aiCall);
    expect(
      appointmentAuthApi.bindAppointmentsToUserByEmail
    ).toHaveBeenCalledWith("patient@example.com", 200);
    expect(authAccountApi.setSessionCookieByUser).toHaveBeenCalledWith({
      req,
      res,
      user: expect.objectContaining({ id: 200 }),
    });
    expect(result).toEqual({
      success: true,
      userId: 200,
      mergedGuestUserId: 100,
    });
  });

  it("does not merge assets when no guest identity exists", async () => {
    vi.mocked(authAccountApi.findOrCreateFormalUserByEmail).mockResolvedValue(
      formalUser() as never
    );
    vi.mocked(authAccountApi.getGuestUserByDeviceId).mockResolvedValue(
      undefined as never
    );

    const result = await verifyOtpAndMergeAction({
      payload: {
        email: "patient@example.com",
        code: "123456",
        deviceId: "device-12345678",
      },
      req,
      res,
    });

    expect(
      appointmentAuthApi.reassignAppointmentsFromGuest
    ).not.toHaveBeenCalled();
    expect(result.mergedGuestUserId).toBeNull();
  });

  it("fails without binding or creating a session when the formal user is unavailable", async () => {
    vi.mocked(authAccountApi.findOrCreateFormalUserByEmail).mockResolvedValue(
      undefined as never
    );

    await expect(
      verifyOtpAndMergeAction({
        payload: {
          email: "patient@example.com",
          code: "123456",
          deviceId: "device-12345678",
        },
        req,
        res,
      })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(
      appointmentAuthApi.bindAppointmentsToUserByEmail
    ).not.toHaveBeenCalled();
    expect(authAccountApi.setSessionCookieByUser).not.toHaveBeenCalled();
  });

  it("upgrades the appointment guest and accepts a token URL alias", async () => {
    vi.mocked(
      appointmentAuthApi.validateAppointmentAccessToken
    ).mockResolvedValue({
      appointment: {
        id: 17,
        userId: 100,
        email: "patient@example.com",
      },
    } as never);
    vi.mocked(authAccountApi.getUserById).mockResolvedValue(
      guestUser() as never
    );
    vi.mocked(authAccountApi.findOrCreateFormalUserByEmail).mockResolvedValue(
      formalUser() as never
    );
    vi.mocked(authAccountApi.getGuestUserByDeviceId).mockResolvedValue(
      undefined as never
    );
    vi.mocked(appointmentAuthApi.getAppointmentById).mockResolvedValue({
      id: 17,
    } as never);

    const result = await verifyMagicLinkAction({
      payload: {
        token: "https://medibridge.example/visit?t=magic-token-value",
        appointmentId: 17,
      },
      req,
      res,
      deviceId: null,
    });

    expect(
      appointmentAuthApi.validateAppointmentAccessToken
    ).toHaveBeenCalledWith(
      expect.objectContaining({ token: "magic-token-value" })
    );
    expect(
      appointmentAuthApi.reassignAppointmentsFromGuest
    ).toHaveBeenCalledWith({ guestUserId: 100, formalUserId: 200 });
    expect(appointmentAuthApi.updateAppointmentById).toHaveBeenCalledWith(17, {
      userId: 200,
      lastAccessAt: expect.any(Date),
    });
    expect(result).toEqual({
      success: true,
      userId: 200,
      appointmentId: 17,
    });
  });

  it("merges a device guest into an existing formal magic-link user", async () => {
    vi.mocked(
      appointmentAuthApi.validateAppointmentAccessToken
    ).mockResolvedValue({
      appointment: {
        id: 18,
        userId: 200,
        email: "patient@example.com",
      },
    } as never);
    vi.mocked(authAccountApi.getUserById).mockResolvedValue(
      formalUser() as never
    );
    vi.mocked(authAccountApi.getGuestUserByDeviceId).mockResolvedValue(
      guestUser(101) as never
    );
    vi.mocked(appointmentAuthApi.getAppointmentById).mockResolvedValue(
      undefined as never
    );

    const result = await verifyMagicLinkAction({
      payload: { token: "raw-magic-token-value", appointmentId: 18 },
      req,
      res,
      deviceId: "device-12345678",
    });

    expect(
      appointmentAuthApi.reassignAppointmentsFromGuest
    ).toHaveBeenCalledWith({ guestUserId: 101, formalUserId: 200 });
    expect(authAccountApi.findOrCreateFormalUserByEmail).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      userId: 200,
      appointmentId: 18,
    });
  });

  it("fails before asset migration when a magic-link user cannot be resolved", async () => {
    vi.mocked(
      appointmentAuthApi.validateAppointmentAccessToken
    ).mockResolvedValue({
      appointment: {
        id: 19,
        userId: null,
        email: "patient@example.com",
      },
    } as never);
    vi.mocked(authAccountApi.findOrCreateFormalUserByEmail).mockResolvedValue(
      undefined as never
    );

    await expect(
      verifyMagicLinkAction({
        payload: { token: "raw-magic-token-value", appointmentId: 19 },
        req,
        res,
        deviceId: null,
      })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(
      appointmentAuthApi.reassignAppointmentsFromGuest
    ).not.toHaveBeenCalled();
    expect(appointmentAuthApi.updateAppointmentById).not.toHaveBeenCalled();
  });

  it("rejects an empty magic token before token validation", async () => {
    await expect(
      verifyMagicLinkAction({
        payload: { token: " ", appointmentId: 17 },
        req,
        res,
        deviceId: null,
      })
    ).rejects.toBeInstanceOf(TRPCError);
    expect(
      appointmentAuthApi.validateAppointmentAccessToken
    ).not.toHaveBeenCalled();
  });

  it("does not invoke repositories when source and destination identities match", async () => {
    await mergeGuestAssetsIntoFormalUser({
      guestUserId: 200,
      formalUserId: 200,
    });

    expect(
      appointmentAuthApi.reassignAppointmentsFromGuest
    ).not.toHaveBeenCalled();
    expect(
      visitGuestAssetApi.reassignVisitAssetsFromGuest
    ).not.toHaveBeenCalled();
    expect(
      aiGuestAssetApi.reassignTriageSessionsFromGuest
    ).not.toHaveBeenCalled();
  });
});
