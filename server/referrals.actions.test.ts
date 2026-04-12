import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/referrals/repo", () => ({
  createReferralOrder: vi.fn(),
  getHospitalById: vi.fn(),
  getDepartmentById: vi.fn(),
  getContactById: vi.fn(),
  listActiveContactsByHospital: vi.fn(),
  listDepartmentsByHospitalId: vi.fn(),
  listHospitalsForReferralCatalog: vi.fn(),
  getReferralOrderByPaymentSessionId: vi.fn(),
  tryMarkOrderPaidByPaymentSessionId: vi.fn(),
  getReferralOrderBundleById: vi.fn(),
  insertStatusEvent: vi.fn(),
  insertOperation: vi.fn(),
  getReferralOrderById: vi.fn(),
  isOrderOwnedByUser: vi.fn(),
  markOrderPendingPayment: vi.fn(),
  updateReferralOrderById: vi.fn(),
  tryTransitionOrderById: vi.fn(),
  getLatestRefundRequestByOrderId: vi.fn(),
  updateRefundRequestById: vi.fn(),
  listStatusEventsByOrderId: vi.fn(),
  listOperationsByOrderId: vi.fn(),
  listMineReferralOrders: vi.fn(),
  listReferralOrdersForAdmin: vi.fn(),
}));

vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
  getLatestSessionFlagByType: vi.fn(),
}));

vi.mock("./modules/ai/historyResult", () => ({
  TRIAGE_RESULT_FLAG_TYPE: "triage_result",
  parseStoredHistoricalTriageResult: vi.fn(),
  rebuildHistoricalTriageResultFromSummary: vi.fn(),
}));

vi.mock("./modules/payments/providerManager", () => ({
  createPaymentCheckoutSession: vi.fn(),
  resolvePaymentAdapter: vi.fn(),
}));

vi.mock("./modules/referrals/notifications", () => ({
  notifyInternalActionRequired: vi.fn(),
  notifyInternalPaidReferralOrder: vi.fn(),
  notifyPatientReferralUpdate: vi.fn(),
}));

import * as aiRepo from "./modules/ai/repo";
import {
  parseStoredHistoricalTriageResult,
  rebuildHistoricalTriageResultFromSummary,
} from "./modules/ai/historyResult";
import {
  createPaymentCheckoutSession,
  resolvePaymentAdapter,
} from "./modules/payments/providerManager";
import * as referralRepo from "./modules/referrals/repo";
import {
  assignOrderContactAction,
  confirmReturnedPaymentSessionAction,
  createOrderDraftAction,
  createPaymentSessionAction,
  getAdminOrderDetailAction,
  getOrderDetailAction,
  getSelectionContextAction,
  listOrdersForAdminAction,
  publishPatientProgressUpdateAction,
  reviewRefundAction,
} from "./modules/referrals/actions";
import {
  notifyInternalPaidReferralOrder,
  notifyPatientReferralUpdate,
} from "./modules/referrals/notifications";

function createSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    userId: 501,
    summary: "Abdominal discomfort with diarrhea and dehydration signs.",
    ...overrides,
  };
}

function createRankedHospital(overrides: Record<string, unknown> = {}) {
  return {
    hospitalName: "复旦大学附属中山医院",
    city: "上海",
    specialtyRank: 1,
    specialtyScore: 95,
    generalGrade: "A++",
    stemRank: 3,
    matchedHospitalId: 11,
    matchedDepartmentId: 21,
    reason: "Matches the recommended department.",
    ...overrides,
  };
}

function createTriageResult(overrides: Record<string, unknown> = {}) {
  return {
    routing: {
      recommendedDepartment: {
        zh: "消化内科",
        en: "Gastroenterology",
      },
      hospitals: [createRankedHospital()],
      ...overrides,
    },
  };
}

function createHospitalRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    name: "复旦大学附属中山医院",
    nameEn: "Zhongshan Hospital",
    city: "上海",
    cityEn: "Shanghai",
    level: "",
    levelEn: "",
    imageUrl: null,
    isActive: 1,
    createdAt: new Date("2026-04-11T08:00:00.000Z"),
    updatedAt: new Date("2026-04-11T08:00:00.000Z"),
    ...overrides,
  };
}

function createDepartmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 21,
    hospitalId: 11,
    name: "消化内科",
    nameEn: "Gastroenterology",
    isActive: 1,
    createdAt: new Date("2026-04-11T08:00:00.000Z"),
    updatedAt: new Date("2026-04-11T08:00:00.000Z"),
    ...overrides,
  };
}

function createContactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    hospitalId: 11,
    departmentId: 21,
    name: "Broker Contact",
    roleType: "Haodf coordinator",
    languages: ["zh", "en"],
    specialtyTags: ["digestive"],
    avgResponseTimeMinutes: 30,
    successRate: 85,
    isActive: 1,
    internalNotes: null,
    createdAt: new Date("2026-04-11T08:00:00.000Z"),
    updatedAt: new Date("2026-04-11T08:00:00.000Z"),
    ...overrides,
  };
}

function createOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    patientUserId: 501,
    triageSessionId: 77,
    hospitalId: 11,
    departmentId: 21,
    contactId: null,
    status: "pending_payment",
    paymentStatus: "unpaid",
    totalAmount: 19900,
    currency: "usd",
    recommendedHospitalName: "复旦大学附属中山医院",
    recommendedDepartmentName: "消化内科",
    recommendedDepartmentNameEn: "Gastroenterology",
    recommendationReason: "Matches the recommended department.",
    manualFulfillmentRequired: 0,
    assignedAgentId: null,
    caseSummarySnapshot: createSession().summary,
    consultationTime: null,
    refundReason: null,
    agreementAcceptedAt: new Date("2026-04-11T09:00:00.000Z"),
    agreementVersion: "referral_service_v1",
    agreementLang: "zh",
    paymentProvider: "stripe",
    paymentProviderSessionId: null,
    createdAt: new Date("2026-04-11T08:55:00.000Z"),
    updatedAt: new Date("2026-04-11T09:00:00.000Z"),
    paidAt: null,
    completedAt: null,
    refundedAt: null,
    ...overrides,
  };
}

function createBundle(overrides: {
  order?: Record<string, unknown>;
  hospital?: Record<string, unknown> | null;
  department?: Record<string, unknown> | null;
  contact?: Record<string, unknown> | null;
  patient?: Record<string, unknown> | null;
} = {}) {
  return {
    order: createOrderRow(overrides.order),
    hospital:
      overrides.hospital === null ? null : createHospitalRow(overrides.hospital),
    department:
      overrides.department === null
        ? null
        : createDepartmentRow(overrides.department),
    contact:
      overrides.contact === null ? null : createContactRow(overrides.contact),
    patient:
      overrides.patient === null
        ? null
        : {
            id: 501,
            email: "patient@example.com",
            role: "free",
            ...overrides.patient,
          },
  };
}

describe("referral actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(createSession() as never);
    vi.mocked(aiRepo.getLatestSessionFlagByType).mockResolvedValue({
      id: 1,
      sessionId: 77,
      flagType: "triage_result",
      flagValue: "{}",
      createdAt: new Date("2026-04-11T08:50:00.000Z"),
    } as never);
    vi.mocked(parseStoredHistoricalTriageResult).mockReturnValue(
      createTriageResult() as never
    );
    vi.mocked(rebuildHistoricalTriageResultFromSummary).mockResolvedValue(
      null as never
    );
    vi.mocked(referralRepo.getHospitalById).mockResolvedValue(null as never);
    vi.mocked(referralRepo.getDepartmentById).mockResolvedValue(null as never);
    vi.mocked(referralRepo.getContactById).mockResolvedValue(null as never);
    vi.mocked(referralRepo.isOrderOwnedByUser).mockReturnValue(true as never);
    vi.mocked(referralRepo.listDepartmentsByHospitalId).mockResolvedValue([] as never);
    vi.mocked(referralRepo.listActiveContactsByHospital).mockResolvedValue([] as never);
    vi.mocked(referralRepo.listHospitalsForReferralCatalog).mockResolvedValue(
      [] as never
    );
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
      null as never
    );
    vi.mocked(referralRepo.listStatusEventsByOrderId).mockResolvedValue([] as never);
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue([] as never);
  });

  it("confirms returned payment sessions and moves orders into paid_pending_assignment", async () => {
    const captureOrFinalize = vi.fn().mockResolvedValue({
      provider: "stripe",
      providerSessionId: "cs_referral_1",
    });
    vi.mocked(resolvePaymentAdapter).mockReturnValue({
      captureOrFinalize,
    } as never);
    vi.mocked(referralRepo.getReferralOrderByPaymentSessionId).mockResolvedValue(
      createOrderRow({
        id: 101,
        contactId: 31,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentProviderSessionId: "cs_referral_1",
      }) as never
    );
    vi.mocked(referralRepo.tryMarkOrderPaidByPaymentSessionId).mockResolvedValue({
      ok: true,
      current: { id: 101 },
    } as never);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      createBundle({
        order: {
          id: 101,
          contactId: 31,
          status: "paid_pending_assignment",
          paymentStatus: "paid",
          paymentProviderSessionId: "cs_referral_1",
          paidAt: new Date("2026-04-11T09:00:00.000Z"),
        },
      }) as never
    );

    const result = await confirmReturnedPaymentSessionAction({
      paymentSessionId: "cs_referral_1",
    });

    expect(captureOrFinalize).toHaveBeenCalledWith({
      providerSessionId: "cs_referral_1",
    });
    expect(
      referralRepo.tryMarkOrderPaidByPaymentSessionId
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentSessionId: "cs_referral_1",
        actorType: "webhook",
        reason: "return_url_payment_confirmed",
      })
    );
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 101,
        actionType: "payment_success",
      })
    );
    expect(notifyPatientReferralUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 101,
        event: "payment_success",
      })
    );
    expect(notifyInternalPaidReferralOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 101,
        hospitalName: "复旦大学附属中山医院",
        manualFulfillmentRequired: false,
      })
    );
    expect(result).toMatchObject({
      ok: true,
      orderId: 101,
      status: "paid_pending_assignment",
      paymentStatus: "paid",
    });
  });

  it("creates a payment session for an existing pending referral order", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 107,
        status: "pending_payment",
        paymentStatus: "pending",
        paymentProviderSessionId: "cs_old",
      }) as never
    );
    vi.mocked(createPaymentCheckoutSession).mockResolvedValue({
      provider: "stripe",
      id: "cs_referral_2",
      url: "https://checkout.example/referral/2",
    } as never);
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: true,
      current: {
        id: 107,
        status: "pending_payment",
        paymentStatus: "pending",
      },
    } as never);

    const result = await createPaymentSessionAction({
      user: patientUser,
      createInput: { orderId: 107 },
      req: {
        protocol: "https",
        headers: {},
        get: (name: string) => (name === "host" ? "app.medibridge.test" : undefined),
      } as never,
    });

    expect(createPaymentCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 107,
        amount: 19900,
        currency: "usd",
      })
    );
    expect(referralRepo.markOrderPendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 107,
        paymentSessionId: "cs_referral_2",
      })
    );
    expect(referralRepo.insertOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 107,
        actionType: "payment_session_created",
      })
    );
    expect(result).toMatchObject({
      orderId: 107,
      status: "pending_payment",
      paymentStatus: "pending",
      checkoutSessionUrl: "https://checkout.example/referral/2",
    });
  });

  it("creates a local mock payment session in development when referral mock checkout is enabled", async () => {
    const patientUser = { id: 501, role: "free" } as never;
    const originalNodeEnv = process.env.NODE_ENV;
    const originalMockFlag = process.env.VITE_REFERRAL_MOCK_CHECKOUT;

    process.env.NODE_ENV = "development";
    process.env.VITE_REFERRAL_MOCK_CHECKOUT = "1";

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 111,
        status: "pending_payment",
        paymentStatus: "unpaid",
        paymentProviderSessionId: null,
      }) as never
    );
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: true,
      current: {
        id: 111,
        status: "pending_payment",
        paymentStatus: "pending",
      },
    } as never);

    try {
      const result = await createPaymentSessionAction({
        user: patientUser,
        createInput: { orderId: 111 },
        req: {
          protocol: "https",
          headers: {},
          get: (name: string) =>
            name === "host" ? "app.medibridge.test" : undefined,
        } as never,
      });

      expect(createPaymentCheckoutSession).not.toHaveBeenCalled();
      expect(referralRepo.markOrderPendingPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 111,
          paymentProvider: "stripe",
          paymentSessionId: expect.stringMatching(/^cs_referral_mock_/),
        })
      );
      expect(result).toMatchObject({
        orderId: 111,
        status: "pending_payment",
        paymentStatus: "pending",
        checkoutSessionUrl:
          "https://app.medibridge.test/referrals/mock-checkout/111",
      });
      expect(result.paymentSessionId).toMatch(/^cs_referral_mock_/);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (typeof originalMockFlag === "string") {
        process.env.VITE_REFERRAL_MOCK_CHECKOUT = originalMockFlag;
      } else {
        delete process.env.VITE_REFERRAL_MOCK_CHECKOUT;
      }
    }
  });

  it("allows snapshot/manual-fulfillment orders to create payment sessions when still pending payment", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 109,
        hospitalId: null,
        departmentId: null,
        contactId: null,
        manualFulfillmentRequired: 1,
        status: "pending_payment",
        paymentStatus: "unpaid",
      }) as never
    );
    vi.mocked(createPaymentCheckoutSession).mockResolvedValue({
      provider: "stripe",
      id: "cs_referral_3",
      url: "https://checkout.example/referral/3",
    } as never);
    vi.mocked(referralRepo.markOrderPendingPayment).mockResolvedValue({
      ok: true,
      current: {
        id: 109,
        status: "pending_payment",
        paymentStatus: "unpaid",
      },
    } as never);

    const result = await createPaymentSessionAction({
      user: patientUser,
      createInput: { orderId: 109 },
      req: {
        protocol: "https",
        headers: {},
        get: (name: string) => (name === "host" ? "app.medibridge.test" : undefined),
      } as never,
    });

    expect(createPaymentCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 109,
      })
    );
    expect(result).toMatchObject({
      orderId: 109,
      status: "pending_payment",
      paymentStatus: "pending",
      checkoutSessionUrl: "https://checkout.example/referral/3",
    });
  });

  it("blocks payment session creation for orders that are no longer payable", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 108,
        status: "refunded",
        paymentStatus: "refunded",
      }) as never
    );

    await expect(
      createPaymentSessionAction({
        user: patientUser,
        createInput: { orderId: 108 },
        req: {
          protocol: "https",
          headers: {},
          get: () => "app.medibridge.test",
        } as never,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(createPaymentCheckoutSession).not.toHaveBeenCalled();
  });

  it("returns a clear message when a referral order is no longer waiting for payment", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getReferralOrderById).mockResolvedValue(
      createOrderRow({
        id: 110,
        status: "paid_pending_assignment",
        paymentStatus: "paid",
      }) as never
    );

    await expect(
      createPaymentSessionAction({
        user: patientUser,
        createInput: { orderId: 110 },
        req: {
          protocol: "https",
          headers: {},
          get: () => "app.medibridge.test",
        } as never,
      })
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "This referral order has already been paid.",
    });
  });

  it("creates an order for a ranked hospital even when no local contacts exist", async () => {
    const patientUser = { id: 501, role: "free" } as never;

    vi.mocked(referralRepo.getHospitalById).mockResolvedValue(
      createHospitalRow() as never
    );
    vi.mocked(referralRepo.getDepartmentById).mockResolvedValue(
      createDepartmentRow() as never
    );
    vi.mocked(referralRepo.listDepartmentsByHospitalId).mockResolvedValue(
      [createDepartmentRow()] as never
    );
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
      agreementAccepted: true,
      agreementVersion: "referral_service_v1",
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

    vi.mocked(parseStoredHistoricalTriageResult).mockReturnValue(
      createTriageResult({
        hospitals: [
          createRankedHospital({
            matchedDepartmentId: null,
          }),
        ],
      }) as never
    );
    vi.mocked(referralRepo.getHospitalById).mockResolvedValue(
      createHospitalRow() as never
    );
    vi.mocked(referralRepo.listDepartmentsByHospitalId).mockResolvedValue(
      [
        createDepartmentRow({
          id: 99,
          name: "神经内科",
          nameEn: "Neurology",
        }),
      ] as never
    );
    vi.mocked(referralRepo.listActiveContactsByHospital).mockResolvedValue(
      [createContactRow({ departmentId: 99 })] as never
    );
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
      agreementAccepted: true,
      agreementVersion: "referral_service_v1",
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

    vi.mocked(parseStoredHistoricalTriageResult).mockReturnValue(
      createTriageResult({
        hospitals: [
          createRankedHospital({
            hospitalName: "上海市第一人民医院",
            matchedHospitalId: null,
            matchedDepartmentId: null,
            reason: "Digestive symptoms require further evaluation.",
          }),
        ],
      }) as never
    );
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
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue(
      [
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
      ] as never
    );

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
      .mockResolvedValueOnce(
        [
          {
            id: 9,
            orderId: 113,
            operatorType: "admin",
            operatorId: 900,
            actionType: "patient_notification",
            actionPayload: { detail: "已与院方沟通，正在协调时间" },
            createdAt: progressCreatedAt,
          },
        ] as never
      )
      .mockResolvedValueOnce(
        [
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
        ] as never
      );

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
        }) as never
      )
      .mockResolvedValueOnce(
        createOrderRow({
          id: 106,
          status: "refund_pending_review",
          paymentStatus: "paid",
          assignedAgentId: 900,
        }) as never
      )
      .mockResolvedValueOnce(
        createOrderRow({
          id: 106,
          status: "refund_processing",
          paymentStatus: "paid",
          assignedAgentId: 900,
        }) as never
      );
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
      vi.mocked(referralRepo.updateRefundRequestById).mock.calls.map(
        ([call]) => call.update.status
      )
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
