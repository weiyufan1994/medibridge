import { vi } from "vitest";

vi.mock("./modules/referrals/repo", () => ({
  createReferralOrder: vi.fn(),
  getReferralOrderByClientRequest: vi.fn(),
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
  listFailedReferralNotificationsByOrderId: vi.fn(),
  createRefundRequest: vi.fn(),
  listMineReferralOrders: vi.fn(),
  listReferralOrdersForAdmin: vi.fn(),
}));

vi.mock("./modules/ai/publicApi", () => ({
  aiHistoricalTriageApi: {
    getForUser: vi.fn(),
  },
}));

vi.mock("./modules/payments/publicApi", () => ({
  paymentProviderApi: {
    createCheckoutSession: vi.fn(),
    captureOrFinalize: vi.fn(),
    refund: vi.fn(),
  },
}));

vi.mock("./modules/referrals/notifications", () => ({
  notifyInternalActionRequired: vi.fn(),
  notifyInternalPaidReferralOrder: vi.fn(),
  notifyPatientReferralUpdate: vi.fn(),
}));

import { aiHistoricalTriageApi } from "./modules/ai/publicApi";
import * as referralRepo from "./modules/referrals/repo";

export function createSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 77,
    userId: 501,
    summary: "Abdominal discomfort with diarrhea and dehydration signs.",
    ...overrides,
  };
}

export function createRankedHospital(overrides: Record<string, unknown> = {}) {
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

export function createTriageResult(overrides: Record<string, unknown> = {}) {
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

export function createHospitalRow(overrides: Record<string, unknown> = {}) {
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

export function createDepartmentRow(overrides: Record<string, unknown> = {}) {
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

export function createContactRow(overrides: Record<string, unknown> = {}) {
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

export function createOrderRow(overrides: Record<string, unknown> = {}) {
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
    paymentProviderTransactionId: null,
    paymentProviderRefundId: null,
    clientRequestId: null,
    fulfillmentDeadlineAt: null,
    consultationTimeZone: null,
    consultationProviderName: null,
    consultationPlatform: null,
    consultationJoinUrl: null,
    consultationInstructions: null,
    createdAt: new Date("2026-04-11T08:55:00.000Z"),
    updatedAt: new Date("2026-04-11T09:00:00.000Z"),
    paidAt: null,
    completedAt: null,
    refundedAt: null,
    ...overrides,
  };
}

export function createBundle(
  overrides: {
    order?: Record<string, unknown>;
    hospital?: Record<string, unknown> | null;
    department?: Record<string, unknown> | null;
    contact?: Record<string, unknown> | null;
    patient?: Record<string, unknown> | null;
  } = {}
) {
  return {
    order: createOrderRow(overrides.order),
    hospital:
      overrides.hospital === null
        ? null
        : createHospitalRow(overrides.hospital),
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

export function resetReferralActionTestState() {
  vi.clearAllMocks();
  process.env.REFERRAL_PAYMENT_MODE = "provider";
  vi.mocked(aiHistoricalTriageApi.getForUser).mockResolvedValue({
    session: createSession(),
    triageResult: createTriageResult(),
  } as never);
  vi.mocked(referralRepo.getHospitalById).mockResolvedValue(null as never);
  vi.mocked(referralRepo.getDepartmentById).mockResolvedValue(null as never);
  vi.mocked(referralRepo.getContactById).mockResolvedValue(null as never);
  vi.mocked(referralRepo.isOrderOwnedByUser).mockReturnValue(true as never);
  vi.mocked(referralRepo.listDepartmentsByHospitalId).mockResolvedValue(
    [] as never
  );
  vi.mocked(referralRepo.listActiveContactsByHospital).mockResolvedValue(
    [] as never
  );
  vi.mocked(referralRepo.listHospitalsForReferralCatalog).mockResolvedValue(
    [] as never
  );
  vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
    null as never
  );
  vi.mocked(referralRepo.getReferralOrderByClientRequest).mockResolvedValue(
    null as never
  );
  vi.mocked(referralRepo.listStatusEventsByOrderId).mockResolvedValue(
    [] as never
  );
  vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue(
    [] as never
  );
  vi.mocked(
    referralRepo.listFailedReferralNotificationsByOrderId
  ).mockResolvedValue([] as never);
}
