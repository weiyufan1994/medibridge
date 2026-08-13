import { beforeEach, describe, expect, it, vi } from "vitest";

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
  tryTransitionAppointmentById: vi.fn(),
  getAppointmentById: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import { aiTriageSessionApi } from "../ai/publicApi";
import { validateAppointmentToken } from "./accessValidation";
import {
  generateMedicalSummaryDraftByTokenFlow,
  signMedicalSummaryByTokenFlow,
} from "./medicalSummaryWorkflow";
import * as appointmentsRepo from "./repo";

const appointment = {
  id: 8_101,
  triageSessionId: 91,
  notes: JSON.stringify({
    chiefComplaint: "cough",
    medicalHistory: "hypertension",
  }),
} as never;

const generatedDraft = {
  chiefComplaint: "Cough",
  historyOfPresentIllness: "Cough for three days with mild fever",
  pastMedicalHistory: "Hypertension",
  assessmentDiagnosis: "Upper respiratory infection",
  planRecommendations: "Rest, hydrate, and seek review if worse",
};

function mockValidatedRole(role: "doctor" | "patient", value = appointment) {
  vi.mocked(validateAppointmentToken).mockResolvedValue({
    appointment: value,
    role,
  } as never);
}

describe("medical summary workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidatedRole("doctor");
    vi.mocked(
      appointmentsRepo.getMedicalSummaryByAppointmentId
    ).mockResolvedValue(null as never);
    vi.mocked(aiTriageSessionApi.getById).mockResolvedValue({
      summary: "Prior triage summary",
    } as never);
  });

  it("persists a complete LLM draft with a chronological safe transcript", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(generatedDraft) } }],
    } as never);
    const loadRecentMessages = vi.fn(async () => [
      {
        content: "Newest original",
        translatedContent: "Newest translated",
        senderType: "doctor",
        createdAt: new Date("2026-08-13T02:00:00.000Z"),
      },
      {
        content: "Oldest patient message",
        translatedContent: null,
        senderType: "patient",
        createdAt: new Date("2026-08-13T01:00:00.000Z"),
      },
      {
        content: "   ",
        translatedContent: null,
        senderType: "patient",
        createdAt: new Date("2026-08-13T00:00:00.000Z"),
      },
    ]);

    const result = await generateMedicalSummaryDraftByTokenFlow({
      appointmentId: 8_101,
      token: "doctor-token-value",
      lang: "en",
      forceRegenerate: true,
      requestMetadata: { requestId: "summary-request" },
      loadRecentMessages,
    });

    expect(result).toEqual({ ...generatedDraft, source: "llm" });
    expect(validateAppointmentToken).toHaveBeenCalledWith(
      8_101,
      "doctor-token-value",
      "read_history",
      { requestId: "summary-request" }
    );
    expect(loadRecentMessages).toHaveBeenCalledWith(8_101, 80);
    const llmInput = vi.mocked(invokeLLM).mock.calls[0]?.[0];
    const userMessage = String(llmInput?.messages[1]?.content);
    expect(userMessage.indexOf("Oldest patient message")).toBeLessThan(
      userMessage.indexOf("Newest translated")
    );
    expect(userMessage).not.toContain("Newest original");
    expect(
      appointmentsRepo.upsertMedicalSummaryByAppointmentId
    ).toHaveBeenCalledWith({
      appointmentId: 8_101,
      ...generatedDraft,
      source: "ai_draft_llm",
      signedBy: null,
    });
  });

  it("falls back when a validated LLM draft contains an empty section", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...generatedDraft,
              assessmentDiagnosis: "   ",
            }),
          },
        },
      ],
    } as never);

    const result = await generateMedicalSummaryDraftByTokenFlow({
      appointmentId: 8_101,
      token: "doctor-token-value",
      lang: "en",
      forceRegenerate: true,
      loadRecentMessages: async () => [
        {
          content: "Patient reports cough",
          translatedContent: null,
          senderType: "patient",
          createdAt: new Date("2026-08-13T01:00:00.000Z"),
        },
      ],
    });

    expect(result.source).toBe("fallback");
    expect(
      appointmentsRepo.upsertMedicalSummaryByAppointmentId
    ).toHaveBeenCalledWith(
      expect.objectContaining({ source: "ai_draft_fallback" })
    );
  });

  it("never overwrites a signed saved summary during forced regeneration", async () => {
    vi.mocked(
      appointmentsRepo.getMedicalSummaryByAppointmentId
    ).mockResolvedValue({
      ...generatedDraft,
      signedBy: 44,
    } as never);
    const loadRecentMessages = vi.fn();

    const result = await generateMedicalSummaryDraftByTokenFlow({
      appointmentId: 8_101,
      token: "doctor-token-value",
      lang: "en",
      forceRegenerate: true,
      loadRecentMessages,
    });

    expect(result).toEqual({ ...generatedDraft, source: "saved" });
    expect(loadRecentMessages).not.toHaveBeenCalled();
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(
      appointmentsRepo.upsertMedicalSummaryByAppointmentId
    ).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent background generation for one appointment", async () => {
    let resolveMessages:
      | ((
          value: Array<{
            content: string;
            translatedContent: null;
            senderType: string;
            createdAt: Date;
          }>
        ) => void)
      | undefined;
    const loadRecentMessages = vi.fn(
      () =>
        new Promise<
          Array<{
            content: string;
            translatedContent: null;
            senderType: string;
            createdAt: Date;
          }>
        >(resolve => {
          resolveMessages = resolve;
        })
    );

    const first = await generateMedicalSummaryDraftByTokenFlow({
      appointmentId: 8_101,
      token: "doctor-token-value",
      lang: "en",
      loadRecentMessages,
    });
    const second = await generateMedicalSummaryDraftByTokenFlow({
      appointmentId: 8_101,
      token: "doctor-token-value",
      lang: "en",
      loadRecentMessages,
    });

    expect(first.source).toBe("pending");
    expect(second.source).toBe("pending");
    expect(loadRecentMessages).toHaveBeenCalledTimes(1);

    resolveMessages?.([]);
    await vi.waitFor(() =>
      expect(
        appointmentsRepo.upsertMedicalSummaryByAppointmentId
      ).toHaveBeenCalledTimes(1)
    );
  });

  it("rejects patient signing before changing appointment state", async () => {
    mockValidatedRole("patient");

    await expect(
      signMedicalSummaryByTokenFlow({
        appointmentId: 8_101,
        token: "patient-token-value",
        operatorId: null,
        ...generatedDraft,
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(
      appointmentsRepo.tryTransitionAppointmentById
    ).not.toHaveBeenCalled();
  });

  it("fails explicitly if the appointment disappears after signing", async () => {
    vi.mocked(appointmentsRepo.tryTransitionAppointmentById).mockResolvedValue({
      ok: true,
    } as never);
    vi.mocked(appointmentsRepo.getAppointmentById).mockResolvedValue(
      null as never
    );

    await expect(
      signMedicalSummaryByTokenFlow({
        appointmentId: 8_101,
        token: "doctor-token-value",
        operatorId: 44,
        requestMetadata: { requestId: "sign-request" },
        ...generatedDraft,
      })
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after signing medical summary",
    });

    expect(validateAppointmentToken).toHaveBeenCalledWith(
      8_101,
      "doctor-token-value",
      "read_history",
      { requestId: "sign-request" }
    );
    expect(
      appointmentsRepo.upsertMedicalSummaryByAppointmentId
    ).toHaveBeenCalledWith({
      appointmentId: 8_101,
      ...generatedDraft,
      source: "doctor_reviewed_ai_draft",
      signedBy: 44,
    });
  });
});
