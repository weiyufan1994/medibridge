import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./repo", () => ({
  createReferralOrder: vi.fn(),
  getContactById: vi.fn(),
  getReferralOrderByClientRequest: vi.fn(),
  getReferralOrderById: vi.fn(),
  insertOperation: vi.fn(),
  insertStatusEvent: vi.fn(),
  listActiveContactsByHospital: vi.fn(),
}));
vi.mock("./triageActions", () => ({
  resolveLocalDepartmentForRankedHospital: vi.fn(),
  resolveLocalHospitalForRankedHospital: vi.fn(),
  resolveRankedHospitalSelection: vi.fn(),
}));

import { createOrderDraftAction } from "./orderDraftActions";
import * as referralRepo from "./repo";
import {
  resolveLocalDepartmentForRankedHospital,
  resolveLocalHospitalForRankedHospital,
  resolveRankedHospitalSelection,
} from "./triageActions";

const input = {
  triageSessionId: 91,
  rankedHospitalIndex: 0,
  contactId: 31,
  clientRequestId: "99999999-9999-4999-8999-999999999999",
  agreementAccepted: true as const,
  agreementVersion: "referral_service_v2" as const,
  agreementLang: "zh" as const,
};
const hospital = { id: 11, isActive: 1 };
const department = { id: 21, hospitalId: 11, isActive: 1 };
const contact = {
  id: 31,
  hospitalId: 11,
  departmentId: 21,
  isActive: 1,
};
const order = {
  id: 101,
  status: "pending_payment",
  paymentStatus: "unpaid",
  manualFulfillmentRequired: 0,
  totalAmount: 19900,
  currency: "cny",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  paidAt: null,
  fulfillmentDeadlineAt: null,
};

describe("referral order draft actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(referralRepo.getReferralOrderByClientRequest).mockResolvedValue(
      null as never
    );
    vi.mocked(referralRepo.getContactById).mockResolvedValue(contact as never);
    vi.mocked(referralRepo.createReferralOrder).mockResolvedValue(101 as never);
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      order as never
    );
    vi.mocked(resolveRankedHospitalSelection).mockResolvedValue({
      session: { id: 91, summary: "Digestive symptoms" },
      triageResult: {
        routing: {
          recommendedDepartment: {
            zh: "消化内科",
            en: "Gastroenterology",
          },
        },
      },
      selectedHospital: {
        hospitalName: "复旦大学附属中山医院",
        city: "上海",
        reason: "Strong specialty match",
      },
    } as never);
    vi.mocked(resolveLocalHospitalForRankedHospital).mockResolvedValue(
      hospital as never
    );
    vi.mocked(resolveLocalDepartmentForRankedHospital).mockResolvedValue(
      department as never
    );
    vi.mocked(referralRepo.listActiveContactsByHospital).mockResolvedValue(
      [] as never
    );
  });

  it("requires a signed-in formal account", async () => {
    await expect(createOrderDraftAction(null, input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Please sign in to continue.",
    });
    await expect(
      createOrderDraftAction({ id: 701, isGuest: 1 } as never, input)
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "FORMAL_ACCOUNT_REQUIRED",
    });
    expect(referralRepo.createReferralOrder).not.toHaveBeenCalled();
  });

  it("rejects an unsupported service agreement version", async () => {
    await expect(
      createOrderDraftAction({ id: 701, isGuest: 0 } as never, {
        ...input,
        agreementVersion: "referral_service_v1" as never,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Unsupported agreement version",
    });
  });

  it("returns an existing order for an idempotent client request", async () => {
    vi.mocked(referralRepo.getReferralOrderByClientRequest).mockResolvedValue(
      order as never
    );

    await expect(
      createOrderDraftAction({ id: 701, isGuest: 0 } as never, input)
    ).resolves.toMatchObject({ id: 101, status: "pending_payment" });
    expect(resolveRankedHospitalSelection).not.toHaveBeenCalled();
    expect(referralRepo.createReferralOrder).not.toHaveBeenCalled();
  });

  it("creates a mapped order and records its agreement/status audit", async () => {
    const result = await createOrderDraftAction(
      { id: 701, isGuest: 0 } as never,
      input
    );

    expect(referralRepo.createReferralOrder).toHaveBeenCalledWith({
      values: expect.objectContaining({
        patientUserId: 701,
        triageSessionId: 91,
        hospitalId: 11,
        departmentId: 21,
        contactId: 31,
        status: "pending_payment",
        paymentStatus: "unpaid",
        totalAmount: 19900,
        currency: "cny",
        agreementVersion: "referral_service_v2",
      }),
    });
    expect(referralRepo.insertStatusEvent).toHaveBeenCalledWith({
      orderId: 101,
      fromStatus: null,
      toStatus: "pending_payment",
      actorType: "patient",
      actorId: 701,
      reason: "order_draft_created",
    });
    expect(referralRepo.insertOperation).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ id: 101, manualFulfillmentRequired: false });
  });

  it("requires an active coordinator when catalog contacts are available", async () => {
    vi.mocked(referralRepo.listActiveContactsByHospital).mockResolvedValue([
      contact,
    ] as never);

    await expect(
      createOrderDraftAction({ id: 701, isGuest: 0 } as never, {
        ...input,
        contactId: undefined,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Selected contact is required",
    });
    expect(referralRepo.createReferralOrder).not.toHaveBeenCalled();
  });

  it("returns the raced order when the idempotent insert loses", async () => {
    vi.mocked(referralRepo.createReferralOrder).mockResolvedValue(null);
    vi.mocked(referralRepo.getReferralOrderByClientRequest)
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(order as never);

    await expect(
      createOrderDraftAction({ id: 701, isGuest: 0 } as never, input)
    ).resolves.toMatchObject({ id: 101 });
    expect(referralRepo.insertStatusEvent).not.toHaveBeenCalled();
  });

  it("fails clearly when creation or its follow-up read cannot complete", async () => {
    vi.mocked(referralRepo.createReferralOrder).mockResolvedValue(null);

    await expect(
      createOrderDraftAction({ id: 701, isGuest: 0 } as never, input)
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create referral order",
    });

    vi.mocked(referralRepo.createReferralOrder).mockResolvedValue(101 as never);
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(null);
    await expect(
      createOrderDraftAction({ id: 701, isGuest: 0 } as never, input)
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Referral order disappeared after creation",
    });
  });
});
