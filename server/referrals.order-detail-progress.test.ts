import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBundle,
  createOrderRow,
  createRankedHospital,
  createSession,
  createTriageResult,
  resetReferralActionTestState,
} from "./referrals.actions.test-setup";
import { aiHistoricalTriageApi } from "./modules/ai/publicApi";
import * as referralRepo from "./modules/referrals/repo";
import {
  getAdminOrderDetailAction,
  getOrderDetailAction,
  getSelectionContextAction,
  listOrdersForAdminAction,
  publishPatientProgressUpdateAction,
} from "./modules/referrals/actions";
import { notifyPatientReferralUpdate } from "./modules/referrals/notifications";

describe("referral order detail and progress", () => {
  beforeEach(resetReferralActionTestState);

  it("returns triage snapshot data in selection context and patient order detail when no local mapping exists", async () => {
    const patientUser = { id: 501, role: "free" } as never;
    const snapshotOrder = createOrderRow({
      id: 103,
      hospitalId: null,
      departmentId: null,
      contactId: null,
      recommendedHospitalName: "上海市第一人民医院",
      recommendedDepartmentName: "消化内科",
      recommendedDepartmentNameEn: "Gastroenterology",
      recommendationReason: "Digestive symptoms require further evaluation.",
      manualFulfillmentRequired: 1,
    });

    vi.mocked(aiHistoricalTriageApi.getForUser).mockResolvedValue({
      session: createSession(),
      triageResult: createTriageResult({
        hospitals: [
          createRankedHospital({
            hospitalName: "上海市第一人民医院",
            matchedHospitalId: null,
            matchedDepartmentId: null,
            reason: "Digestive symptoms require further evaluation.",
          }),
        ],
      }),
    } as never);
    vi.mocked(referralRepo.listHospitalsForReferralCatalog).mockResolvedValue(
      [] as never
    );
    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      snapshotOrder as never
    );
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: snapshotOrder,
        hospital: null,
        department: null,
        contact: null,
      }) as never
    );

    const selection = await getSelectionContextAction(patientUser, {
      triageSessionId: 77,
      rankedHospitalIndex: 0,
    });
    const detail = await getOrderDetailAction(patientUser, 103);

    expect(selection).toMatchObject({
      recommendationReason: "Digestive symptoms require further evaluation.",
      manualFulfillmentRequired: true,
      hospital: {
        id: null,
        isLocalCatalogMatch: false,
        name: {
          zh: "上海市第一人民医院",
        },
      },
      department: {
        id: null,
        isLocalCatalogMatch: false,
        name: {
          zh: "消化内科",
        },
      },
    });
    expect(detail).toMatchObject({
      recommendationReason: "Digestive symptoms require further evaluation.",
      order: {
        id: 103,
        manualFulfillmentRequired: true,
      },
      hospital: {
        id: null,
        isLocalCatalogMatch: false,
        name: {
          zh: "上海市第一人民医院",
        },
      },
      department: {
        id: null,
        isLocalCatalogMatch: false,
        name: {
          zh: "消化内科",
        },
      },
      contact: null,
    });
  });

  it("exposes the manual-fulfillment flag in admin list and detail views", async () => {
    const adminUser = { id: 900, role: "admin" } as never;
    const snapshotOrder = createOrderRow({
      id: 104,
      hospitalId: null,
      departmentId: null,
      contactId: null,
      recommendedHospitalName: "上海市第一人民医院",
      recommendedDepartmentName: "消化内科",
      recommendedDepartmentNameEn: "Gastroenterology",
      recommendationReason: "Digestive symptoms require further evaluation.",
      manualFulfillmentRequired: 1,
      status: "paid_pending_assignment",
      paymentStatus: "paid",
    });

    vi.mocked(referralRepo.listReferralOrdersForAdmin).mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      items: [
        {
          order: snapshotOrder,
          hospital: null,
          department: null,
          contact: null,
          patient: {
            id: 501,
            email: "patient@example.com",
            role: "free",
          },
          urgencyMinutes: 42,
        },
      ],
    } as never);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: snapshotOrder,
        hospital: null,
        department: null,
        contact: null,
      }) as never
    );

    const listResult = await listOrdersForAdminAction(adminUser, {
      page: 1,
      pageSize: 20,
      sortDirection: "desc",
      assignedToMe: false,
    });
    const detailResult = await getAdminOrderDetailAction(adminUser, 104);

    expect(listResult.items[0]).toMatchObject({
      id: 104,
      manualFulfillmentRequired: true,
      hospitalName: {
        zh: "上海市第一人民医院",
      },
      departmentName: {
        zh: "消化内科",
      },
    });
    expect(detailResult).toMatchObject({
      recommendationReason: "Digestive symptoms require further evaluation.",
      order: {
        id: 104,
        manualFulfillmentRequired: true,
      },
      hospital: {
        id: null,
        isLocalCatalogMatch: false,
      },
    });
  });

  it("keeps internal notes hidden from the patient-facing order detail", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 112,
        status: "assigned",
        paymentStatus: "paid",
      }) as never
    );
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: {
          id: 112,
          status: "assigned",
          paymentStatus: "paid",
        },
      }) as never
    );
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue([
      {
        id: 2,
        orderId: 112,
        operatorType: "admin",
        operatorId: 900,
        actionType: "internal_note",
        actionPayload: { note: "只给内部看的备注" },
        createdAt: new Date("2026-04-12T09:00:00.000Z"),
      },
      {
        id: 1,
        orderId: 112,
        operatorType: "admin",
        operatorId: 900,
        actionType: "patient_notification",
        actionPayload: { detail: "我们正在联系医院协助安排预约" },
        createdAt: new Date("2026-04-12T08:00:00.000Z"),
      },
    ] as never);

    const detail = await getOrderDetailAction(patientUser, 112);

    expect(detail.operations).toHaveLength(1);
    expect(detail.operations[0]).toMatchObject({
      actionType: "patient_notification",
      actionPayload: { detail: "我们正在联系医院协助安排预约" },
    });
  });

  it("publishes a patient-visible progress update and exposes it on the patient order detail", async () => {
    const adminUser = { id: 900, role: "admin" } as never;
    const patientUser = { id: 501, role: "free" } as never;
    const progressCreatedAt = new Date("2026-04-12T10:15:00.000Z");

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 113,
        status: "contacting",
        paymentStatus: "paid",
      }) as never
    );
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: {
          id: 113,
          status: "contacting",
          paymentStatus: "paid",
        },
      }) as never
    );
    vi.mocked(referralRepo.listOperationsByOrderId)
      .mockResolvedValueOnce([
        {
          id: 9,
          orderId: 113,
          operatorType: "admin",
          operatorId: 900,
          actionType: "patient_notification",
          actionPayload: { detail: "已与院方沟通，正在协调时间" },
          createdAt: progressCreatedAt,
        },
      ] as never)
      .mockResolvedValueOnce([
        {
          id: 9,
          orderId: 113,
          operatorType: "admin",
          operatorId: 900,
          actionType: "patient_notification",
          actionPayload: { detail: "已与院方沟通，正在协调时间" },
          createdAt: progressCreatedAt,
        },
        {
          id: 8,
          orderId: 113,
          operatorType: "system",
          operatorId: null,
          actionType: "payment_success",
          actionPayload: { paymentSessionId: "cs_referral_113" },
          createdAt: new Date("2026-04-12T09:00:00.000Z"),
        },
      ] as never);

    await publishPatientProgressUpdateAction(adminUser, {
      orderId: 113,
      detail: "已与院方沟通，正在协调时间",
    });
    const detail = await getOrderDetailAction(patientUser, 113);

    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 113,
        actionType: "patient_notification",
        actionPayload: {
          detail: "已与院方沟通，正在协调时间",
        },
      })
    );
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith({
      orderId: 113,
      event: "patient_progress_update",
      detail: "已与院方沟通，正在协调时间",
    });
    expect(detail.operations[0]).toMatchObject({
      actionType: "patient_notification",
      actionPayload: { detail: "已与院方沟通，正在协调时间" },
      createdAt: progressCreatedAt,
    });
  });
});
