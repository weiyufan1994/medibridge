export type TriageRoutingDepartment = {
  zh: string;
  en: string;
  matchedSpecialtyKey: string | null;
};

export type TriageRoutingHospital = {
  hospitalName: string;
  city: string | null;
  specialtyRank: number | null;
  specialtyScore: number | null;
  generalGrade: string | null;
  stemRank: number | null;
  matchedHospitalId: number | null;
  matchedDepartmentId: number | null;
  reason: string;
};

export type TriageRouting = {
  possibilitySummary: string;
  recommendedDepartment: TriageRoutingDepartment;
  hospitals: TriageRoutingHospital[];
};

export type LightTriageResultForm = {
  ageGender: string;
  mainSymptomAndLocation: string;
  durationAndOnset: string;
  traumaOrSurgery: string;
  medicalHistory: string;
  otherSymptoms: string;
};

export type TriageRoutingPrefillInput = {
  summary?: string | null;
  extraction?: {
    symptoms?: string | null;
    duration?: string | null;
    age?: number | null;
    gender?: string | null;
    medicalHistory?: string | null;
    traumaOrSurgery?: string | null;
    otherSymptoms?: string | null;
  } | null;
};

export const EMPTY_LIGHT_TRIAGE_RESULT_FORM: LightTriageResultForm = {
  ageGender: "",
  mainSymptomAndLocation: "",
  durationAndOnset: "",
  traumaOrSurgery: "",
  medicalHistory: "",
  otherSymptoms: "",
};

const SUMMARY_ALIAS_MAP: Record<string, keyof LightTriageResultForm> = {
  "age/gender": "ageGender",
  "age / gender": "ageGender",
  "年龄/性别": "ageGender",
  "main symptom & location": "mainSymptomAndLocation",
  "main symptom and location": "mainSymptomAndLocation",
  "core symptom and location": "mainSymptomAndLocation",
  核心症状与部位: "mainSymptomAndLocation",
  "duration & onset": "durationAndOnset",
  "duration and onset": "durationAndOnset",
  发病时间与急缓: "durationAndOnset",
  "trauma & surgery history": "traumaOrSurgery",
  "trauma and surgery history": "traumaOrSurgery",
  外伤与手术史: "traumaOrSurgery",
  "key underlying conditions": "medicalHistory",
  "medical history": "medicalHistory",
  关键基础疾病: "medicalHistory",
  "other symptoms": "otherSymptoms",
  其他症状: "otherSymptoms",
};

const MISSING_LABELS = {
  zh: "未提供",
  en: "Not provided",
} as const;

const normalizeText = (value: string | null | undefined) => value?.trim() ?? "";

function parseSummary(summary: string): Partial<LightTriageResultForm> {
  const result: Partial<LightTriageResultForm> = {};
  const chunks = summary
    .split(/[;；]/)
    .map(chunk => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const match = chunk.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
    if (!match) {
      continue;
    }

    const label = match[1].trim();
    const value = match[2].trim();
    if (!value) {
      continue;
    }

    const key =
      SUMMARY_ALIAS_MAP[label.toLowerCase()] ?? SUMMARY_ALIAS_MAP[label];
    if (!key || result[key]) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

export function buildLightTriageResultFormDefaults(
  input: TriageRoutingPrefillInput | undefined
): LightTriageResultForm {
  if (!input) {
    return { ...EMPTY_LIGHT_TRIAGE_RESULT_FORM };
  }

  const parsed = input.summary?.trim()
    ? parseSummary(input.summary.trim())
    : {};
  const age =
    typeof input.extraction?.age === "number" &&
    Number.isFinite(input.extraction.age)
      ? String(input.extraction.age)
      : "";
  const gender = normalizeText(input.extraction?.gender);
  const ageGender = [age, gender].filter(Boolean).join(" / ");

  return {
    ...EMPTY_LIGHT_TRIAGE_RESULT_FORM,
    ...parsed,
    ageGender: parsed.ageGender || ageGender,
    mainSymptomAndLocation:
      normalizeText(input.extraction?.symptoms) ||
      parsed.mainSymptomAndLocation ||
      "",
    durationAndOnset:
      normalizeText(input.extraction?.duration) ||
      parsed.durationAndOnset ||
      "",
    traumaOrSurgery:
      normalizeText(input.extraction?.traumaOrSurgery) ||
      parsed.traumaOrSurgery ||
      "",
    medicalHistory:
      normalizeText(input.extraction?.medicalHistory) ||
      parsed.medicalHistory ||
      "",
    otherSymptoms:
      normalizeText(input.extraction?.otherSymptoms) ||
      parsed.otherSymptoms ||
      "",
  };
}

export function buildLightTriageResultSummary(
  form: LightTriageResultForm,
  lang: "en" | "zh"
) {
  const missingLabel = MISSING_LABELS[lang];

  if (lang === "zh") {
    return [
      `年龄/性别：${normalizeText(form.ageGender) || missingLabel}`,
      `核心症状与部位：${normalizeText(form.mainSymptomAndLocation) || missingLabel}`,
      `发病时间与急缓：${normalizeText(form.durationAndOnset) || missingLabel}`,
      `外伤与手术史：${normalizeText(form.traumaOrSurgery) || missingLabel}`,
      `关键基础疾病：${normalizeText(form.medicalHistory) || missingLabel}`,
      normalizeText(form.otherSymptoms)
        ? `其他症状：${normalizeText(form.otherSymptoms)}`
        : "",
    ]
      .filter(Boolean)
      .join("；");
  }

  return [
    `Age/Gender: ${normalizeText(form.ageGender) || missingLabel}`,
    `Main Symptom & Location: ${normalizeText(form.mainSymptomAndLocation) || missingLabel}`,
    `Duration & Onset: ${normalizeText(form.durationAndOnset) || missingLabel}`,
    `Trauma & Surgery History: ${normalizeText(form.traumaOrSurgery) || missingLabel}`,
    `Key Underlying Conditions: ${normalizeText(form.medicalHistory) || missingLabel}`,
    normalizeText(form.otherSymptoms)
      ? `Other Symptoms: ${normalizeText(form.otherSymptoms)}`
      : "",
  ]
    .filter(Boolean)
    .join("; ");
}
