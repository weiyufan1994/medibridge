import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./accessControl", () => ({
  requireUser: vi.fn(),
  resolveActorTypeFromUser: vi.fn(),
}));
vi.mock("./adminReadActions", () => ({
  getAdminOrderDetailAction: vi.fn(),
}));
vi.mock("./orderTransition", () => ({
  changeOrderStatus: vi.fn(),
}));
vi.mock("./repo", () => ({
  getReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
}));

import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { updateOrderStatusAction } from "./manualStatusActions";
import { changeOrderStatus } from "./orderTransition";
import * as referralRepo from "./repo";

const user = { id: 901, role: "ops" };
const order = {
  id: 101,
  status: "pending_payment",
  paymentStatus: "unpaid",
};
const input = {
  orderId: 101,
  toStatus: "cancelled" as const,
  reason: "Patient cancelled before payment",
};

describe("referral manual status actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(resolveActorTypeFromUser).mockReturnValue("ops");
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      order as never
    );
    vi.mocked(getAdminOrderDetailAction).mockResolvedValue({
      order: { id: 101 },
    } as never);
  });

  it("preserves authentication before reading the order", async () => {
    vi.mocked(requireUser).mockImplementationOnce(() => {
      throw Object.assign(new Error("Please sign in to continue."), {
        code: "UNAUTHORIZED",
      });
    });

    await expect(updateOrderStatusAction(null, input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(referralRepo.getReferralOrderById).not.toHaveBeenCalled();
  });

  it("preserves the missing-order failure", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

    await expect(
      updateOrderStatusAction(user as never, input)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  });

  it.each([
    "paid_pending_assignment",
    "time_coordination",
    "scheduled",
    "refund_pending_review",
    "refund_processing",
    "refunded",
  ] as const)("blocks dedicated workflow status %s", async toStatus => {
    await expect(
      updateOrderStatusAction(user as never, {
        ...input,
        toStatus,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message:
        "This referral status requires its dedicated payment, coordination, or refund action.",
    });
    expect(changeOrderStatus).not.toHaveBeenCalled();
  });

  it("requires the refund flow when cancelling a paid order", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      paymentStatus: "paid",
    } as never);

    await expect(
      updateOrderStatusAction(user as never, input)
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Use the refund flow for paid referral orders.",
    });
    expect(changeOrderStatus).not.toHaveBeenCalled();
  });

  it.each(["unpaid", "failed"])(
    "maps a %s pre-payment cancellation to cancelled payment state",
    async paymentStatus => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...order,
        paymentStatus,
      } as never);

      await updateOrderStatusAction(user as never, input);

      expect(changeOrderStatus).toHaveBeenCalledWith({
        orderId: 101,
        toStatus: "cancelled",
        toPaymentStatus: "cancelled",
        actorType: "ops",
        actorId: 901,
        reason: "Patient cancelled before payment",
        update: undefined,
      });
    }
  );

  it.each([
    { paymentStatus: "pending", expectedPaymentStatus: "pending" },
    { paymentStatus: "failed", expectedPaymentStatus: "unpaid" },
  ])(
    "maps $paymentStatus when returning to pending payment",
    async ({ paymentStatus, expectedPaymentStatus }) => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...order,
        paymentStatus,
      } as never);

      await updateOrderStatusAction(user as never, {
        ...input,
        toStatus: "pending_payment",
      });

      expect(changeOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          toStatus: "pending_payment",
          toPaymentStatus: expectedPaymentStatus,
          update: undefined,
        })
      );
    }
  );

  it("uses paid state and writes an audit record for fulfillment statuses", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      status: "assigned",
      paymentStatus: "paid",
    } as never);

    await expect(
      updateOrderStatusAction(user as never, {
        ...input,
        toStatus: "contacting",
        reason: "Contact started manually",
      })
    ).resolves.toEqual({ order: { id: 101 } });

    expect(changeOrderStatus).toHaveBeenCalledWith({
      orderId: 101,
      toStatus: "contacting",
      toPaymentStatus: "paid",
      actorType: "ops",
      actorId: 901,
      reason: "Contact started manually",
      update: undefined,
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledWith({
      orderId: 101,
      operatorType: "ops",
      operatorId: 901,
      actionType: "status_updated",
      actionPayload: {
        toStatus: "contacting",
        reason: "Contact started manually",
      },
    });
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it("sets a completion timestamp only when completing the order", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      status: "scheduled",
      paymentStatus: "paid",
    } as never);

    await updateOrderStatusAction(user as never, {
      ...input,
      toStatus: "completed",
      reason: "Consultation completed",
    });

    expect(changeOrderStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        toStatus: "completed",
        toPaymentStatus: "paid",
        update: { completedAt: expect.any(Date) },
      })
    );
  });

  it("does not audit or return stale detail after a transition failure", async () => {
    vi.mocked(changeOrderStatus).mockRejectedValue(
      new Error("REFERRAL_INVALID_STATUS_TRANSITION")
    );

    await expect(updateOrderStatusAction(user as never, input)).rejects.toThrow(
      "REFERRAL_INVALID_STATUS_TRANSITION"
    );

    expect(referralRepo.insertOperation).not.toHaveBeenCalled();
    expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
  });
});
