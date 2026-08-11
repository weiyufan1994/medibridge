import type {
  TriageRouting,
  TriageRoutingHospital,
} from "../../../shared/triageRouting";
import type { TriageCollectedData, TriageDepartmentHint } from "./triageLogic";
import type { TriageLang } from "./service";

const GENERAL_GRADE_WEIGHTS: Record<string, number> = {
  "A++++": 5,
  "A+++": 4,
  "A++": 3,
  "A+": 2,
  A: 1,
};

export function buildPossibilitySummary(input: {
  data: TriageCollectedData;
  department: TriageDepartmentHint;
  confidence: TriageRouting["confidence"];
  missingCriticalFields: TriageRouting["missingCriticalFields"];
  lang: TriageLang;
}) {
  const symptom = input.data.mainSymptomAndLocation.trim();
  const duration = input.data.durationAndOnset.trim();
  const missingFieldLabels = input.missingCriticalFields.map(field =>
    input.lang === "zh"
      ? field === "gender"
        ? "性别"
        : "年龄"
      : field === "gender"
        ? "gender"
        : "age"
  );

  if (input.confidence === "reduced" && missingFieldLabels.length > 0) {
    if (input.lang === "zh") {
      return `当前关键信息不足（${missingFieldLabels.join("、")}未提供），以下为更保守的初步分诊建议。目前先按 ${input.department.zh} 方向进一步评估，建议补充相关信息以提高准确性。这是分诊建议，不是明确诊断。`;
    }

    return `Critical information is still missing (${missingFieldLabels.join(", ")} not provided), so the following is a safer preliminary routing suggestion. For now, please start with ${input.department.en} and add those details to improve accuracy. This is routing guidance, not a confirmed diagnosis.`;
  }

  if (input.lang === "zh") {
    const details = [symptom, duration].filter(Boolean).join("，");
    return details
      ? `结合您描述的“${details}”，目前更偏向 ${input.department.zh} 方向，建议先到该专科进一步评估。这是分诊建议，不是明确诊断。`
      : `目前更偏向 ${input.department.zh} 方向，建议先到该专科进一步评估。这是分诊建议，不是明确诊断。`;
  }

  const details = [symptom, duration].filter(Boolean).join(", ");
  return details
    ? `Based on "${details}", this looks more aligned with ${input.department.en}. Please start with that department for in-person evaluation. This is routing guidance, not a confirmed diagnosis.`
    : `This looks more aligned with ${input.department.en}. Please start with that department for in-person evaluation. This is routing guidance, not a confirmed diagnosis.`;
}

export function compareHospitals(
  a: TriageRoutingHospital,
  b: TriageRoutingHospital
) {
  const specialtyRankA = a.specialtyRank ?? Number.POSITIVE_INFINITY;
  const specialtyRankB = b.specialtyRank ?? Number.POSITIVE_INFINITY;
  if (specialtyRankA !== specialtyRankB) {
    return specialtyRankA - specialtyRankB;
  }

  const gradeWeightA = GENERAL_GRADE_WEIGHTS[a.generalGrade ?? ""] ?? 0;
  const gradeWeightB = GENERAL_GRADE_WEIGHTS[b.generalGrade ?? ""] ?? 0;
  if (gradeWeightA !== gradeWeightB) {
    return gradeWeightB - gradeWeightA;
  }

  const stemRankA = a.stemRank ?? Number.POSITIVE_INFINITY;
  const stemRankB = b.stemRank ?? Number.POSITIVE_INFINITY;
  if (stemRankA !== stemRankB) {
    return stemRankA - stemRankB;
  }

  return a.hospitalName.localeCompare(b.hospitalName, "zh-Hans-CN");
}

export function buildHospitalReason(input: {
  lang: TriageLang;
  specialtyName: string | null;
  hospital: TriageRoutingHospital;
}) {
  const reasons: string[] = [];

  if (input.lang === "zh") {
    if (input.specialtyName && input.hospital.specialtyRank !== null) {
      reasons.push(
        `2022 复旦 ${input.specialtyName} 声誉榜第 ${input.hospital.specialtyRank} 名`
      );
    }
    if (input.hospital.generalGrade) {
      reasons.push(`全国综合等级 ${input.hospital.generalGrade}`);
    }
    if (input.hospital.stemRank !== null) {
      reasons.push(`医院科技量值第 ${input.hospital.stemRank} 名`);
    }
    return reasons.join("；") || "作为全国参考医院供分诊转诊使用";
  }

  if (input.specialtyName && input.hospital.specialtyRank !== null) {
    reasons.push(
      `Ranked #${input.hospital.specialtyRank} in the 2022 Fudan specialty reputation list`
    );
  }
  if (input.hospital.generalGrade) {
    reasons.push(`General hospital grade ${input.hospital.generalGrade}`);
  }
  if (input.hospital.stemRank !== null) {
    reasons.push(`STEM rank #${input.hospital.stemRank}`);
  }
  return (
    reasons.join("; ") ||
    "Shown as a national reference option for triage routing"
  );
}
