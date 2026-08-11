import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./accessControl", () => ({
  requireUser: vi.fn(),
}));
vi.mock("./repo", () => ({
  getLatestRefundRequestByOrderId: vi.fn(),
  getReferralOrderBundleById: vi.fn(),
  listFailedReferralNotificationsByOrderId: vi.fn(),
  listOperationsByOrderId: vi.fn(),
  listReferralOrdersForAdmin: vi.fn(),
  listStatusEventsByOrderId: vi.fn(),
}));

import { requireUser } from "./accessControl";
import {
  getAdminOrderDetailAction,
  listOrdersForAdminAction,
} from "./adminReadActions";
import * as referralRepo from "./repo";

const user = { id: 901, role: "ops" };
const now = new Date("2026-08-01T00:00:00.000Z");
const consultationTime = new Date("2026-08-02T08:00:00.000Z");
const order = {
  id: 101,
  patientUserId: 501,
  triageSessionId: 77,
  status: "scheduled",
  paymentStatus: "paid",
  totalAmount: 19900,
  currency: "cny",
  recommendedHospitalName: "中山医院",
  recommendedDepartmentName: "消化内科",
  recommendedDepartmentNameEn: "Gastroenterology",
  recommendationReason: "Specialty match",
  manualFulfillmentRequired: 0,
  assignedAgentId: 901,
  caseSummarySnapshot: "Digestive symptoms",
  consultationTime,
  consultationTimeZone: "Asia/Shanghai",
  consultationProviderName: "Dr Zhang",
  consultationPlatform: "Tencent Meeting",
  consultationJoinUrl: "https://meeting.example/101",
  consultationInstructions: "Join ten minutes early",
  agreementAcceptedAt: now,
  agreementVersion: "referral_service_v2",
  agreementLang: "zh",
  refundReason: null,
  completedAt: null,
  refundedAt: null,
  createdAt: now,
  updatedAt: now,
  paidAt: now,
  fulfillmentDeadlineAt: now,
};
const hospital = {
  id: 11,
  name: "中山医院",
  nameEn: "Zhongshan Hospital",
  city: "上海",
  cityEn: "Shanghai",
  level: "三级甲等",
  levelEn: "Grade A",
  imageUrl: null,
  isActive: 1,
};
const department = {
  id: 21,
  name: "消化内科",
  nameEn: "Gastroenterology",
  isActive: 1,
};
const contact = {
  id: 31,
  hospitalId: 11,
  departmentId: 21,
  name: "Coordinator",
  roleType: "coordinator",
  languages: ["zh", "en"],
  specialtyTags: ["digestive"],
  avgResponseTimeMinutes: 30,
  successRate: 90,
  isActive: 1,
};
const bundle = {
  order,
  hospital,
  department,
  contact,
  patient: { id: 501, email: " Patient@Example.COM ", role: "free" },
};

describe("referral admin read actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockReturnValue(user as never);
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(
      bundle as never
    );
    vi.mocked(referralRepo.listStatusEventsByOrderId).mockResolvedValue([]);
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue([]);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue(
      null
    );
    vi.mocked(
      referralRepo.listFailedReferralNotificationsByOrderId
    ).mockResolvedValue([]);
    vi.mocked(referralRepo.listReferralOrdersForAdmin).mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      items: [
        {
          order,
          hospital,
          department,
          contact,
          patient: bundle.patient,
          urgencyMinutes: "42",
        },
      ],
    } as never);
  });

  it("passes admin filters and scopes assigned-to-me to the current user", async () => {
    const result = await listOrdersForAdminAction(user as never, {
      page: 1,
      pageSize: 20,
      status: "scheduled",
      hospitalId: 11,
      assignedToMe: true,
      sortDirection: "desc",
    });

    expect(requireUser).toHaveBeenCalledWith(user);
    expect(referralRepo.listReferralOrdersForAdmin).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      status: "scheduled",
      hospitalId: 11,
      assignedToUserId: 901,
      sortDirection: "desc",
    });
    expect(result.items[0]).toMatchObject({
      id: 101,
      patientEmail: "patient@example.com",
      hospitalName: { zh: "中山医院", en: "Zhongshan Hospital" },
      departmentName: { zh: "消化内科", en: "Gastroenterology" },
      contactName: "Coordinator",
      manualFulfillmentRequired: false,
      urgencyMinutes: 42,
    });
  });

  it("preserves unassigned filtering and snapshot presentation fallbacks", async () => {
    vi.mocked(referralRepo.listReferralOrdersForAdmin).mockResolvedValue({
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1,
      items: [
        {
          order: { ...order, manualFulfillmentRequired: 1 },
          hospital: null,
          department: null,
          contact: null,
          patient: null,
          urgencyMinutes: null,
        },
      ],
    } as never);

    const result = await listOrdersForAdminAction(user as never, {
      page: 1,
      pageSize: 20,
      assignedToMe: false,
      sortDirection: "asc",
    });

    expect(referralRepo.listReferralOrdersForAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ assignedToUserId: undefined })
    );
    expect(result.items[0]).toMatchObject({
      patientEmail: null,
      hospitalName: { zh: "中山医院", en: "中山医院" },
      departmentName: { zh: "消化内科", en: "Gastroenterology" },
      contactName: null,
      manualFulfillmentRequired: true,
      urgencyMinutes: 0,
    });
  });

  it("rejects an unauthenticated admin read before repository access", async () => {
    vi.mocked(requireUser).mockImplementation(() => {
      throw Object.assign(new Error("Please sign in to continue."), {
        code: "UNAUTHORIZED",
      });
    });

    await expect(getAdminOrderDetailAction(null, 101)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(referralRepo.getReferralOrderBundleById).not.toHaveBeenCalled();
  });

  it("returns the stable not-found error for a missing order", async () => {
    vi.mocked(referralRepo.getReferralOrderBundleById).mockResolvedValue(null);

    await expect(
      getAdminOrderDetailAction(user as never, 999)
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Referral order not found",
    });
  });

  it("maps full admin detail, audit, failure, consultation, and refund data", async () => {
    vi.mocked(referralRepo.listStatusEventsByOrderId).mockResolvedValue([
      {
        id: 1,
        fromStatus: null,
        toStatus: "pending_payment",
        actorType: "patient",
        actorId: null,
        reason: null,
        createdAt: now,
      },
    ] as never);
    vi.mocked(referralRepo.listOperationsByOrderId).mockResolvedValue([
      {
        id: 2,
        actionType: "payment_success",
        operatorType: "webhook",
        operatorId: null,
        actionPayload: null,
        createdAt: now,
      },
    ] as never);
    vi.mocked(referralRepo.getLatestRefundRequestByOrderId).mockResolvedValue({
      id: 7,
      reasonCode: "patient_requested",
      reasonDetail: null,
      status: "pending_review",
      requestedBy: 501,
      reviewedBy: null,
      approvedAt: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    } as never);
    vi.mocked(
      referralRepo.listFailedReferralNotificationsByOrderId
    ).mockResolvedValue([
      {
        id: 8,
        eventType: "payment_success",
        recipientType: "patient",
        recipient: "patient@example.com",
        attemptCount: 2,
        lastError: null,
        updatedAt: now,
      },
    ] as never);

    const result = await getAdminOrderDetailAction(user as never, 101);

    expect(result).toMatchObject({
      order: { id: 101, agreementLang: "zh" },
      triageSummary: "Digestive symptoms",
      patient: { id: 501, email: "patient@example.com", role: "free" },
      consultationArrangement: {
        scheduledAt: consultationTime,
        timeZone: "Asia/Shanghai",
        providerName: "Dr Zhang",
      },
      timeline: [{ id: 1, actorId: null, reason: null }],
      operations: [{ id: 2, operatorId: null, actionPayload: null }],
      notificationFailures: [{ id: 8, lastError: null }],
      refundRequest: { id: 7, reasonDetail: null, reviewedBy: null },
    });
  });
});
