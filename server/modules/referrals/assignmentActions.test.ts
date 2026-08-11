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
  getContactById: vi.fn(),
  getReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
  updateReferralOrderById: vi.fn(),
}));

import { requireUser, resolveActorTypeFromUser } from "./accessControl";
import { getAdminOrderDetailAction } from "./adminReadActions";
import {
  assignOrderAction,
  assignOrderContactAction,
  claimOrderAction,
} from "./assignmentActions";
import { changeOrderStatus } from "./orderTransition";
import * as referralRepo from "./repo";

const user = { id: 901, role: "ops" };
const order = {
  id: 101,
  status: "paid_pending_assignment",
  paymentStatus: "paid",
  assignedAgentId: null,
  hospitalId: 11,
};
const contact = {
  id: 31,
  hospitalId: 11,
  departmentId: 21,
  name: "Hospital coordinator",
  isActive: 1,
};

describe("referral assignment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(changeOrderStatus).mockReset();
    vi.mocked(referralRepo.updateReferralOrderById).mockReset();
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(resolveActorTypeFromUser).mockReturnValue("ops");
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      order as never
    );
    vi.mocked(referralRepo.getContactById).mockResolvedValue(contact as never);
    vi.mocked(getAdminOrderDetailAction).mockResolvedValue({
      order: { id: 101 },
    } as never);
  });

  describe("claimOrderAction", () => {
    it("preserves authentication before reading the order", async () => {
      vi.mocked(requireUser).mockImplementationOnce(() => {
        throw Object.assign(new Error("Please sign in to continue."), {
          code: "UNAUTHORIZED",
        });
      });

      await expect(
        claimOrderAction(null, { orderId: 101 })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(referralRepo.getReferralOrderById).not.toHaveBeenCalled();
    });

    it("preserves the missing-order failure", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

      await expect(
        claimOrderAction(user as never, { orderId: 101 })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Referral order not found",
      });
    });

    it("rejects a claim owned by another coordinator", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...order,
        assignedAgentId: 902,
      } as never);

      await expect(
        claimOrderAction(user as never, { orderId: 101 })
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Referral order is already assigned",
      });
      expect(referralRepo.updateReferralOrderById).not.toHaveBeenCalled();
    });

    it("claims and advances a paid unassigned order", async () => {
      await expect(
        claimOrderAction(user as never, { orderId: 101 })
      ).resolves.toEqual({ order: { id: 101 } });

      expect(referralRepo.updateReferralOrderById).toHaveBeenCalledWith({
        orderId: 101,
        update: { assignedAgentId: 901 },
      });
      expect(changeOrderStatus).toHaveBeenCalledWith({
        orderId: 101,
        toStatus: "assigned",
        toPaymentStatus: "paid",
        actorType: "ops",
        actorId: 901,
        reason: "order_claimed",
      });
      expect(referralRepo.insertOperation).toHaveBeenCalledWith({
        orderId: 101,
        operatorType: "ops",
        operatorId: 901,
        actionType: "order_claimed",
        actionPayload: { assignedAgentId: 901 },
      });
      expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
    });

    it("keeps an existing self-claim in its current state", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...order,
        status: "assigned",
        assignedAgentId: 901,
      } as never);

      await claimOrderAction(user as never, { orderId: 101 });

      expect(referralRepo.updateReferralOrderById).toHaveBeenCalledTimes(1);
      expect(changeOrderStatus).not.toHaveBeenCalled();
      expect(referralRepo.insertOperation).toHaveBeenCalledTimes(1);
    });

    it("does not audit or return stale detail after a transition failure", async () => {
      vi.mocked(changeOrderStatus).mockRejectedValue(
        new Error("REFERRAL_INVALID_STATUS_TRANSITION")
      );

      await expect(
        claimOrderAction(user as never, { orderId: 101 })
      ).rejects.toThrow("REFERRAL_INVALID_STATUS_TRANSITION");

      expect(referralRepo.insertOperation).not.toHaveBeenCalled();
      expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
    });
  });

  describe("assignOrderAction", () => {
    it("preserves the missing-order failure", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

      await expect(
        assignOrderAction(user as never, { orderId: 101, assigneeId: 902 })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Referral order not found",
      });
    });

    it("assigns and advances a paid unassigned order", async () => {
      await assignOrderAction(user as never, {
        orderId: 101,
        assigneeId: 902,
      });

      expect(referralRepo.updateReferralOrderById).toHaveBeenCalledWith({
        orderId: 101,
        update: { assignedAgentId: 902 },
      });
      expect(changeOrderStatus).toHaveBeenCalledWith({
        orderId: 101,
        toStatus: "assigned",
        toPaymentStatus: "paid",
        actorType: "ops",
        actorId: 901,
        reason: "order_assigned",
      });
      expect(referralRepo.insertOperation).toHaveBeenCalledWith({
        orderId: 101,
        operatorType: "ops",
        operatorId: 901,
        actionType: "order_assigned",
        actionPayload: { assigneeId: 902 },
      });
    });

    it("changes an assignee without repeating the state transition", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
        ...order,
        status: "contacting",
        assignedAgentId: 903,
      } as never);

      await assignOrderAction(user as never, {
        orderId: 101,
        assigneeId: 902,
      });

      expect(referralRepo.updateReferralOrderById).toHaveBeenCalledTimes(1);
      expect(changeOrderStatus).not.toHaveBeenCalled();
      expect(referralRepo.insertOperation).toHaveBeenCalledTimes(1);
    });

    it("stops before state and audit writes when assignment persistence fails", async () => {
      vi.mocked(referralRepo.updateReferralOrderById).mockRejectedValue(
        new Error("database unavailable")
      );

      await expect(
        assignOrderAction(user as never, { orderId: 101, assigneeId: 902 })
      ).rejects.toThrow("database unavailable");

      expect(changeOrderStatus).not.toHaveBeenCalled();
      expect(referralRepo.insertOperation).not.toHaveBeenCalled();
    });
  });

  describe("assignOrderContactAction", () => {
    it("preserves the missing-order failure", async () => {
      vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);

      await expect(
        assignOrderContactAction(user as never, {
          orderId: 101,
          contactId: 31,
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: "Referral order not found",
      });
    });

    it.each(["completed", "refunded", "cancelled"])(
      "blocks contact changes for terminal status %s",
      async status => {
        vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
          ...order,
          status,
        } as never);

        await expect(
          assignOrderContactAction(user as never, {
            orderId: 101,
            contactId: 31,
          })
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: "Terminal referral orders cannot be modified.",
        });
        expect(referralRepo.getContactById).not.toHaveBeenCalled();
      }
    );

    it.each([null, 0])(
      "requires a positive local hospital mapping (%s)",
      async hospitalId => {
        vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue({
          ...order,
          hospitalId,
        } as never);

        await expect(
          assignOrderContactAction(user as never, {
            orderId: 101,
            contactId: 31,
          })
        ).rejects.toMatchObject({
          code: "PRECONDITION_FAILED",
          message: "This order has no local hospital mapping yet.",
        });
      }
    );

    it.each([
      null,
      { ...contact, isActive: 0 },
      { ...contact, hospitalId: 12 },
    ])(
      "rejects a missing, inactive, or cross-hospital contact",
      async value => {
        vi.mocked(referralRepo.getContactById).mockResolvedValue(
          value as never
        );

        await expect(
          assignOrderContactAction(user as never, {
            orderId: 101,
            contactId: 31,
          })
        ).rejects.toMatchObject({
          code: "BAD_REQUEST",
          message: "Selected contact is invalid",
        });
        expect(referralRepo.updateReferralOrderById).not.toHaveBeenCalled();
      }
    );

    it("assigns a valid same-hospital active contact and audits it", async () => {
      await expect(
        assignOrderContactAction(user as never, {
          orderId: 101,
          contactId: 31,
        })
      ).resolves.toEqual({ order: { id: 101 } });

      expect(referralRepo.updateReferralOrderById).toHaveBeenCalledWith({
        orderId: 101,
        update: {
          departmentId: 21,
          contactId: 31,
          manualFulfillmentRequired: 0,
        },
      });
      expect(referralRepo.insertOperation).toHaveBeenCalledWith({
        orderId: 101,
        operatorType: "ops",
        operatorId: 901,
        actionType: "contact_assigned",
        actionPayload: {
          contactId: 31,
          contactName: "Hospital coordinator",
        },
      });
      expect(getAdminOrderDetailAction).toHaveBeenCalledWith(user, 101);
    });

    it("does not audit or return detail after a contact persistence failure", async () => {
      vi.mocked(referralRepo.updateReferralOrderById).mockRejectedValue(
        new Error("database unavailable")
      );

      await expect(
        assignOrderContactAction(user as never, {
          orderId: 101,
          contactId: 31,
        })
      ).rejects.toThrow("database unavailable");

      expect(referralRepo.insertOperation).not.toHaveBeenCalled();
      expect(getAdminOrderDetailAction).not.toHaveBeenCalled();
    });
  });
});
