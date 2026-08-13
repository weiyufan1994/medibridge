import { describe, expect, it } from "vitest";
import {
  clampSectionText,
  extractAssistantText,
  PENDING_MEDICAL_SUMMARY_DRAFT,
  toFallbackDraft,
} from "./medicalSummaryDraft";

describe("medical summary draft helpers", () => {
  it("extracts and trims a string assistant response", () => {
    expect(extractAssistantText("  structured response  ")).toBe(
      "structured response"
    );
  });

  it("returns empty text for unsupported assistant response shapes", () => {
    expect(extractAssistantText(null)).toBe("");
    expect(extractAssistantText({ type: "text", text: "not an array" })).toBe(
      ""
    );
  });

  it("joins only text parts from a multipart assistant response", () => {
    expect(
      extractAssistantText([
        null,
        { type: "image", text: "ignored image text" },
        { type: "text", text: "first" },
        { type: "text", text: 42 },
        { type: "text" },
      ])
    ).toBe("first\n42");
  });

  it("uses normalized intake and triage content for an English fallback", () => {
    expect(
      toFallbackDraft({
        lang: "en",
        triageSummary: "  Cough for three days.  ",
        intake: {
          chiefComplaint: "  Cough  ",
          medicalHistory: "  Hypertension  ",
        },
      })
    ).toEqual({
      chiefComplaint: "Cough",
      historyOfPresentIllness: "Cough for three days.",
      pastMedicalHistory: "Hypertension",
      assessmentDiagnosis: "Please add assessment / diagnosis.",
      planRecommendations: "Please add plan and follow-up recommendations.",
      source: "fallback",
    });
  });

  it("uses explicit English placeholders when source content is absent", () => {
    expect(
      toFallbackDraft({ lang: "en", triageSummary: "   ", intake: null })
    ).toEqual({
      chiefComplaint: "Chief complaint to be completed by doctor.",
      historyOfPresentIllness:
        "Please complete HPI based on consultation transcript.",
      pastMedicalHistory:
        "No past medical history captured yet. Please complete.",
      assessmentDiagnosis: "Please add assessment / diagnosis.",
      planRecommendations: "Please add plan and follow-up recommendations.",
      source: "fallback",
    });
  });

  it("uses normalized intake and triage content for a Chinese fallback", () => {
    expect(
      toFallbackDraft({
        lang: "zh",
        triageSummary: "  咳嗽三天。  ",
        intake: {
          chiefComplaint: "  咳嗽  ",
          medicalHistory: "  高血压  ",
        },
      })
    ).toEqual({
      chiefComplaint: "咳嗽",
      historyOfPresentIllness: "咳嗽三天。",
      pastMedicalHistory: "高血压",
      assessmentDiagnosis: "请医生补充初步诊断。",
      planRecommendations: "请医生补充处置方案与随访建议。",
      source: "fallback",
    });
  });

  it("uses explicit Chinese placeholders when source content is absent", () => {
    expect(
      toFallbackDraft({
        lang: "zh",
        triageSummary: null,
        intake: { chiefComplaint: " ", medicalHistory: " " },
      })
    ).toEqual({
      chiefComplaint: "患者主诉待医生补充。",
      historyOfPresentIllness: "请结合会诊记录补充现病史。",
      pastMedicalHistory: "暂无明确既往史，请补充。",
      assessmentDiagnosis: "请医生补充初步诊断。",
      planRecommendations: "请医生补充处置方案与随访建议。",
      source: "fallback",
    });
  });

  it("keeps the pending response empty and explicitly typed", () => {
    expect(PENDING_MEDICAL_SUMMARY_DRAFT).toEqual({
      chiefComplaint: "",
      historyOfPresentIllness: "",
      pastMedicalHistory: "",
      assessmentDiagnosis: "",
      planRecommendations: "",
      source: "pending",
    });
  });

  it("trims section text and enforces the 4000-character boundary", () => {
    expect(clampSectionText(`  ${"a".repeat(3_999)}  `)).toHaveLength(3_999);
    expect(clampSectionText(`  ${"b".repeat(4_000)}  `)).toHaveLength(4_000);
    expect(clampSectionText(`  ${"c".repeat(4_001)}  `)).toBe(
      "c".repeat(4_000)
    );
  });
});
