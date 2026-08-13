import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./modules/appointments/repo", () => ({
  getAppointmentById: vi.fn(),
}));

vi.mock("./modules/ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
}));

vi.mock("./modules/visit/repo", () => ({
  getRecentMessages: vi.fn(),
}));

vi.mock("./modules/admin/repo", () => ({
  getVisitSummaryByAppointmentId: vi.fn(),
  upsertVisitSummary: vi.fn(),
}));

vi.mock("./modules/admin/visitSummary", () => ({
  generateBilingualVisitSummary: vi.fn(),
}));

vi.mock("./modules/admin/pdf", () => ({
  renderSimpleTextPdf: vi.fn(() => Buffer.from("visit-summary-pdf")),
}));

import * as aiRepo from "./modules/ai/repo";
import * as adminRepo from "./modules/admin/repo";
import { renderSimpleTextPdf } from "./modules/admin/pdf";
import { generateBilingualVisitSummary } from "./modules/admin/visitSummary";
import * as appointmentsRepo from "./modules/appointments/repo";
import * as visitRepo from "./modules/visit/repo";
import { systemRouter } from "./routers/system";

function createCaller(role: "admin" | "ops") {
  return systemRouter.createCaller({
    user: { id: role === "admin" ? 99 : 77, role },
    req: {
      protocol: "https",
      headers: { host: "medibridge.test" },
      get(name: string) {
        return name.toLowerCase() === "host" ? "medibridge.test" : undefined;
      },
    },
  } as never);
}

function storedSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 31,
    appointmentId: 321,
    summaryZh: "中文会诊摘要",
    summaryEn: "English visit summary",
    source: "llm",
    generatedBy: 99,
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    updatedAt: new Date("2026-03-01T00:10:00.000Z"),
    ...overrides,
  } as never;
}

function appointment() {
  return {
    id: 321,
    triageSessionId: 88,
    status: "ended",
    paymentStatus: "paid",
  } as never;
}

describe("system visit summary procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows ops to read an absent summary", async () => {
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(
      null as never
    );

    await expect(
      createCaller("ops").adminGetVisitSummary({ appointmentId: 321 })
    ).resolves.toBeNull();
  });

  it("returns the persisted bilingual summary without changing metadata", async () => {
    const summary = storedSummary();
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(
      summary
    );

    await expect(
      createCaller("ops").adminGetVisitSummary({ appointmentId: 321 })
    ).resolves.toEqual({
      id: 31,
      appointmentId: 321,
      summary: { zh: "中文会诊摘要", en: "English visit summary" },
      source: "llm",
      generatedBy: 99,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    });
  });

  it("keeps generation and PDF export admin-only", async () => {
    const caller = createCaller("ops");

    await expect(
      caller.adminGenerateVisitSummary({ appointmentId: 321 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.adminExportVisitSummaryPdf({ appointmentId: 321, lang: "en" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(appointmentsRepo.getAppointmentById).not.toHaveBeenCalled();
  });

  it("rejects generation when the appointment does not exist", async () => {
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      undefined as never
    );

    await expect(
      createCaller("admin").adminGenerateVisitSummary({ appointmentId: 404 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Appointment not found",
    });
    expect(adminRepo.getVisitSummaryByAppointmentId).not.toHaveBeenCalled();
  });

  it("returns a cached summary and falls back to its creation timestamp", async () => {
    const summary = storedSummary({ updatedAt: null });
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      appointment()
    );
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(
      summary
    );

    await expect(
      createCaller("admin").adminGenerateVisitSummary({ appointmentId: 321 })
    ).resolves.toEqual({
      appointmentId: 321,
      summary: { zh: "中文会诊摘要", en: "English visit summary" },
      source: "llm",
      generatedAt: summary.createdAt,
      cached: true,
    });
    expect(generateBilingualVisitSummary).not.toHaveBeenCalled();
  });

  it("force-regenerates from chronological messages and safely uses generated output", async () => {
    const later = {
      senderType: "doctor",
      content: "Later message",
      translatedContent: "后续消息",
      createdAt: new Date("2026-03-01T00:02:00.000Z"),
    };
    const earlier = {
      senderType: "patient",
      content: "Earlier message",
      translatedContent: null,
      createdAt: new Date("2026-03-01T00:01:00.000Z"),
    };
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      appointment()
    );
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(
      storedSummary()
    );
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(null as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([
      later,
      earlier,
    ] as never);
    vi.mocked(generateBilingualVisitSummary).mockResolvedValue({
      summaryZh: "新中文摘要",
      summaryEn: "New English summary",
      source: "fallback",
    });
    vi.mocked(adminRepo.upsertVisitSummary).mockResolvedValue(null as never);

    const result = await createCaller("admin").adminGenerateVisitSummary({
      appointmentId: 321,
      forceRegenerate: true,
    });

    expect(result).toMatchObject({
      appointmentId: 321,
      summary: { zh: "新中文摘要", en: "New English summary" },
      source: "fallback",
      cached: false,
    });
    expect(result.generatedAt).toBeInstanceOf(Date);
    expect(generateBilingualVisitSummary).toHaveBeenCalledWith({
      appointment: appointment(),
      triageSummary: null,
      messages: [earlier, later],
    });
    expect(adminRepo.upsertVisitSummary).toHaveBeenCalledWith({
      appointmentId: 321,
      summaryZh: "新中文摘要",
      summaryEn: "New English summary",
      source: "fallback",
      generatedBy: 99,
    });
  });

  it("exports an existing English summary as a PDF", async () => {
    const summary = storedSummary({ updatedAt: null });
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(
      summary
    );

    const result = await createCaller("admin").adminExportVisitSummaryPdf({
      appointmentId: 321,
      lang: "en",
    });

    expect(result).toMatchObject({
      appointmentId: 321,
      filename: "visit-summary-321-en.pdf",
      mimeType: "application/pdf",
      base64: Buffer.from("visit-summary-pdf").toString("base64"),
    });
    expect(renderSimpleTextPdf).toHaveBeenCalledWith(
      expect.stringContaining("English visit summary")
    );
    expect(appointmentsRepo.getAppointmentById).not.toHaveBeenCalled();
  });

  it("rejects PDF generation when the appointment does not exist", async () => {
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(
      null as never
    );
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      undefined as never
    );

    await expect(
      createCaller("admin").adminExportVisitSummaryPdf({ appointmentId: 404 })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Appointment not found",
    });
  });

  it("generates and persists a missing summary before PDF export", async () => {
    const later = {
      senderType: "doctor",
      content: "Later",
      translatedContent: null,
      createdAt: new Date("2026-03-01T00:02:00.000Z"),
    };
    const earlier = {
      senderType: "patient",
      content: "Earlier",
      translatedContent: "更早",
      createdAt: new Date("2026-03-01T00:01:00.000Z"),
    };
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(
      null as never
    );
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      appointment()
    );
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue({
      summary: "Triage result",
    } as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([
      later,
      earlier,
    ] as never);
    vi.mocked(generateBilingualVisitSummary).mockResolvedValue({
      summaryZh: "即时中文摘要",
      summaryEn: "Generated English summary",
      source: "llm",
    });
    vi.mocked(adminRepo.upsertVisitSummary).mockResolvedValue(
      storedSummary({
        summaryZh: "即时中文摘要",
        summaryEn: "Generated English summary",
        createdAt: new Date("2026-03-02T00:00:00.000Z"),
        updatedAt: null,
      })
    );

    const result = await createCaller("admin").adminExportVisitSummaryPdf({
      appointmentId: 321,
    });

    expect(result.filename).toBe("visit-summary-321-zh.pdf");
    expect(generateBilingualVisitSummary).toHaveBeenCalledWith({
      appointment: appointment(),
      triageSummary: "Triage result",
      messages: [earlier, later],
    });
    expect(adminRepo.upsertVisitSummary).toHaveBeenCalledWith(
      expect.objectContaining({ generatedBy: 99 })
    );
    expect(renderSimpleTextPdf).toHaveBeenCalledWith(
      expect.stringContaining("即时中文摘要")
    );
  });

  it("fails closed when a newly generated summary cannot be reloaded", async () => {
    vi.mocked(adminRepo.getVisitSummaryByAppointmentId).mockResolvedValue(
      null as never
    );
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      appointment()
    );
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(null as never);
    vi.mocked(visitRepo.getRecentMessages).mockResolvedValue([] as never);
    vi.mocked(generateBilingualVisitSummary).mockResolvedValue({
      summaryZh: "中文摘要",
      summaryEn: "English summary",
      source: "fallback",
    });
    vi.mocked(adminRepo.upsertVisitSummary).mockResolvedValue(null as never);

    await expect(
      createCaller("admin").adminExportVisitSummaryPdf({ appointmentId: 321 })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to load summary",
    });
    expect(renderSimpleTextPdf).not.toHaveBeenCalled();
  });
});
