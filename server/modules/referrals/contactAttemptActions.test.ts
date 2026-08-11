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
import { recordContactAttemptAction } from "./contactAttemptActions";
import { changeOrderStatus } from "./orderTransition";
import { initiateAutomaticReferralRefund } from "./refunds";
import * as referralRepo from "./repo";

const user = { id: 901, role: "ops" };
const order = {
  id: 101,
  status: "assigned",
  paymentStatus: "paid",
};
const input = {
  orderId: 101,
  outcome: "no_response" as const,
  note: "No response after two calls",
};

describe("referral contact attempt actions", () => {
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

    await expect(recordContactAttemptAction(null, input)).rejects.toMatchObject(
      {
        code: "UNAUTHORIZED",
      }
    );
    expect(referralRepo.getReferralOrderById).not.toHaveBeenCalled();
  });

  it("preserves the missing-order failure", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

    await expect(
      recordContactAttemptAction(user as never, input)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  });

  it("records a no-response attempt without changing fulfillment state", async () => {
    await expect(
      recordContactAttemptAction(user as never, input)
    ).resolves.toEqual({ order: { id: 101 } });

    expect(referralRepo.insertOperation).toHaveBeenCalledWith({
      orderId: 101,
      operatorType: "ops",
      operatorId: 901,
      actionType: "contact_attempt",
      actionPayload: {
        outcome: "no_response",
        note: "No response after two calls",
      },
    });
    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(initiateAutomaticReferralRefund).not.toHaveBeenCalled();
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it("moves an assigned order to contacting after a successful connection", async () => {
    await recordContactAttemptAction(user as never, {
      ...input,
      outcome: "connected",
      note: "Patient reached",
    });

    expect(changeOrderStatus).toHaveBeenCalledWith({
      orderId: 101,
      toStatus: "contacting",
      toPaymentStatus: "paid",
      actorType: "ops",
      actorId: 901,
      reason: "contact_connected",
    });
    expect(initiateAutomaticReferralRefund).not.toHaveBeenCalled();
  });

  it("does not repeat the contacting transition for a connected order", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      status: "contacting",
    } as never);

    await recordContactAttemptAction(user as never, {
      ...input,
      outcome: "connected",
    });

    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(initiateAutomaticReferralRefund).not.toHaveBeenCalled();
  });

  it("starts the dedicated automatic refund flow after contact failure", async () => {
    await recordContactAttemptAction(user as never, {
      ...input,
      outcome: "failed",
      note: "Patient cannot be reached within SLA",
    });

    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(initiateAutomaticReferralRefund).toHaveBeenCalledWith({
      orderId: 101,
      reasonCode: "contact_failed",
      reasonDetail: "Patient cannot be reached within SLA",
      actor: { type: "ops", id: 901 },
    });
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it("propagates automatic refund failures before returning stale detail", async () => {
    vi.mocked(initiateAutomaticReferralRefund).mockRejectedValue(
      new Error("REFERRAL_INVALID_STATUS_TRANSITION")
    );

    await expect(
      recordContactAttemptAction(user as never, {
        ...input,
        outcome: "failed",
      })
    ).rejects.toThrow("REFERRAL_INVALID_STATUS_TRANSITION");

    expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
  });
});
