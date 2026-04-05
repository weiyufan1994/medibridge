import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../_core/llm", () => ({
  createEmbedding: vi.fn(),
  invokeLLM: vi.fn(),
}));

vi.mock("../doctors/repo", () => ({
  searchDoctors: vi.fn(),
  searchDoctorsByEmbedding: vi.fn(),
}));

vi.mock("../visit/repo", () => ({
  upsertPatientSession: vi.fn(),
  getPatientSession: vi.fn(),
}));

import { createEmbedding, invokeLLM } from "../../_core/llm";
import * as doctorsRepo from "../doctors/repo";
import * as visitRepo from "../visit/repo";
import { sendMessageAction } from "./actions";

const buildDoctorSearchResult = (input: {
  id: number;
  nameEn?: string | null;
  hospitalNameEn?: string | null;
  departmentNameEn?: string | null;
  titleEn?: string | null;
  expertiseEn?: string | null;
}) => ({
  doctor: {
    id: input.id,
    name: `医生${input.id}`,
    nameEn: input.nameEn ?? null,
    title: "主任医师",
    titleEn: input.titleEn ?? null,
    specialty: "呼吸科",
    specialtyEn: "Respiratory Medicine",
    expertise: "擅长咳嗽和呼吸困难",
    expertiseEn: input.expertiseEn ?? null,
    recommendationScore: 100 - input.id,
  },
  hospital: {
    name: `医院${input.id}`,
    nameEn: input.hospitalNameEn ?? null,
  },
  department: {
    name: "呼吸科",
    nameEn: input.departmentNameEn ?? null,
  },
});

describe("chat actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createEmbedding).mockResolvedValue([0.1, 0.2] as never);
    vi.mocked(doctorsRepo.searchDoctorsByEmbedding).mockResolvedValue([] as never);
    vi.mocked(visitRepo.upsertPatientSession).mockResolvedValue(undefined as never);
  });

  it("passes structured missing-translation metadata to english ranking prompts", async () => {
    vi.mocked(doctorsRepo.searchDoctors).mockResolvedValue(
      [
        buildDoctorSearchResult({
          id: 1,
          nameEn: null,
          hospitalNameEn: "Shanghai General Hospital",
          departmentNameEn: null,
          titleEn: null,
          expertiseEn: "Cough and breathing issues",
        }),
        buildDoctorSearchResult({
          id: 2,
          nameEn: "Dr. Li",
          hospitalNameEn: "Shanghai Pulmonary Hospital",
          departmentNameEn: "Respiratory Department",
          titleEn: "Chief Physician",
          expertiseEn: "Adult asthma care",
        }),
        buildDoctorSearchResult({
          id: 3,
          nameEn: "Dr. Wang",
          hospitalNameEn: null,
          departmentNameEn: "Respiratory Clinic",
          titleEn: "Attending Physician",
          expertiseEn: null,
        }),
      ] as never
    );

    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        choices: [{ message: { content: "Tell me more." } }],
      } as never)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keywords: ["cough", "phlegm"],
                symptoms: "cough with phlegm",
                duration: "3 days",
                age: 34,
                urgency: "medium",
                readyForRecommendation: true,
              }),
            },
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                selectedDoctors: [
                  {
                    doctorId: 2,
                    reason: "Respiratory fit",
                  },
                ],
              }),
            },
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content:
                "I recommend Dr. Li at Shanghai Pulmonary Hospital for follow-up.",
            },
          },
        ],
      } as never);

    const result = await sendMessageAction({
      sessionId: "session-1",
      message: "I have had cough and phlegm for 3 days.",
      chatHistory: [],
      lang: "en",
    });

    expect(result.recommendedDoctors).toEqual([
      {
        doctorId: 2,
        reason: "Respiratory fit",
      },
    ]);

    const rankingCall = vi.mocked(invokeLLM).mock.calls[2]?.[0] as {
      messages?: Array<{ content?: string }>;
    };
    const rankingUserContent = rankingCall.messages?.[1]?.content ?? "";

    expect(rankingUserContent).not.toContain("Translation in progress");
    expect(rankingUserContent).toContain("\"missingEnglishFields\"");

    const candidateJson = rankingUserContent.split("Candidate doctors JSON:\n")[1];
    const candidates = JSON.parse(candidateJson) as Array<{
      doctorId: number;
      doctorName: string | null;
      departmentName: string | null;
      missingEnglishFields: string[];
    }>;

    expect(candidates[0]).toMatchObject({
      doctorId: 1,
      doctorName: null,
      departmentName: null,
      missingEnglishFields: ["doctorName", "departmentName", "title"],
    });
    expect(candidates[2]).toMatchObject({
      doctorId: 3,
      missingEnglishFields: ["hospitalName", "expertise"],
    });
  });
});
