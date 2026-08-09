import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  findOrCreateGuestUserByDeviceId: vi.fn(),
}));

import * as repo from "./repo";
import { authGuestIdentityApi } from "./publicApi";

describe("authGuestIdentityApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the identity fields required by consuming modules", async () => {
    vi.mocked(repo.findOrCreateGuestUserByDeviceId).mockResolvedValue({
      id: 31,
      openId: "must-not-cross-module-boundary",
      name: "Guest User",
      email: "guest@example.com",
      isGuest: 1,
      deviceId: "guest-device-anon",
      loginMethod: "guest",
      role: "free",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as never);

    await expect(
      authGuestIdentityApi.findOrCreateGuestSessionOwner("guest-device-anon")
    ).resolves.toEqual({
      id: 31,
      role: "free",
      isGuest: 1,
    });
    expect(repo.findOrCreateGuestUserByDeviceId).toHaveBeenCalledWith(
      "guest-device-anon"
    );
  });

  it("preserves an unresolved guest identity", async () => {
    vi.mocked(repo.findOrCreateGuestUserByDeviceId).mockResolvedValue(
      undefined
    );

    await expect(
      authGuestIdentityApi.findOrCreateGuestSessionOwner("missing-device")
    ).resolves.toBeUndefined();
  });
});
