import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./accessControl", () => ({
  requireUser: vi.fn(),
  resolveActorTypeFromUser: vi.fn(),
}));
vi.mock("./adminReadActions", () => ({
  getAdminOrderDetailAction: vi.fn(),
}));
vi.mock("./notifications", () => ({
  notifyPatientReferralUpdate: vi.fn(),
}));
vi.mock("./orderTransition", () => ({
  changeOrderStatus: vi.fn(),
}));
vi.mock("./refunds", () => ({
  processReferralRefund: vi.fn(),
}));
vi.mock("./repo", () => ({
  getLatestRefundRequestByOrderId: vi.fn(),
  getReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
  updateRefundRequestById: vi.fn(),
}));

import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import { notifyPatientReferralUpdate } from "./notifications";
import { changeOrderStatus } from "./orderTransition";
import { processReferralRefund } from "./refunds";
import { reviewRefundAction } from "./refundReviewActions";
import * as referralRepo from "./repo";

const user = { id: 901, role: "admin" };
const order = {
  id: 101,
  status: "refund_pending_review",
  paymentStatus: "paid",
  consultationTime: null,
  assignedAgentId: null,
};
const refundRequest = {
  id: 71,
  orderId: 101,
  status: "pending_review",
};
const input = {
  orderId: 101,
  refundRequestId: 71,
  approve: true,
};

describe("referral refund review actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(resolveActorTypeFromUser).mockReturnValue("admin");
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      order as never
    );
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
      refundRequest as never
    );
    vi.mocked(getAdminOrderDetailAction).mockResolvedValue({
      order: { id: 101 },
    } as never);
    vi.mocked(processReferralRefund).mockResolvedValue({
      status: "pending",
      order,
    } as never);
  });

  it("preserves authentication before reading the order", async () => {
    vi.mocked(requireUser).mockImplementationOnce(() => {
      throw Object.assign(new Error("Please sign in to continue."), {
        code: "UNAUTHORIZED",
      });
    });

    await expect(reviewRefundAction(null, input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(referralRepo.getReferralOrderById).not.toHaveBeenCalled();
  });

  it("preserves the missing-order failure", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

    await expect(
      reviewRefundAction(user as never, input)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  });

  it.each([null, { ...refundRequest, id: 72 }])(
    "rejects a missing or mismatched refund request",
    async request => {
      vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
        request as never
      );

      await expect(
        reviewRefundAction(user as never, input)
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Refund request not found",
      });
      expect(referralRepo.updateRefundRequestById).not.toHaveBeenCalled();
    }
  );

  it("returns the existing detail for an already refunded request", async () => {
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue({
      ...refundRequest,
      status: "refunded",
    } as never);

    await expect(reviewRefundAction(user as never, input)).resolves.toEqual({
      order: { id: 101 },
    });

    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
    expect(referralRepo.updateRefundRequestById).not.toHaveBeenCalled();
    expect(processReferralRefund).not.toHaveBeenCalled();
  });

  it.each([
    {
      orderUpdate: {
        consultationTime: new Date("2026-08-12T08:00:00.000Z"),
        assignedAgentId: 902,
      },
      expectedStatus: "scheduled",
    },
    {
      orderUpdate: { consultationTime: null, assignedAgentId: 902 },
      expectedStatus: "assigned",
    },
    {
      orderUpdate: { consultationTime: null, assignedAgentId: null },
      expectedStatus: "paid_pending_assignment",
    },
  ])(
    "rejects the request and resumes the order as $expectedStatus",
    async ({ orderUpdate, expectedStatus }) => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...order,
        ...orderUpdate,
      } as never);

      await reviewRefundAction(user as never, {
        ...input,
        approve: false,
        note: "  not approved  ",
      });

      expect(referralRepo.updateRefundRequestById).toHaveBeenCalledWith({
        refundRequestId: 71,
        update: { status: "rejected", reviewedBy: 901 },
      });
      expect(changeOrderStatus).toHaveBeenCalledWith({
        orderId: 101,
        toStatus: expectedStatus,
        toPaymentStatus: "paid",
        actorType: "admin",
        actorId: 901,
        reason: "not approved",
        update: { refundReason: null },
      });
      expect(referralRepo.insertOperation).toHaveBeenCalledWith({
        orderId: 101,
        operatorType: "admin",
        operatorId: 901,
        actionType: "refund_rejected",
        actionPayload: { note: "  not approved  " },
      });
      expect(processReferralRefund).not.toHaveBeenCalled();
    }
  );

  it("approves, audits, notifies, and dispatches the provider refund", async () => {
    await expect(reviewRefundAction(user as never, input)).resolves.toEqual({
      order: { id: 101 },
    });

    expect(referralRepo.updateRefundRequestById).toHaveBeenNthCalledWith(1, {
      refundRequestId: 71,
      update: {
        status: "approved",
        reviewedBy: 901,
        approvedAt: expect.any(Date),
      },
    });
    expect(changeOrderStatus).toHaveBeenCalledWith({
      orderId: 101,
      toStatus: "refund_processing",
      toPaymentStatus: "paid",
      actorType: "admin",
      actorId: 901,
      reason: "refund_approved",
    });
    expect(referralRepo.updateRefundRequestById).toHaveBeenNthCalledWith(2, {
      refundRequestId: 71,
      update: { status: "processing" },
    });
    expect(referralRepo.insertOperation).toHaveBeenNthCalledWith(1, {
      orderId: 101,
      operatorType: "admin",
      operatorId: 901,
      actionType: "refund_approved",
      actionPayload: { note: null },
    });
    expect(referralRepo.insertOperation).toHaveBeenNthCalledWith(2, {
      orderId: 101,
      operatorType: "system",
      actionType: "patient_notification",
      actionPayload: { detail: "Your full refund is being processed." },
    });
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith({
      orderId: 101,
      event: "refund_processing",
      detail: "Your full refund is being processed.",
    });
    expect(processReferralRefund).toHaveBeenCalledWith({
      orderId: 101,
      actor: { type: "admin", id: 901 },
    });
    expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
  });

  it("does not repeat the transition for a refund already processing", async () => {
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
      ...order,
      status: "refund_processing",
    } as never);

    await reviewRefundAction(user as never, {
      ...input,
      note: "  approved by operations  ",
    });

    expect(changeOrderStatus).not.toHaveBeenCalled();
    expect(referralRepo.insertOperation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actionType: "refund_approved",
        actionPayload: { note: "  approved by operations  " },
      })
    );
    expect(processReferralRefund).toHaveBeenCalledTimes(1);
  });
});
