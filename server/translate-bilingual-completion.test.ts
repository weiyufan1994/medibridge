import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/translate-bilingual-hospital-department-llm", () => ({
  translateHospital: vi.fn(),
  translateDepartment: vi.fn(),
  translateDepartmentNameOnly: vi.fn(),
}));
vi.mock("../scripts/translate-bilingual-doctor-llm", () => ({
  translateDoctor: vi.fn(),
  translateDoctorFieldText: vi.fn(),
}));

import {
  completeDepartmentTranslation,
  completeDoctorTranslation,
  completeHospitalTranslation,
} from "../scripts/translate-bilingual-completion";
import {
  translateDoctor,
  translateDoctorFieldText,
} from "../scripts/translate-bilingual-doctor-llm";
import {
  translateDepartment,
  translateDepartmentNameOnly,
  translateHospital,
} from "../scripts/translate-bilingual-hospital-department-llm";
import { createEntityRunStats } from "../scripts/translate-bilingual-runtime";

const config = {
  maxRetries: 0,
  rateLimitMs: 0,
  apiCallsLogInterval: 100,
} as never;

describe("bilingual translation completion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards the model and applies hospital dictionary fallback", async () => {
    vi.mocked(translateHospital).mockResolvedValue({
      nameEn: "Hospital",
      cityEn: null,
      levelEn: null,
      addressEn: "Address",
      descriptionEn: "Description",
    });
    const stats = createEntityRunStats("hospitals", config);

    const result = await completeHospitalTranslation(
      {
        name: "医院",
        city: "上海",
        level: "三级甲等",
        address: "地址",
        description: "简介",
        nameEn: null,
        cityEn: null,
        levelEn: null,
        addressEn: null,
        descriptionEn: null,
      } as never,
      {
        id: 1,
        sourceHash: "hash-1",
        nameEn: null,
        cityEn: null,
        levelEn: null,
        addressEn: null,
        descriptionEn: null,
      },
      config,
      stats,
      "translation-model"
    );

    expect(result).toMatchObject({
      cityEn: "Shanghai",
      levelEn: "Grade III Class A",
    });
    expect(translateHospital).toHaveBeenCalledWith(
      expect.any(Object),
      "translation-model"
    );
    expect(stats.fallbackCalls).toBe(1);
  });

  it("keeps the department name-only fallback before full fallback", async () => {
    vi.mocked(translateDepartmentNameOnly).mockResolvedValue(
      "Department of Cardiology"
    );
    vi.mocked(translateDepartment).mockResolvedValue({
      nameEn: "Department of Cardiology",
      descriptionEn: "Description",
    });
    const stats = createEntityRunStats("departments", config);

    const result = await completeDepartmentTranslation(
      {
        name: "心内科",
        description: "简介",
        nameEn: null,
        descriptionEn: null,
      } as never,
      {
        id: 2,
        sourceHash: "hash-2",
        nameEn: null,
        descriptionEn: null,
      },
      config,
      stats,
      "translation-model"
    );

    expect(result).toEqual({
      nameEn: "Department of Cardiology",
      descriptionEn: "Description",
    });
    expect(translateDepartmentNameOnly).toHaveBeenCalledWith(
      "心内科",
      "translation-model"
    );
    expect(translateDepartment).toHaveBeenCalledWith(
      expect.any(Object),
      "translation-model"
    );
  });

  it("preserves doctor per-field JSON and text fallback order", async () => {
    vi.mocked(translateDoctor).mockResolvedValue({ titleEn: null });
    vi.mocked(translateDoctorFieldText).mockResolvedValue("Chief Physician");
    const stats = createEntityRunStats("doctors", config);

    const result = await completeDoctorTranslation(
      { nameEn: "Dr. Zhang", titleEn: null } as never,
      {
        sourceName: "张医生",
        sourceTitle: "主任医师",
        sourceSpecialty: null,
        sourceExpertise: null,
        sourceOnlineConsultation: null,
        sourceAppointmentAvailable: null,
        sourceSatisfactionRate: null,
        sourceAttitudeScore: null,
      },
      {
        id: 3,
        sourceHash: "hash-3",
        nameEn: "Dr. Zhang",
        titleEn: null,
        specialtyEn: null,
        expertiseEn: null,
        onlineConsultationEn: null,
        appointmentAvailableEn: null,
        satisfactionRateEn: null,
        attitudeScoreEn: null,
      },
      config,
      stats,
      "translation-model"
    );

    expect(result.titleEn).toBe("Chief Physician");
    expect(translateDoctor).toHaveBeenCalledWith(
      { title: "主任医师" },
      "translation-model",
      ["titleEn"]
    );
    expect(translateDoctorFieldText).toHaveBeenCalledWith(
      "titleEn",
      "主任医师",
      "translation-model"
    );
  });
});
