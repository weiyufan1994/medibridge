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
vi.mock("./refunds", () => ({
  initiateAutomaticReferralRefund: vi.fn(),
}));
vi.mock("./repo", () => ({
  getReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
}));

import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { recordBookingResultAction } from "./bookingResultActions";
import { changeOrderStatus } from "./orderTransition";
import { initiateAutomaticReferralRefund } from "./refunds";
import * as referralRepo from "./repo";

const user = { id: 901, role: "ops" };
const order = {
  id: 101,
  status: "contacting",
  paymentStatus: "paid",
};
const input = {
  orderId: 101,
  outcome: "scheduled" as const,
  note: "Booking confirmed by the channel",
};

describe("referral booking result actions", () => {
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

    await expect(recordBookingResultAction(null, input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(referralRepo.getReferralOrderById).not.toHaveBeenCalled();
  });

  it("preserves the missing-order failure", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

    await expect(
      recordBookingResultAction(user as never, input)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  });

  it("records a scheduled result without changing fulfillment state", async () => {
    await expect(
      recordBookingResultAction(user as never, input)
    ).resolves.toEqual({ order: { id: 101 } });

    expect(referralRepo.insertOperation).toHaveBeenCalledWith({
      orderId: 101,
      operatorType: "ops",
      operatorId: 901,
      actionType: "booking_result",
      actionPayload: {
        outcome: "scheduled",
        note: "Booking confirmed by the channel",
      },
    });
    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(initiateAutomaticReferralRefund).not.toHaveBeenCalled();
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it.each(["contacting", "assigned"])(
    "moves a %s order to booking in progress",
    async status => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...order,
        status,
      } as never);

      await recordBookingResultAction(user as never, {
        ...input,
        outcome: "progressing",
        note: "Booking request submitted",
      });

      expect(changeOrderStatus).toHaveBeenCalledWith({
        orderId: 101,
        toStatus: "booking_in_progress",
        toPaymentStatus: "paid",
        actorType: "ops",
        actorId: 901,
        reason: "booking_progressing",
      });
      expect(initiateAutomaticReferralRefund).not.toHaveBeenCalled();
    }
  );

  it("does not repeat an existing booking-in-progress transition", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      status: "booking_in_progress",
    } as never);

    await recordBookingResultAction(user as never, {
      ...input,
      outcome: "progressing",
    });

    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(initiateAutomaticReferralRefund).not.toHaveBeenCalled();
  });

  it("starts the dedicated automatic refund flow after booking failure", async () => {
    await recordBookingResultAction(user as never, {
      ...input,
      outcome: "failed",
      note: "Hospital rejected the booking",
    });

    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(initiateAutomaticReferralRefund).toHaveBeenCalledWith({
      orderId: 101,
      reasonCode: "booking_failed",
      reasonDetail: "Hospital rejected the booking",
      actor: { type: "ops", id: 901 },
    });
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it("propagates automatic refund failures before returning stale detail", async () => {
    vi.mocked(initiateAutomaticReferralRefund).mockRejectedValue(
      new Error("REFERRAL_INVALID_STATUS_TRANSITION")
    );

    await expect(
      recordBookingResultAction(user as never, {
        ...input,
        outcome: "failed",
      })
    ).rejects.toThrow("REFERRAL_INVALID_STATUS_TRANSITION");

    expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
  });
});
