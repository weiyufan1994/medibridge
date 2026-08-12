import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createContactRow,
  createDepartmentRow,
  createHospitalRow,
  createOrderRow,
  createRankedHospital,
  createSession,
  createTriageResult,
  resetReferralActionTestState,
} from "./referrals.actions.test-setup";
import { aiHistoricalTriageApi } from "./modules/ai/publicApi";
import * as referralRepo from "./modules/referrals/repo";
import { createOrderDraftAction } from "./modules/referrals/actions";

describe("referral order draft", () => {
  beforeEach(resetReferralActionTestState);

  it("requires a formal account before creating a paid referral draft", async () => {
    await expect(
      createOrderDraftAction({ id: 501, role: "free", isGuest: 1 } as never, {
        triageSessionId: 77,
        rankedHospitalIndex: 0,
        clientRequestId: "33333333-3333-4333-8333-333333333333",
        agreementAccepted: true,
        agreementVersion: "referral_service_v2",
        agreementLang: "zh",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "FORMAL_ACCOUNT_REQUIRED",
    });
    expect(referralRepo.createReferralOrder).not.toHaveBeenCalled();
  });

  it("returns the existing order for a repeated client request id", async () => {
    vi.mocked(referralRepo.getReferralOrderByClientRequest).mockResolvedValue(
      createOrderRow({
        id: 120,
        clientRequestId: "44444444-4444-4444-8444-444444444444",
      }) as never
    );

    const result = await createOrderDraftAction(
      { id: 501, role: "free", isGuest: 0 } as never,
      {
        triageSessionId: 77,
        rankedHospitalIndex: 0,
        clientRequestId: "44444444-4444-4444-8444-444444444444",
        agreementAccepted: true,
        agreementVersion: "referral_service_v2",
        agreementLang: "zh",
      }
    );

    expect(result.id).toBe(120);
    expect(referralRepo.createReferralOrder).not.toHaveBeenCalled();
  });

  it("rejects a selected coordinator that is no longer valid", async () => {
    vi.mocked(referralRepo.getHospitalById).mockResolvedValue(
      createHospitalRow() as never
    );
    vi.mocked(referralRepo.getDepartmentById).mockResolvedValue(
      createDepartmentRow() as never
    );
    vi.mocked(referralRepo.getContactById).mockResolvedValue(null as never);

    await expect(
      createOrderDraftAction({ id: 501, role: "free", isGuest: 0 } as never, {
        triageSessionId: 77,
        rankedHospitalIndex: 0,
        contactId: 31,
        clientRequestId: "55555555-5555-4555-8555-555555555555",
        agreementAccepted: true,
        agreementVersion: "referral_service_v2",
        agreementLang: "zh",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Selected contact is invalid",
    });
    expect(referralRepo.createReferralOrder).not.toHaveBeenCalled();
  });

  it("creates an order for a ranked hospital even when no local contacts exist", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getHospitalById).mockResolvedValue(
      createHospitalRow() as never
    );
    vi.mocked(referralRepo.getDepartmentById).mockResolvedValue(
      createDepartmentRow() as never
    );
    vi.mocked(referralRepo.listDepartmentsByHospitalId).mockResolvedValue([
      createDepartmentRow(),
    ] as never);
    vi.mocked(referralRepo.listActiveContactsByHospital).mockResolvedValue(
      [] as never
    );
    vi.mocked(referralRepo.createReferralOrder).mockResolvedValue(101 as never);
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 101,
        contactId: null,
        manualFulfillmentRequired: 1,
      }) as never
    );

    const result = await createOrderDraftAction(patientUser, {
      triageSessionId: 77,
      rankedHospitalIndex: 0,
      clientRequestId: "11111111-1111-4111-8111-111111111111",
      agreementAccepted: true,
      agreementVersion: "referral_service_v2",
      agreementLang: "zh",
    });

    expect(referralRepo.createReferralOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          hospitalId: 11,
          departmentId: 21,
          contactId: null,
          recommendedHospitalName: "复旦大学附属中山医院",
          recommendedDepartmentName: "消化内科",
          recommendationReason: "Matches the recommended department.",
          manualFulfillmentRequired: 1,
        }),
      })
    );
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 101,
        actionType: "manual_fulfillment_required",
      })
    );
    expect(result).toMatchObject({
      id: 101,
      status: "pending_payment",
      paymentStatus: "unpaid",
      manualFulfillmentRequired: true,
    });
  });

  it("creates a manual-fulfillment order when the ranked hospital has no local department mapping", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(aiHistoricalTriageApi.getForUser).mockResolvedValue({
      session: createSession(),
      triageResult: createTriageResult({
        hospitals: [
          createRankedHospital({
            matchedDepartmentId: null,
          }),
        ],
      }),
    } as never);
    vi.mocked(referralRepo.getHospitalById).mockResolvedValue(
      createHospitalRow() as never
    );
    vi.mocked(referralRepo.listDepartmentsByHospitalId).mockResolvedValue([
      createDepartmentRow({
        id: 99,
        name: "神经内科",
        nameEn: "Neurology",
      }),
    ] as never);
    vi.mocked(referralRepo.listActiveContactsByHospital).mockResolvedValue([
      createContactRow({ departmentId: 99 }),
    ] as never);
    vi.mocked(referralRepo.createReferralOrder).mockResolvedValue(102 as never);
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 102,
        departmentId: null,
        contactId: null,
        manualFulfillmentRequired: 1,
      }) as never
    );

    const result = await createOrderDraftAction(patientUser, {
      triageSessionId: 77,
      rankedHospitalIndex: 0,
      clientRequestId: "22222222-2222-4222-8222-222222222222",
      agreementAccepted: true,
      agreementVersion: "referral_service_v2",
      agreementLang: "zh",
    });

    expect(referralRepo.createReferralOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          hospitalId: 11,
          departmentId: null,
          manualFulfillmentRequired: 1,
        }),
      })
    );
    expect(result.manualFulfillmentRequired).toBe(true);
  });
});
