import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentById: vi.fn(),
  tryTransitionAppointmentById: vi.fn(),
  listAppointmentsForAdmin: vi.fn(),
  listActiveAppointmentTokens: vi.fn(),
  listStatusEventsByAppointment: vi.fn(),
  listStripeWebhookEventsForAppointment: vi.fn(),
  insertStatusEvent: vi.fn(),
}));

vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
  listAiChatSessionsForAdmin: vi.fn(),
}));

vi.mock("./modules/visit/repo", () => ({
  getRecentMessages: vi.fn(),
}));

vi.mock("./modules/doctors/repo", () => ({
  getAllHospitals: vi.fn(),
  getDoctorById: vi.fn(),
}));

vi.mock("./modules/admin/repo", () => ({
  getVisitSummaryByAppointmentId: vi.fn(),
  upsertVisitSummary: vi.fn(),
  ensureDefaultRetentionPolicies: vi.fn(),
  upsertRetentionPolicy: vi.fn(),
  runRetentionCleanup: vi.fn(),
  listRetentionCleanupAudits: vi.fn(),
}));

vi.mock("./modules/admin/visitSummary", () => ({
  generateBilingualVisitSummary: vi.fn(),
}));

import * as appointmentsRepo from "./modules/appointments/repo";
import * as aiRepo from "./modules/ai/repo";
import * as doctorsRepo from "./modules/doctors/repo";
import * as visitRepo from "./modules/visit/repo";
import * as adminRepo from "./modules/admin/repo";
import { generateBilingualVisitSummary } from "./modules/admin/visitSummary";
import { systemRouter } from "./_core/systemRouter";

function createAdminCaller() {
  return systemRouter.createCaller({
    user: {
      id: 99,
      role: "admin",
    },
    req: {
      protocol: "https",
      headers: {
        host: "medibridge.test",
      },
      get(name: string) {
        return name.toLowerCase() === "host" ? "medibridge.test" : undefined;
      },
    },
  } as never);
}

describe("system admin ops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adminUpdateAppointmentStatus triggers transition with admin operator", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 321,
      status: "paid",
      paymentStatus: "paid",
    } as never);
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
      reason: "updated",
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminUpdateAppointmentStatus({
      appointmentId: 321,
      toStatus: "active",
      toPaymentStatus: "paid",
      reason: "start_visit",
    });

    expect(result).toEqual({ ok: true });
    expect(appointmentsRepo.tryTransitionAppointmentById).toHaveBeenCalledWith(
      expect.objectContaining({
        appointmentId: 321,
        operatorType: "admin",
        operatorId: 99,
        toStatus: "active",
        toPaymentStatus: "paid",
      })
    );
  });

  it("adminGenerateVisitSummary returns cached summary when exists", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 321,
      triageSessionId: 88,
    } as never);
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue({
      id: 1,
      appointmentId: 321,
      summaryZh: "中文摘要",
      summaryEn: "English summary",
      source: "llm",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:10:00.000Z"),
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminGenerateVisitSummary({
      appointmentId: 321,
      forceRegenerate: false,
    });

    expect(result.cached).toBe(true);
    expect(result.summary.zh).toBe("中文摘要");
    expect(generateBilingualVisitSummary).not.toHaveBeenCalled();
  });

  it("adminGenerateVisitSummary can regenerate and persist", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 321,
      triageSessionId: 88,
      status: "ended",
      paymentStatus: "paid",
    } as never);
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(null as never);
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue({
      id: 88,
      summary: "triage",
    } as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([] as never);
    vi.mocked(generateBilingualVisitSummary).mockResolvedValue({
      summaryZh: "新的中文总结",
      summaryEn: "New English summary",
      source: "llm",
    });
    vi.mocked(adminRepo.upsertVisitSummary).mockResolvedValue({
      id: 1,
      appointmentId: 321,
      summaryZh: "新的中文总结",
      summaryEn: "New English summary",
      source: "llm",
      createdAt: new Date("2026-03-01T00:00:00.000Z"),
      updatedAt: new Date("2026-03-01T00:10:00.000Z"),
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminGenerateVisitSummary({
      appointmentId: 321,
      forceRegenerate: true,
    });

    expect(result.cached).toBe(false);
    expect(result.summary.en).toBe("New English summary");
    expect(adminRepo.upsertVisitSummary).toHaveBeenCalled();
  });

  it("adminRetentionPolicies maps enabled as boolean", async () => {
    vi.mocked(adminRepo.ensureDefaultRetentionPolicies).mockResolvedValue([
      {
        id: 1,
        tier: "free",
        retentionDays: 7,
        enabled: 1,
        updatedBy: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
      {
        id: 2,
        tier: "paid",
        retentionDays: 180,
        enabled: 0,
        updatedBy: null,
        createdAt: new Date("2026-03-01T00:00:00.000Z"),
        updatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    ] as never);

    const caller = createAdminCaller();
    const result = await caller.adminRetentionPolicies();

    expect(result).toEqual([
      expect.objectContaining({ tier: "free", enabled: true }),
      expect.objectContaining({ tier: "paid", enabled: false }),
    ]);
  });

  it("adminHospitals returns localized hospital fields", async () => {
    vi.mocked(doctorsRepo.getAllHospitals).mockResolvedValue([
      {
        id: 10,
        name: "示例医院",
        nameEn: "Example Hospital",
        city: "上海",
        cityEn: "Shanghai",
        level: "三甲",
        levelEn: "Tier 3A",
        address: "上海市徐汇区示例路 1 号",
        addressEn: "1 Sample Rd, Xuhui District, Shanghai",
        imageUrl: "https://example.com/hospital.jpg",
      },
    ] as never);

    const caller = createAdminCaller();
    const result = await caller.adminHospitals();

    expect(result).toEqual([
      expect.objectContaining({
        id: 10,
        name: { zh: "示例医院", en: "Example Hospital" },
        city: { zh: "上海", en: "Shanghai" },
        level: { zh: "三甲", en: "Tier 3A" },
      }),
    ]);
  });

  it("adminAppointmentDetail returns localized doctor summary fields", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue({
      id: 321,
      userId: 12,
      email: "patient@example.com",
      doctorId: 88,
      triageSessionId: 77,
      appointmentType: "online_chat",
      status: "paid",
      paymentStatus: "paid",
      amount: 19900,
      currency: "USD",
      stripeSessionId: "cs_test_123",
      scheduledAt: new Date("2026-03-01T10:00:00.000Z"),
      paidAt: new Date("2026-03-01T09:00:00.000Z"),
      createdAt: new Date("2026-03-01T08:00:00.000Z"),
      updatedAt: new Date("2026-03-01T09:30:00.000Z"),
      notes: null,
    } as never);
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue({
      id: 77,
      status: "completed",
      summary: "triage summary",
      summaryGeneratedAt: new Date("2026-03-01T09:10:00.000Z"),
    } as never);
    vi.mocked(appointmentsRepo.listActiveAppointmentTokens).mockResolvedValue([] as never);
    vi.mocked(appointmentsRepo.listStatusEventsByAppointment).mockResolvedValue([] as never);
    vi.mocked(appointmentsRepo.listStripeWebhookEventsForAppointment).mockResolvedValue([] as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([] as never);
    vi.mocked(doctorsRepo.getDoctorById).mockResolvedValue({
      doctor: {
        id: 88,
        name: "张医生",
        nameEn: "Dr. Zhang",
      },
      hospital: {
        name: "示例医院",
        nameEn: "Example Hospital",
      },
      department: {
        name: "骨科",
        nameEn: "Orthopedics",
      },
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminAppointmentDetail({ appointmentId: 321 });

    expect(result.doctor).toEqual({
      id: 88,
      name: { zh: "张医生", en: "Dr. Zhang" },
      hospitalName: { zh: "示例医院", en: "Example Hospital" },
      departmentName: { zh: "骨科", en: "Orthopedics" },
    });
  });

  it("adminRunRetentionCleanup forwards createdBy", async () => {
    vi.mocked(adminRepo.runRetentionCleanup).mockResolvedValue({
      dryRun: true,
      scannedMessages: 100,
      deletedMessages: 0,
      totalCandidates: 20,
      freeCandidates: 12,
      paidCandidates: 8,
      freeRetentionDays: 7,
      paidRetentionDays: 180,
      generatedAt: new Date("2026-03-01T00:00:00.000Z").toISOString(),
    } as never);

    const caller = createAdminCaller();
    const result = await caller.adminRunRetentionCleanup({ dryRun: true });

    expect(result.totalCandidates).toBe(20);
    expect(adminRepo.runRetentionCleanup).toHaveBeenCalledWith({
      dryRun: true,
      createdBy: 99,
    });
  });
});
