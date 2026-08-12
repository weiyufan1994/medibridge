import { describe, expect, it } from "vitest";
import {
  parseDepartmentBatchResponse,
  parseDoctorBatchResponse,
  parseHospitalBatchResponse,
} from "../scripts/translate-bilingual-parsers";

describe("bilingual translation batch parsers", () => {
  it("parses and sanitizes hospital batch items", () => {
    const result = parseHospitalBatchResponse(
      JSON.stringify({
        items: [
          {
            id: "1",
            sourceHash: " hash-1 ",
            nameEn: " Hospital ",
            cityEn: "not specified",
            levelEn: "Level",
            addressEn: null,
            descriptionEn: "Description",
          },
          { id: 0, sourceHash: "invalid" },
          null,
        ],
      })
    );

    expect(result.invalidEntries).toBe(2);
    expect(result.items.get("hash-1")).toMatchObject({
      id: 1,
      nameEn: "Hospital",
      cityEn: null,
      levelEn: "Level",
    });
  });

  it("parses department items and counts malformed entries", () => {
    const result = parseDepartmentBatchResponse(
      JSON.stringify({
        items: [
          {
            id: 2,
            sourceHash: "department-hash",
            nameEn: "Department of Cardiology",
            descriptionEn: " Description ",
          },
          { id: "bad", sourceHash: "bad" },
        ],
      })
    );

    expect(result.invalidEntries).toBe(1);
    expect(result.items.get("department-hash")).toMatchObject({
      id: 2,
      descriptionEn: "Description",
    });
  });

  it("parses every doctor field without accepting placeholders", () => {
    const result = parseDoctorBatchResponse(
      JSON.stringify({
        items: [
          {
            id: 3,
            sourceHash: "doctor-hash",
            nameEn: "Dr. Zhang",
            titleEn: "Chief Physician",
            specialtyEn: "Cardiology",
            expertiseEn: "not available",
            onlineConsultationEn: "Available",
            appointmentAvailableEn: "Available",
            satisfactionRateEn: "95%",
            attitudeScoreEn: "Excellent",
          },
        ],
      })
    );

    expect(result.invalidEntries).toBe(0);
    expect(result.items.get("doctor-hash")).toMatchObject({
      id: 3,
      expertiseEn: null,
      attitudeScoreEn: "Excellent",
    });
  });

  it("rejects non-item response envelopes for every entity", () => {
    expect(() => parseHospitalBatchResponse("{}")).toThrow(
      "[Hospitals] Invalid batch response format"
    );
    expect(() => parseDepartmentBatchResponse("[]")).toThrow(
      "[Departments] Invalid batch response format"
    );
    expect(() => parseDoctorBatchResponse('{"items":null}')).toThrow(
      "[Doctors] Invalid batch response format"
    );
  });
});
