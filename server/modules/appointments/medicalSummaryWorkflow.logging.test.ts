import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("../ai/publicApi", () => ({
  aiTriageSessionApi: { getById: vi.fn() },
}));
vi.mock("./accessValidation", () => ({
  validateAppointmentToken: vi.fn(),
}));
vi.mock("./repo", () => ({
  getMedicalSummaryByAppointmentId: vi.fn(),
  upsertMedicalSummaryByAppointmentId: vi.fn(),
}));

import { aiTriageSessionApi } from "../ai/publicApi";
import { validateAppointmentToken } from "./accessValidation";
import { generateMedicalSummaryDraftByTokenFlow } from "./medicalSummaryWorkflow";
import * as appointmentsRepo from "./repo";

const appointment = {
  id: 7101,
  triageSessionId: 91,
  notes: null,
} as never;

describe("medical summary workflow logging", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(validateAppointmentToken).mockResolvedValue({
      appointment,
      role: "doctor",
    } as never);
    vi.mocked(
      appointmentsRepo.getMedicalSummaryByAppointmentId
    ).mockResolvedValue(null as never);
    vi.mocked(aiTriageSessionApi.getById).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("logs draft persistence failure without medical or error details", async () => {
    vi.mocked(
      appointmentsRepo.upsertMedicalSummaryByAppointmentId
    ).mockRejectedValue(new Error("patient medical detail must stay private"));
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const result = await generateMedicalSummaryDraftByTokenFlow({
      appointmentId: 7101,
      token: "doctor-access-value",
      lang: "en",
      forceRegenerate: true,
      loadRecentMessages: async () => [],
    });

    expect(result.source).toBe("fallback");
    const serialized = String(consoleWarn.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "medical-summary",
      event: "draft_persist_failed",
      appointmentId: 7101,
      source: "ai_draft_fallback",
      errorName: "Error",
    });
    expect(serialized).not.toContain("patient medical detail");
    expect(serialized).not.toContain("doctor-access-value");
  });

  it("logs background failure without medical or error details", async () => {
    vi.mocked(aiTriageSessionApi.getById).mockRejectedValue(
      new Error("triage narrative must stay private")
    );
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const result = await generateMedicalSummaryDraftByTokenFlow({
      appointmentId: 7101,
      token: "doctor-access-value",
      lang: "zh",
      loadRecentMessages: async () => [],
    });

    expect(result.source).toBe("pending");
    await vi.waitFor(() => expect(consoleWarn).toHaveBeenCalled());
    const serialized = String(consoleWarn.mock.calls.at(-1)?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      component: "medical-summary",
      event: "background_task_failed",
      appointmentId: 7101,
      lang: "zh",
      errorName: "Error",
    });
    expect(serialized).not.toContain("triage narrative");
    expect(serialized).not.toContain("doctor-access-value");
  });
});
