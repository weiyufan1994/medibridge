import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./accessValidation", () => ({
  validateAppointmentToken: vi.fn(),
}));

vi.mock("../ai/repo", () => ({
  getAiChatSessionById: vi.fn(),
}));

vi.mock("./repo", () => ({
  getMedicalSummaryByAppointmentId: vi.fn(),
}));

vi.mock("./consultationTimer", () => ({
  resolveConsultationTimerState: vi.fn(),
}));

import { invokeLLM } from "../../_core/llm";
import * as aiRepo from "../ai/repo";
import { validateAppointmentToken } from "./accessValidation";
import { getAppointmentAccessByToken } from "./accessReadActions";
import { resolveConsultationTimerState } from "./consultationTimer";
import * as appointmentsRepo from "./repo";

const buildValidatedAppointment = () => ({
  id: 1,
  slotId: 2,
  doctorId: 3,
  triageSessionId: 4,
  appointmentType: "online_chat" as const,
  scheduledAt: new Date("2025-01-01T10:00:00.000Z"),
  status: "completed" as const,
  paymentStatus: "paid" as const,
  amount: 5000,
  currency: "USD",
  paidAt: new Date("2025-01-01T09:30:00.000Z"),
  email: "patient@example.com",
  sessionId: "session-1",
  createdAt: new Date("2025-01-01T08:00:00.000Z"),
  updatedAt: new Date("2025-01-01T10:30:00.000Z"),
  lastAccessAt: null,
  notes: null,
});

const buildMedicalSummary = (input: {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
}) => ({
  ...input,
  source: "doctor_reviewed_ai_draft",
  signedBy: 11,
  createdAt: new Date("2025-01-01T10:40:00.000Z"),
  updatedAt: new Date("2025-01-01T10:45:00.000Z"),
});

describe("appointment access medical summary localization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateAppointmentToken).mockResolvedValue({
      role: "patient",
      appointment: buildValidatedAppointment(),
    } as never);
    vi.mocked(aiRepo.getAiChatSessionById).mockResolvedValue(null as never);
    vi.mocked(resolveConsultationTimerState).mockReturnValue({
      baseDurationMinutes: 30,
      extensionMinutes: 0,
      totalDurationMinutes: 30,
    } as never);
  });

  it("translates saved medical summary sections for english patient reads", async () => {
    vi.mocked(appointmentsRepo.getMedicalSummaryByAppointmentId).mockResolvedValue(
      buildMedicalSummary({
        chiefComplaint: "咳嗽",
        historyOfPresentIllness: "咳嗽 3 天，伴发热。",
        pastMedicalHistory: "高血压",
        assessmentDiagnosis: "上呼吸道感染",
        planRecommendations: "多喝水，注意休息。",
      }) as never
    );
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "mock",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: JSON.stringify({
              chiefComplaint: "Cough",
              historyOfPresentIllness:
                "Cough for 3 days with fever.",
              pastMedicalHistory: "Hypertension",
              assessmentDiagnosis: "Upper respiratory tract infection",
              planRecommendations: "Drink more water and rest well.",
            }),
          },
        },
      ],
    } as never);

    const result = await getAppointmentAccessByToken({
      appointmentId: 1,
      token: "patient-token",
      lang: "en",
      parseIntake: () => ({ success: false } as const),
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.medicalSummary).toMatchObject({
      chiefComplaint: "Cough",
      historyOfPresentIllness: "Cough for 3 days with fever.",
      pastMedicalHistory: "Hypertension",
      assessmentDiagnosis: "Upper respiratory tract infection",
      planRecommendations: "Drink more water and rest well.",
    });
  });

  it("filters unsafe chinese summary sections when english localization is unavailable", async () => {
    vi.mocked(appointmentsRepo.getMedicalSummaryByAppointmentId).mockResolvedValue(
      buildMedicalSummary({
        chiefComplaint: "cough",
        historyOfPresentIllness: "咳嗽 3 天，伴发热。",
        pastMedicalHistory: "高血压",
        assessmentDiagnosis: "上呼吸道感染",
        planRecommendations: "多喝水，注意休息。",
      }) as never
    );
    vi.mocked(invokeLLM).mockResolvedValue({
      id: "mock",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: "",
          },
        },
      ],
    } as never);

    const result = await getAppointmentAccessByToken({
      appointmentId: 1,
      token: "patient-token",
      lang: "en",
      parseIntake: () => ({ success: false } as const),
    });

    expect(result.medicalSummary).toMatchObject({
      chiefComplaint: "cough",
      historyOfPresentIllness: "",
      pastMedicalHistory: "",
      assessmentDiagnosis: "",
      planRecommendations: "",
    });
    expect(JSON.stringify(result.medicalSummary)).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
