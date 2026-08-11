export type RecentConsultationMessage = {
  content: string;
  translatedContent: string | null;
  createdAt: Date;
  senderType: string;
};

export type LoadRecentConsultationMessages = (
  appointmentId: number,
  limit: number
) => Promise<RecentConsultationMessage[]>;

export const PENDING_MEDICAL_SUMMARY_DRAFT = {
  chiefComplaint: "",
  historyOfPresentIllness: "",
  pastMedicalHistory: "",
  assessmentDiagnosis: "",
  planRecommendations: "",
  source: "pending" as const,
};

export function extractAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map(item => {
      if (
        item &&
        typeof item === "object" &&
        "type" in item &&
        (item as { type?: string }).type === "text"
      ) {
        return String((item as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("\n")
    .trim();
}

export function toFallbackDraft(input: {
  lang: "en" | "zh";
  triageSummary?: string | null;
  intake: {
    chiefComplaint?: string;
    medicalHistory?: string;
  } | null;
}) {
  const chiefComplaint = input.intake?.chiefComplaint?.trim() || "";
  const pastMedicalHistory = input.intake?.medicalHistory?.trim() || "";
  const triageSummary = input.triageSummary?.trim() || "";

  if (input.lang === "zh") {
    return {
      chiefComplaint: chiefComplaint || "患者主诉待医生补充。",
      historyOfPresentIllness: triageSummary || "请结合会诊记录补充现病史。",
      pastMedicalHistory: pastMedicalHistory || "暂无明确既往史，请补充。",
      assessmentDiagnosis: "请医生补充初步诊断。",
      planRecommendations: "请医生补充处置方案与随访建议。",
      source: "fallback" as const,
    };
  }

  return {
    chiefComplaint:
      chiefComplaint || "Chief complaint to be completed by doctor.",
    historyOfPresentIllness:
      triageSummary || "Please complete HPI based on consultation transcript.",
    pastMedicalHistory:
      pastMedicalHistory ||
      "No past medical history captured yet. Please complete.",
    assessmentDiagnosis: "Please add assessment / diagnosis.",
    planRecommendations: "Please add plan and follow-up recommendations.",
    source: "fallback" as const,
  };
}

export function clampSectionText(input: string) {
  return input.trim().slice(0, 4000);
}
