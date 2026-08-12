import { describe, expect, it, vi } from "vitest";
import {
  applyDepartmentTranslation,
  applyDoctorTranslation,
  applyHospitalTranslation,
  markHospitalFailed,
} from "../scripts/translate-bilingual-persistence";
import { createEntityRunStats } from "../scripts/translate-bilingual-runtime";

const createDb = () => {
  const where = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { db: { update } as never, update, set, where };
};

const config = {
  apiCallsLogInterval: 100,
} as never;

describe("bilingual translation persistence", () => {
  it("writes complete hospital translations with the explicit provider", async () => {
    const { db, set } = createDb();
    const stats = createEntityRunStats("hospitals", config);

    await applyHospitalTranslation(
      db,
      {
        id: 1,
        nameEn: null,
        cityEn: null,
        levelEn: null,
        addressEn: null,
        descriptionEn: null,
        city: "上海",
        level: "三级甲等",
        address: "地址",
        description: "简介",
      } as never,
      {
        id: 1,
        sourceHash: "hash-1",
        nameEn: "Hospital",
        cityEn: "Shanghai",
        levelEn: "Grade III Class A",
        addressEn: "Address",
        descriptionEn: "Description",
      },
      stats,
      "translation-model"
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        nameEn: "Hospital",
        translationStatus: "done",
        lastTranslationError: null,
        translationProvider: "translation-model",
      })
    );
    expect(stats.done).toBe(1);
  });

  it("keeps incomplete department translations pending", async () => {
    const { db, set } = createDb();
    const stats = createEntityRunStats("departments", config);

    await applyDepartmentTranslation(
      db,
      {
        id: 2,
        nameEn: null,
        descriptionEn: null,
        description: "简介",
      } as never,
      {
        id: 2,
        sourceHash: "hash-2",
        nameEn: "Department of Cardiology",
        descriptionEn: null,
      },
      stats,
      "translation-model"
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        translationStatus: "pending",
        translatedAt: null,
        lastTranslationError: "Missing English fields",
        translationProvider: "translation-model",
      })
    );
    expect(stats.pending).toBe(1);
  });

  it("preserves doctor clamping and missing-field details", async () => {
    const { db, set } = createDb();
    const stats = createEntityRunStats("doctors", config);

    await applyDoctorTranslation(
      db,
      {
        id: 3,
        nameEn: null,
        titleEn: null,
        specialtyEn: null,
        expertiseEn: null,
        onlineConsultationEn: null,
        appointmentAvailableEn: null,
        satisfactionRateEn: null,
        attitudeScoreEn: null,
      } as never,
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
      stats,
      "translation-model"
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        nameEn: "Dr. Zhang",
        translationStatus: "pending",
        lastTranslationError: "Missing English fields: titleEn",
        translationProvider: "translation-model",
      })
    );
    expect(stats.pending).toBe(1);
  });

  it("preserves failed-state error serialization", async () => {
    const { db, set } = createDb();

    await markHospitalFailed(db, 4, new Error("upstream failed"));

    expect(set).toHaveBeenCalledWith({
      translationStatus: "failed",
      lastTranslationError: "upstream failed",
    });
  });
});
