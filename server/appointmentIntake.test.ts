import { describe, expect, it } from "vitest";
import { buildIntakeDefaultsFromTriage } from "../shared/appointmentIntake";

describe("buildIntakeDefaultsFromTriage", () => {
  it("prefills structured intake from extraction and summary labels", () => {
    const result = buildIntakeDefaultsFromTriage({
      summary:
        "Chief complaint: sore throat; Duration: 3 days; Medical history: asthma; Medications: ibuprofen; Allergies: penicillin; Age group: 30-39; Other symptoms: fever",
      extraction: {
        symptoms: "sore throat with pain",
        duration: "3 days",
        age: 33,
      },
    });

    expect(result).toEqual({
      chiefComplaint: "sore throat with pain",
      duration: "3 days",
      medicalHistory: "asthma",
      medications: "ibuprofen",
      allergies: "penicillin",
      ageGroup: "30-39",
      otherSymptoms: "fever",
    });
  });

  it("returns empty defaults when triage payload is missing", () => {
    expect(buildIntakeDefaultsFromTriage(undefined)).toEqual({
      chiefComplaint: "",
      duration: "",
      medicalHistory: "",
      medications: "",
      allergies: "",
      ageGroup: "",
      otherSymptoms: "",
    });
  });

  it("reads fast triage summary labels introduced by the new intake flow", () => {
    const result = buildIntakeDefaultsFromTriage({
      summary:
        "年龄/性别：31 / 女；核心症状与部位：右下腹痛；发病时间与急缓：3天逐渐加重；外伤与手术史：无；关键基础疾病：高血压",
      extraction: {
        symptoms: "右下腹痛",
        duration: "3天逐渐加重",
        age: 31,
        gender: "女",
        medicalHistory: "高血压",
        traumaOrSurgery: "无",
        otherSymptoms: "轻度恶心",
      },
    });

    expect(result).toEqual({
      chiefComplaint: "右下腹痛",
      duration: "3天逐渐加重",
      medicalHistory: "高血压",
      medications: "",
      allergies: "",
      ageGroup: "31 / 女",
      otherSymptoms: "轻度恶心",
    });
  });
});
