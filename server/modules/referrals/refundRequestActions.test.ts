import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./accessControl", () => ({
  requireUser: vi.fn(),
  resolveActorTypeFromUser: vi.fn(),
}));
vi.mock("./adminReadActions", () => ({
  getAdminOrderDetailAction: vi.fn(),
}));
vi.mock("./notifications", () => ({
  notifyInternalActionRequired: vi.fn(),
  notifyPatientReferralUpdate: vi.fn(),
}));
vi.mock("./orderTransition", () => ({
  changeOrderStatus: vi.fn(),
}));
vi.mock("./repo", () => ({
  createRefundRequest: vi.fn(),
  getLatestRefundRequestByOrderId: vi.fn(),
  getReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
}));

import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import {
  notifyInternalActionRequired,
  notifyPatientReferralUpdate,
} from "./notifications";
import { changeOrderStatus } from "./orderTransition";
import { initiateRefundAction } from "./refundRequestActions";
import * as referralRepo from "./repo";

const user = { id: 901, role: "ops" };
const order = {
  id: 101,
  status: "scheduled",
  paymentStatus: "paid",
};
const input = {
  orderId: 101,
  reasonCode: "patient_requested" as const,
  reasonDetail: "Patient requested cancellation",
};

describe("referral refund request actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(resolveActorTypeFromUser).mockReturnValue("ops");
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      order as never
    );
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
      null
    );
    vi.mocked(referralRepo.createRefundRequest).mockResolvedValue(7);
    vi.mocked(getAdminOrderDetailAction).mockResolvedValue({
      id: 101,
    } as never);
  });

  it("creates, audits, and notifies a refund review request", async () => {
    await expect(initiateRefundAction(user as never, input)).resolves.toEqual({
      id: 101,
    });

    expect(changeOrderStatus).toHaveBeenCalledWith({
      orderId: 101,
      toStatus: "refund_pending_review",
      toPaymentStatus: "paid",
      actorType: "ops",
      actorId: 901,
      reason: "refund_requested:patient_requested",
      update: { refundReason: "Patient requested cancellation" },
    });
    expect(referralRepo.createRefundRequest).toHaveBeenCalledWith({
      values: {
        orderId: 101,
        reasonCode: "patient_requested",
        reasonDetail: "Patient requested cancellation",
        status: "pending_review",
        requestedBy: 901,
      },
    });
    expect(referralRepo.insertOperation).toHaveBeenNthCalledWith(1, {
      orderId: 101,
      operatorType: "ops",
      operatorId: 901,
      actionType: "refund_requested",
      actionPayload: {
        reasonCode: "patient_requested",
        reasonDetail: "Patient requested cancellation",
      },
    });
    expect(referralRepo.insertOperation).toHaveBeenNthCalledWith(2, {
      orderId: 101,
      operatorType: "system",
      actionType: "patient_notification",
      actionPayload: { detail: "Refund review initiated." },
    });
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith({
      orderId: 101,
      event: "refund_initiated",
      detail: "patient_requested",
    });
    expect(notifyInternalActionRequired).toHaveBeenCalledWith({
      orderId: 101,
      status: "refund_pending_review",
      reason: "Patient requested cancellation",
    });
  });

  it("returns the existing detail for an active idempotent refund request", async () => {
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue({
      id: 7,
      status: "pending_review",
    } as never);

    await initiateRefundAction(user as never, input);

    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(referralRepo.createRefundRequest).not.toHaveBeenCalled();
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it("reopens a rejected request without repeating an existing review status", async () => {
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue({
      id: 7,
      status: "rejected",
    } as never);
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      status: "refund_pending_review",
    } as never);

    await initiateRefundAction(user as never, input);

    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(referralRepo.createRefundRequest).toHaveBeenCalledTimes(1);
  });

  it("preserves authentication and missing-order failures", async () => {
    vi.mocked(requireUser).mockImplementationOnce(() => {
      throw Object.assign(new Error("Please sign in to continue."), {
        code: "UNAUTHORIZED",
      });
    });
    await expect(initiateRefundAction(null, input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);
    await expect(
      initiateRefundAction(user as never, input)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  });

  it("rejects a refund request for an unpaid order", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      paymentStatus: "pending",
    } as never);

    await expect(
      initiateRefundAction(user as never, input)
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Only paid referral orders can enter refund review.",
    });
    expect(referralRepo.createRefundRequest).not.toHaveBeenCalled();
  });

  it("fails clearly when persistence cannot create the refund request", async () => {
    vi.mocked(referralRepo.createRefundRequest).mockResolvedValue(null);

    await expect(
      initiateRefundAction(user as never, input)
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create refund request",
    });
    expect(referralRepo.insertOperation).not.toHaveBeenCalled();
  });
});
