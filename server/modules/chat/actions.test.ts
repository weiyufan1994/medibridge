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

const ENGLISH_GROUNDED_SYSTEM_PROMPT_SNIPPET =
  "Use ONLY the doctors/hospitals/departments provided in input JSON.";
const ENGLISH_NO_MATCH_FOLLOWUP = [
  "I don't have enough clearly matched doctors in our current database yet.",
  "To narrow it down accurately, could you share:",
  "1) where the discomfort is most obvious,",
  "2) whether you have nausea/vomiting/diarrhea or cough/phlegm/chest pain,",
  "3) whether symptoms worsen after meals, activity, or at night?",
  "Once you add these details, I can give a more precise recommendation.",
].join("\n");

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

const findGroundedRecommendationCall = () =>
  vi.mocked(invokeLLM).mock.calls.find(([request]) =>
    request.messages?.some(
      message =>
        typeof message.content === "string" &&
        message.content.includes(ENGLISH_GROUNDED_SYSTEM_PROMPT_SNIPPET)
    )
  )?.[0];

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

  it("filters english grounded recommendations down to candidates with required english display fields", async () => {
    vi.mocked(doctorsRepo.searchDoctors).mockResolvedValue(
      [
        buildDoctorSearchResult({
          id: 1,
          nameEn: "Chen Wei",
          hospitalNameEn: "Shanghai General Hospital",
          departmentNameEn: "Respiratory Department",
          titleEn: "Chief Physician",
          expertiseEn: "Chronic cough and breathing issues",
        }),
        buildDoctorSearchResult({
          id: 2,
          nameEn: "Li Ming",
          hospitalNameEn: null,
          departmentNameEn: "Respiratory Department",
          titleEn: "Attending Physician",
          expertiseEn: "Asthma care",
        }),
        buildDoctorSearchResult({
          id: 3,
          nameEn: "Wang Jun",
          hospitalNameEn: "Shanghai Pulmonary Hospital",
          departmentNameEn: "Respiratory Clinic",
          titleEn: "Associate Chief Physician",
          expertiseEn: "General respiratory care",
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
                  { doctorId: 1, reason: "Best fit for your symptoms" },
                  { doctorId: 2, reason: "Also relevant" },
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
                "I recommend Dr. Chen Wei at Shanghai General Hospital for follow-up.",
            },
          },
        ],
      } as never);

    const result = await sendMessageAction({
      sessionId: "session-english-grounded-filter",
      message: "I have had cough and phlegm for 3 days.",
      chatHistory: [],
      lang: "en",
    });

    expect(result.message).toContain("Dr. Chen Wei");

    const groundedCall = findGroundedRecommendationCall() as {
      messages?: Array<{ content?: string }>;
    };
    const groundedPayload = JSON.parse(
      groundedCall.messages?.[1]?.content ?? "{}"
    ) as {
      recommendations?: Array<{
        doctorId: number;
        doctorName: string;
        hospitalName: string;
        departmentName: string;
      }>;
    };

    expect(groundedPayload.recommendations).toEqual([
      {
        doctorId: 1,
        reason: "Best fit for your symptoms",
        doctorName: "Chen Wei",
        hospitalName: "Shanghai General Hospital",
        departmentName: "Respiratory Department",
      },
    ]);
  });

  it("uses english-safe fallback copy when grounded recommendations have no required english display fields", async () => {
    vi.mocked(doctorsRepo.searchDoctors).mockResolvedValue(
      [
        buildDoctorSearchResult({
          id: 1,
          nameEn: "Chen Wei",
          hospitalNameEn: "Shanghai General Hospital",
          departmentNameEn: null,
          titleEn: "Chief Physician",
          expertiseEn: null,
        }),
        buildDoctorSearchResult({
          id: 2,
          nameEn: "Li Ming",
          hospitalNameEn: "Shanghai Pulmonary Hospital",
          departmentNameEn: null,
          titleEn: "Attending Physician",
          expertiseEn: null,
        }),
        buildDoctorSearchResult({
          id: 3,
          nameEn: "Wang Jun",
          hospitalNameEn: "Ruijin Hospital",
          departmentNameEn: null,
          titleEn: "Associate Chief Physician",
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
                selectedDoctors: [],
              }),
            },
          },
        ],
      } as never);

    const result = await sendMessageAction({
      sessionId: "session-english-grounded-fallback",
      message: "I have had cough and phlegm for 3 days.",
      chatHistory: [],
      lang: "en",
    });

    expect(result.message).toBe(ENGLISH_NO_MATCH_FOLLOWUP);
    expect(result.recommendedDoctors).toEqual([
      {
        doctorId: 1,
        reason: "Recommended based on your symptoms and medical needs.",
      },
      {
        doctorId: 2,
        reason: "Recommended based on your symptoms and medical needs.",
      },
      {
        doctorId: 3,
        reason: "Recommended based on your symptoms and medical needs.",
      },
    ]);
    expect(findGroundedRecommendationCall()).toBeUndefined();
  });
});
