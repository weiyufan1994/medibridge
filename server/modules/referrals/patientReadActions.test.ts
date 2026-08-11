import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./accessControl", () => ({
  getOwnedOrder: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("./orderSummary", () => ({
  mapBundleToOrderSummary: vi.fn(),
}));
vi.mock("./presentation", () => ({
  toPublicReferralContactOrNull: vi.fn(),
}));
vi.mock("./readPresentation", () => ({
  buildOrderDisplayContext: vi.fn(),
  toConsultationArrangement: vi.fn(),
}));
vi.mock("./repo", () => ({
  getLatestRefundRequestByOrderId: vi.fn(),
  getReferralOrderBundleById: vi.fn(),
  listMineReferralOrders: vi.fn(),
  listOperationsByOrderId: vi.fn(),
  listStatusEventsByOrderId: vi.fn(),
}));

import { getOwnedOrder, requireUser } from "./accessControl";
import { mapBundleToOrderSummary } from "./orderSummary";
import {
  getOrderDetailAction,
  listMineOrdersAction,
} from "./patientReadActions";
import { toPublicReferralContactOrNull } from "./presentation";
import {
  buildOrderDisplayContext,
  toConsultationArrangement,
} from "./readPresentation";
import * as referralRepo from "./repo";

const user = { id: 501, role: "user" };
const createdAt = new Date("2026-08-01T08:00:00.000Z");
const updatedAt = new Date("2026-08-02T08:00:00.000Z");
const order = {
  id: 101,
  status: "scheduled",
  paymentStatus: "paid",
  totalAmount: 19900,
  currency: "cny",
  consultationTime: null,
  createdAt,
  updatedAt,
  triageSessionId: 77,
  assignedAgentId: null,
  agreementAcceptedAt: createdAt,
  agreementVersion: "v1",
  agreementLang: "zh",
  refundReason: null,
  completedAt: null,
  refundedAt: null,
  caseSummarySnapshot: { summary: "case" },
};
const hospital = { id: 11, name: "Hospital" };
const department = { id: 21, name: "Department" };
const contact = { id: 31, name: "Coordinator" };
const bundle = { order, hospital, department, contact };
const displayContext = {
  manualFulfillmentRequired: false,
  hospital: { id: 11, name: "Hospital" },
  department: { id: 21, name: "Department" },
  recommendationReason: "Matched specialty",
};

describe("referral patient read actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOwnedOrder).mockReset();
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(referralRepo.listMineReferralOrders).mockResolvedValue([]);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      bundle as never
    );
    vi.mocked(referralRepo.listStatusEventsByOrderId).mockResolvedValue([]);
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue([]);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
      null
    );
    vi.mocked(buildOrderDisplayContext).mockReturnValue(
      displayContext as never
    );
    vi.mocked(mapBundleToOrderSummary).mockReturnValue({
      id: 101,
      status: "scheduled",
      paymentStatus: "paid",
    } as never);
    vi.mocked(toPublicReferralContactOrNull).mockReturnValue({
      id: 31,
      name: "Coordinator",
    } as never);
    vi.mocked(toConsultationArrangement).mockReturnValue({
      consultationTime: null,
    } as never);
  });

  it("preserves authentication before listing patient orders", async () => {
    vi.mocked(requireUser).mockImplementationOnce(() => {
      throw Object.assign(new Error("Please sign in to continue."), {
        code: "UNAUTHORIZED",
      });
    });

    await expect(
      listMineOrdersAction(null, { limit: 20 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(referralRepo.listMineReferralOrders).not.toHaveBeenCalled();
  });

  it("maps the patient list without exposing internal bundle fields", async () => {
    vi.mocked(referralRepo.listMineReferralOrders).mockResolvedValue([
      {
        order,
        hospital,
        department,
        contact,
        refundRequest: { status: "processing" },
      },
    ] as never);

    await expect(
      listMineOrdersAction(user as never, { limit: 10 })
    ).resolves.toEqual([
      {
        id: 101,
        status: "scheduled",
        paymentStatus: "paid",
        totalAmount: 19900,
        currency: "cny",
        consultationTime: null,
        createdAt,
        updatedAt,
        manualFulfillmentRequired: false,
        hospital: displayContext.hospital,
        department: displayContext.department,
        contact: { id: 31, name: "Coordinator" },
        refundStatus: "processing",
      },
    ]);

    expect(referralRepo.listMineReferralOrders).toHaveBeenCalledWith({
      patientUserId: 501,
      limit: 10,
    });
    expect(buildOrderDisplayContext).toHaveBeenCalledWith({
      order,
      hospital,
      department,
    });
  });

  it("checks ownership before reading the detail bundle", async () => {
    vi.mocked(getOwnedOrder).mockRejectedValue(
      Object.assign(new Error("Referral order not found"), {
        code: "NOT_FOUND",
      })
    );

    await expect(
      getOrderDetailAction(user as never, 101)
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(getOwnedOrder).toHaveBeenCalledWith({ orderId: 101, userId: 501 });
    expect(referralRepo.getReferralOrderBundleById).not.toHaveBeenCalled();
  });

  it("preserves the missing-bundle failure after ownership succeeds", async () => {
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(null);

    await expect(
      getOrderDetailAction(user as never, 101)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  });

  it("maps detail timelines, visible operations, and refund metadata", async () => {
    const eventCreatedAt = new Date("2026-08-03T08:00:00.000Z");
    vi.mocked(referralRepo.listStatusEventsByOrderId).mockResolvedValue([
      {
        id: 301,
        fromStatus: null,
        toStatus: "scheduled",
        actorType: "ops",
        actorId: null,
        reason: null,
        createdAt: eventCreatedAt,
      },
    ] as never);
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue([
      {
        id: 401,
        actionType: "patient_notification",
        operatorType: "system",
        operatorId: null,
        actionPayload: null,
        createdAt: eventCreatedAt,
      },
      {
        id: 402,
        actionType: "internal_note",
        operatorType: "ops",
        operatorId: 901,
        actionPayload: { note: "private" },
        createdAt: eventCreatedAt,
      },
    ] as never);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue({
      id: 71,
      reasonCode: "patient_requested",
      reasonDetail: null,
      status: "pending_review",
      requestedBy: 501,
      reviewedBy: null,
      approvedAt: null,
      refundedAt: null,
      createdAt,
      updatedAt,
    } as never);

    const result = await getOrderDetailAction(user as never, 101);

    expect(result).toMatchObject({
      order: {
        id: 101,
        agreementLang: "zh",
        triageSessionId: 77,
        consultationTime: null,
        assignedAgentId: null,
        refundReason: null,
      },
      triageSummary: { summary: "case" },
      recommendationReason: "Matched specialty",
      hospital: displayContext.hospital,
      department: displayContext.department,
      contact: { id: 31, name: "Coordinator" },
      timeline: [
        {
          id: 301,
          fromStatus: null,
          toStatus: "scheduled",
          actorType: "ops",
          actorId: null,
          reason: null,
          createdAt: eventCreatedAt,
        },
      ],
      operations: [
        {
          id: 401,
          actionType: "patient_notification",
          operatorType: "system",
          operatorId: null,
          actionPayload: null,
          createdAt: eventCreatedAt,
        },
      ],
      refundRequest: {
        id: 71,
        reasonCode: "patient_requested",
        reasonDetail: null,
        status: "pending_review",
        requestedBy: 501,
        reviewedBy: null,
      },
    });
  });

  it("normalizes unsupported stored agreement languages to English", async () => {
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue({
      ...bundle,
      order: { ...order, agreementLang: "fr" },
    } as never);

    const result = await getOrderDetailAction(user as never, 101);

    expect(result.order.agreementLang).toBe("en");
    expect(result.refundRequest).toBeNull();
  });
});
