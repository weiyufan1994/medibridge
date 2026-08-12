import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import {
  translateDoctor,
  translateDoctorBatch,
  translateDoctorFieldText,
} from "../scripts/translate-bilingual-doctor-llm";
import {
  buildDoctorPartialInput,
  emptyDoctorTranslationSnapshot,
  getMissingDoctorFields,
  parseDoctorPartialResponse,
} from "../scripts/translate-bilingual-doctor-support";

describe("bilingual doctor translation support", () => {
  it("preserves missing-field selection and partial parsing", () => {
    const source = {
      sourceName: "张医生",
      sourceTitle: "主任医师",
      sourceSpecialty: null,
      sourceExpertise: null,
      sourceOnlineConsultation: null,
      sourceAppointmentAvailable: null,
      sourceSatisfactionRate: null,
      sourceAttitudeScore: null,
    };
    const translated = {
      ...emptyDoctorTranslationSnapshot(),
      nameEn: "Dr. Zhang",
    };

    expect(getMissingDoctorFields(source, translated)).toEqual(["titleEn"]);
    expect(buildDoctorPartialInput(source, ["titleEn"])).toEqual({
      title: "主任医师",
    });
    expect(
      parseDoctorPartialResponse('{"titleEn":" Chief Physician "}', ["titleEn"])
    ).toEqual({ titleEn: "Chief Physician" });
  });
});

describe("bilingual doctor LLM adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the model and requested-field schema", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ titleEn: "Chief Physician" }),
          },
        },
      ],
    } as never);

    await expect(
      translateDoctor({ title: "主任医师" }, "translation-model", ["titleEn"])
    ).resolves.toEqual({ titleEn: "Chief Physician" });

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "translation-model",
        response_format: expect.objectContaining({
          json_schema: expect.objectContaining({
            name: "doctor_translation",
            schema: expect.objectContaining({
              properties: { titleEn: { type: ["string", "null"] } },
              required: ["titleEn"],
            }),
          }),
        }),
      })
    );
  });

  it("preserves the plain-text field fallback contract", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: " Chief Physician " } }],
    } as never);

    await expect(
      translateDoctorFieldText("titleEn", "主任医师", "translation-model")
    ).resolves.toBe("Chief Physician");

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "translation-model",
        response_format: { type: "text" },
        max_tokens: 512,
      })
    );
  });

  it("preserves the batch schema, token limit, and parser", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              items: [
                {
                  id: 1,
                  sourceHash: "hash-1",
                  nameEn: "Dr. Zhang",
                  titleEn: null,
                  specialtyEn: null,
                  expertiseEn: null,
                  onlineConsultationEn: null,
                  appointmentAvailableEn: null,
                  satisfactionRateEn: null,
                  attitudeScoreEn: null,
                },
              ],
            }),
          },
        },
      ],
    } as never);

    const result = await translateDoctorBatch(
      [
        {
          id: 1,
          sourceHash: "hash-1",
          name: "张医生",
          title: null,
          specialty: null,
          expertise: null,
          onlineConsultation: null,
          appointmentAvailable: null,
          satisfactionRate: null,
          attitudeScore: null,
        },
      ],
      "translation-model"
    );

    expect(result.items.get("hash-1")?.nameEn).toBe("Dr. Zhang");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "translation-model",
        max_tokens: 4096,
        response_format: expect.objectContaining({
          json_schema: expect.objectContaining({
            name: "doctor_batch_translation",
          }),
        }),
      })
    );
  });
});
