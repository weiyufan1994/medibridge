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
});
