import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  getReferralOrderById: vi.fn(),
  tryTransitionOrderById: vi.fn(),
}));

import { changeOrderStatus } from "./orderTransition";
import * as referralRepo from "./repo";
import { REFERRAL_INVALID_TRANSITION_ERROR } from "./stateMachine";

const order = {
  id: 101,
  status: "paid_pending_assignment",
};
const transition = {
  orderId: 101,
  toStatus: "assigned" as const,
  toPaymentStatus: "paid" as const,
  actorType: "ops" as const,
  actorId: 901,
  reason: "order_claimed",
  update: { assignedAgentId: 901 },
};

describe("referral order transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      order as never
    );
    vi.mocked(referralRepo.tryTransitionOrderById).mockResolvedValue({
      ok: true,
      current: { ...order, status: "assigned" },
    } as never);
  });

  it("uses the currently read status as the optimistic transition source", async () => {
    await changeOrderStatus(transition);

    expect(referralRepo.tryTransitionOrderById).toHaveBeenCalledWith({
      orderId: 101,
      allowedFrom: ["paid_pending_assignment"],
      toStatus: "assigned",
      toPaymentStatus: "paid",
      actorType: "ops",
      actorId: 901,
      reason: "order_claimed",
      update: { assignedAgentId: 901 },
    });
  });

  it("normalizes an omitted actor id to null", async () => {
    await changeOrderStatus({
      ...transition,
      actorId: undefined,
      update: undefined,
    });

    expect(referralRepo.tryTransitionOrderById).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: null, update: undefined })
    );
  });

  it("preserves the not-found error before attempting a write", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

    await expect(changeOrderStatus(transition)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
    expect(referralRepo.tryTransitionOrderById).not.toHaveBeenCalled();
  });

  it.each(["completed", "refunded", "cancelled"])(
    "blocks terminal status %s from re-entering fulfillment",
    async status => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...order,
        status,
      } as never);

      await expect(changeOrderStatus(transition)).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Terminal referral orders cannot re-enter fulfillment.",
      });
      expect(referralRepo.tryTransitionOrderById).not.toHaveBeenCalled();
    }
  );

  it("preserves the stable precondition error for a raced transition", async () => {
    vi.mocked(referralRepo.tryTransitionOrderById).mockResolvedValue({
      ok: false,
      reason: "conflict",
    } as never);

    await expect(changeOrderStatus(transition)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: REFERRAL_INVALID_TRANSITION_ERROR,
    });
  });
});
