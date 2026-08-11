import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getReferralOrderById: vi.fn(),
  isOrderOwnedByUser: vi.fn(),
}));

import {
  getOwnedOrder,
  requireFormalUser,
  requireUser,
  resolveActorTypeFromUser,
} from "./accessControl";
import * as referralRepo from "./repo";

describe("referral access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an authenticated user", () => {
    expect(() => requireUser(null)).toThrowError(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: "Please sign in to continue.",
      })
    );
    expect(requireUser({ id: 81 } as never)).toMatchObject({ id: 81 });
  });

  it("requires a non-guest account for paid referral flows", () => {
    expect(() =>
      requireFormalUser({ id: 82, isGuest: 1 } as never)
    ).toThrowError(
      expect.objectContaining({
        code: "UNAUTHORIZED",
        message: "FORMAL_ACCOUNT_REQUIRED",
      })
    );
    expect(requireFormalUser({ id: 82, isGuest: 0 } as never)).toMatchObject({
      id: 82,
    });
  });

  it("maps only ops users to the ops audit actor", () => {
    expect(resolveActorTypeFromUser({ role: "ops" } as never)).toBe("ops");
    expect(resolveActorTypeFromUser({ role: "admin" } as never)).toBe("admin");
    expect(resolveActorTypeFromUser({ role: "free" } as never)).toBe("admin");
  });

  it("returns an order only when repository ownership matches", async () => {
    const order = { id: 83, patientUserId: 84 };
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      order as never
    );
    vi.mocked(referralRepo.isOrderOwnedByUser).mockReturnValue(true);

    await expect(getOwnedOrder({ orderId: 83, userId: 84 })).resolves.toBe(
      order
    );
    expect(referralRepo.isOrderOwnedByUser).toHaveBeenCalledWith(order, 84);
  });

  it("uses the same forbidden response for missing and foreign orders", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);
    await expect(
      getOwnedOrder({ orderId: 404, userId: 84 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Referral order not found",
    });

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      id: 85,
      patientUserId: 999,
    } as never);
    vi.mocked(referralRepo.isOrderOwnedByUser).mockReturnValue(false);
    await expect(
      getOwnedOrder({ orderId: 85, userId: 84 })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Referral order not found",
    });
  });
});
