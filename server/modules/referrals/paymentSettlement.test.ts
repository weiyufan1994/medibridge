import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./fulfillmentPolicy", () => ({
  calculateReferralFulfillmentDeadline: vi.fn(),
}));
vi.mock("./notifications", () => ({
  notifyInternalPaidReferralOrder: vi.fn(),
  notifyPatientReferralUpdate: vi.fn(),
}));
vi.mock("./presentation", () => ({
  toReferralDisplayHospital: vi.fn(),
}));
vi.mock("./repo", () => ({
  getReferralOrderBundleById: vi.fn(),
  getReferralOrderByPaymentSessionId: vi.fn(),
  insertOperation: vi.fn(),
  listOperationsByOrderId: vi.fn(),
  tryMarkOrderPaidByPaymentSessionId: vi.fn(),
}));

import { calculateReferralFulfillmentDeadline } from "./fulfillmentPolicy";
import {
  notifyInternalPaidReferralOrder,
  notifyPatientReferralUpdate,
} from "./notifications";
import {
  publishReferralPaymentSettlement,
  settleReferralOrderPaymentBySessionId,
  settleReferralPaymentTransition,
} from "./paymentSettlement";
import { toReferralDisplayHospital } from "./presentation";
import * as referralRepo from "./repo";

const paidOrder = {
  id: 101,
  status: "paid_pending_assignment",
  paymentStatus: "paid",
  recommendedHospitalName: "中山医院",
  manualFulfillmentRequired: 0,
};
const bundle = {
  order: paidOrder,
  hospital: { id: 11, name: "中山医院", city: "上海" },
  contact: { name: "Coordinator" },
};

describe("referral payment settlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calculateReferralFulfillmentDeadline).mockReturnValue(
      new Date("2026-08-15T00:00:00.000Z")
    );
    vi.mocked(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).mockResolvedValue({
      ok: true,
      current: paidOrder,
    } as never);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      bundle as never
    );
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue([]);
    vi.mocked(toReferralDisplayHospital).mockReturnValue({
      name: { zh: "中山医院", en: "Zhongshan Hospital" },
    } as never);
  });

  it("records a successful transition with its actor and transaction", async () => {
    await expect(
      settleReferralPaymentTransition({
        paymentSessionId: "cs_101",
        paymentProviderTransactionId: "pi_101",
        actorType: "webhook",
        reason: "payment_verified",
      })
    ).resolves.toEqual({ orderId: 101, alreadySettled: false });

    expect(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).toHaveBeenCalledWith({
      paymentSessionId: "cs_101",
      actorType: "webhook",
      reason: "payment_verified",
      paidAt: expect.any(Date),
      fulfillmentDeadlineAt: new Date("2026-08-15T00:00:00.000Z"),
      paymentProviderTransactionId: "pi_101",
      dbExecutor: undefined,
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledWith({
      orderId: 101,
      operatorType: "webhook",
      actionType: "payment_success",
      actionPayload: {
        paymentSessionId: "cs_101",
        paymentProviderTransactionId: "pi_101",
      },
      dbExecutor: undefined,
    });
  });

  it("treats a raced paid order as an idempotent settlement", async () => {
    vi.mocked(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).mockResolvedValue({
      ok: false,
    } as never);
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue(paidOrder as never);

    await expect(
      settleReferralPaymentTransition({
        paymentSessionId: "cs_101",
        actorType: "webhook",
        reason: "payment_verified",
      })
    ).resolves.toEqual({ orderId: 101, alreadySettled: true });
    expect(referralRepo.insertOperation).not.toHaveBeenCalled();
  });

  it("preserves the invalid-transition failure for an unpaid race", async () => {
    vi.mocked(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).mockResolvedValue({
      ok: false,
    } as never);
    vi.mocked(
      referralRepo.getReferralOrderByPaymentSessionId
    ).mockResolvedValue({ ...paidOrder, paymentStatus: "pending" } as never);

    await expect(
      settleReferralPaymentTransition({
        paymentSessionId: "cs_101",
        actorType: "webhook",
        reason: "payment_verified",
      })
    ).rejects.toThrow("REFERRAL_INVALID_STATUS_TRANSITION");
  });

  it("settles and publishes through the shared orchestration helper", async () => {
    await expect(
      settleReferralOrderPaymentBySessionId({
        paymentSessionId: "cs_101",
        actorType: "system",
        reason: "mock_payment_confirmed",
      })
    ).resolves.toBe(paidOrder);

    expect(referralRepo.tryMarkOrderPaidByPaymentSessionId).toHaveBeenCalled();
    expect(notifyPatientReferralUpdate).toHaveBeenCalled();
  });

  it("fails clearly when the settled order bundle disappears", async () => {
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(null);

    await expect(publishReferralPaymentSettlement(101)).rejects.toThrow(
      "Referral order disappeared after payment settlement"
    );
  });

  it("publishes notifications and records the patient-visible operation once", async () => {
    await expect(publishReferralPaymentSettlement(101)).resolves.toBe(
      paidOrder
    );

    expect(referralRepo.insertOperation).toHaveBeenCalledWith({
      orderId: 101,
      operatorType: "system",
      actionType: "patient_notification",
      actionPayload: {
        detail:
          "Payment received. Your referral request is now waiting for internal assignment.",
      },
    });
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith({
      orderId: 101,
      event: "payment_success",
      detail: "Payment received.",
    });
    expect(notifyInternalPaidReferralOrder).toHaveBeenCalledWith({
      orderId: 101,
      hospitalName: "中山医院",
      contactName: "Coordinator",
      manualFulfillmentRequired: false,
    });
  });

  it("does not duplicate an existing payment notification operation", async () => {
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue([
      { actionType: "other", actionPayload: {} },
      { actionType: "patient_notification", actionPayload: null },
      { actionType: "patient_notification", actionPayload: "invalid" },
      {
        actionType: "patient_notification",
        actionPayload: {
          detail:
            "Payment received. Your referral request is now waiting for internal assignment.",
        },
      },
    ] as never);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue({
      ...bundle,
      order: { ...paidOrder, manualFulfillmentRequired: 1 },
      contact: null,
    } as never);

    await publishReferralPaymentSettlement(101);

    expect(referralRepo.insertOperation).not.toHaveBeenCalled();
    expect(notifyInternalPaidReferralOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        contactName: null,
        manualFulfillmentRequired: true,
      })
    );
  });
});
