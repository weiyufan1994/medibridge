import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBundle,
  createContactRow,
  createOrderRow,
  resetReferralActionTestState,
} from "./referrals.actions.test-setup";
import { paymentProviderApi } from "./modules/payments/publicApi";
import * as referralRepo from "./modules/referrals/repo";
import {
  assignOrderContactAction,
  reviewRefundAction,
} from "./modules/referrals/actions";
import { notifyPatientReferralUpdate } from "./modules/referrals/notifications";

describe("referral admin operations", () => {
  beforeEach(resetReferralActionTestState);

  it("allows admins to assign a contact after the order is created", async () => {
    const adminUser = { id: 900, role: "admin" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 105,
        status: "assigned",
        paymentStatus: "paid",
        hospitalId: 11,
        departmentId: null,
        contactId: null,
        assignedAgentId: 900,
        manualFulfillmentRequired: 1,
      }) as never
    );
    vi.mocked(referralRepo.getContactById).mockResolvedValue(
      createContactRow() as never
    );
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: {
          id: 105,
          status: "assigned",
          paymentStatus: "paid",
          hospitalId: 11,
          departmentId: 21,
          contactId: 31,
          assignedAgentId: 900,
          manualFulfillmentRequired: 0,
        },
      }) as never
    );

    const result = await assignOrderContactAction(adminUser, {
      orderId: 105,
      contactId: 31,
    });

    expect(referralRepo.updateReferralOrderById).toHaveBeenCalledWith({
      orderId: 105,
      update: {
        departmentId: 21,
        contactId: 31,
        manualFulfillmentRequired: 0,
      },
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 105,
        actionType: "contact_assigned",
        actionPayload: expect.objectContaining({
          contactId: 31,
          contactName: "Broker Contact",
        }),
      })
    );
    expect(result).toMatchObject({
      order: {
        id: 105,
        manualFulfillmentRequired: false,
      },
      contact: {
        id: 31,
      },
    });
  });

  it("approves refunds and moves orders into refunded with audit updates", async () => {
    const adminUser = { id: 900, role: "admin" } as never;

    vi.mocked(referralRepo.getReferralOrderById)
      .mockResolvedValueOnce(
        createOrderRow({
          id: 106,
          status: "refund_pending_review",
          paymentStatus: "paid",
          assignedAgentId: 900,
          paymentProviderSessionId: "cs_refund_106",
          paymentProviderTransactionId: "pi_refund_106",
        }) as never
      )
      .mockResolvedValueOnce(
        createOrderRow({
          id: 106,
          status: "refund_pending_review",
          paymentStatus: "paid",
          assignedAgentId: 900,
          paymentProviderSessionId: "cs_refund_106",
          paymentProviderTransactionId: "pi_refund_106",
        }) as never
      )
      .mockResolvedValueOnce(
        createOrderRow({
          id: 106,
          status: "refund_processing",
          paymentStatus: "paid",
          assignedAgentId: 900,
          paymentProviderSessionId: "cs_refund_106",
          paymentProviderTransactionId: "pi_refund_106",
        }) as never
      )
      .mockResolvedValueOnce(
        createOrderRow({
          id: 106,
          status: "refund_processing",
          paymentStatus: "paid",
          assignedAgentId: 900,
          paymentProviderSessionId: "cs_refund_106",
          paymentProviderTransactionId: "pi_refund_106",
        }) as never
      )
      .mockResolvedValueOnce(
        createOrderRow({
          id: 106,
          status: "refunded",
          paymentStatus: "refunded",
          assignedAgentId: 900,
          paymentProviderSessionId: "cs_refund_106",
          paymentProviderTransactionId: "pi_refund_106",
          paymentProviderRefundId: "re_refund_106",
        }) as never
      );
    vi.mocked(paymentProviderApi.refund).mockResolvedValue({
      provider: "stripe",
      providerRefundId: "re_refund_106",
      status: "succeeded",
    });
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId)
      .mockResolvedValueOnce({
        id: 401,
        orderId: 106,
        reasonCode: "booking_failed",
        reasonDetail: "channel rejected registration",
        status: "pending_review",
        requestedBy: 900,
        reviewedBy: null,
        approvedAt: null,
        refundedAt: null,
        createdAt: new Date("2026-04-11T09:05:00.000Z"),
        updatedAt: new Date("2026-04-11T09:05:00.000Z"),
      } as never)
      .mockResolvedValueOnce({
        id: 401,
        orderId: 106,
        reasonCode: "booking_failed",
        reasonDetail: "channel rejected registration",
        status: "refunded",
        requestedBy: 900,
        reviewedBy: 900,
        approvedAt: new Date("2026-04-11T09:15:00.000Z"),
        refundedAt: new Date("2026-04-11T09:16:00.000Z"),
        createdAt: new Date("2026-04-11T09:05:00.000Z"),
        updatedAt: new Date("2026-04-11T09:16:00.000Z"),
      } as never);
    vi.mocked(referralRepo.tryTransitionOrderById)
      .mockResolvedValueOnce({
        ok: true,
        current: {
          id: 106,
          status: "refund_pending_review",
          paymentStatus: "paid",
        },
      } as never)
      .mockResolvedValueOnce({
        ok: true,
        current: {
          id: 106,
          status: "refund_processing",
          paymentStatus: "paid",
        },
      } as never);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: {
          id: 106,
          contactId: 31,
          status: "refunded",
          paymentStatus: "refunded",
          refundReason: "channel rejected registration",
          assignedAgentId: 900,
          refundedAt: new Date("2026-04-11T09:16:00.000Z"),
        },
      }) as never
    );

    const result = await reviewRefundAction(adminUser, {
      orderId: 106,
      refundRequestId: 401,
      approve: true,
      note: "manual refund completed",
    });

    expect(referralRepo.updateRefundRequestById).toHaveBeenCalledTimes(3);
    expect(
      vi
        .mocked(referralRepo.updateRefundRequestById)
        .mock.calls.map(([call]) => call.update.status)
    ).toEqual(["approved", "processing", "refunded"]);
    expect(referralRepo.tryTransitionOrderById).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderId: 106,
        toStatus: "refund_processing",
        toPaymentStatus: "paid",
      })
    );
    expect(referralRepo.tryTransitionOrderById).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderId: 106,
        toStatus: "refunded",
        toPaymentStatus: "refunded",
      })
    );
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 106,
        actionType: "refund_completed",
      })
    );
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 106,
        event: "refund_completed",
      })
    );
    expect(result.order.status).toBe("refunded");
    expect(result.order.paymentStatus).toBe("refunded");
  });
});
