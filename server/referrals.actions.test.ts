import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBundle,
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
import { paymentProviderApi } from "./modules/payments/publicApi";
import * as referralRepo from "./modules/referrals/repo";
import {
  assignOrderContactAction,
  createOrderDraftAction,
  getAdminOrderDetailAction,
  getOrderDetailAction,
  getSelectionContextAction,
  listOrdersForAdminAction,
  publishPatientProgressUpdateAction,
  reviewRefundAction,
} from "./modules/referrals/actions";
import { notifyPatientReferralUpdate } from "./modules/referrals/notifications";

describe("referral actions", () => {
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
