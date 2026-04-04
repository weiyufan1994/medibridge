export const TRIAGE_INTAKE_GENDERS = [
  "male",
  "female",
  "other",
  "unknown",
] as const;

export type TriageIntakeGender = (typeof TRIAGE_INTAKE_GENDERS)[number];

export type TriageIntake = {
  age: number | null;
  gender: TriageIntakeGender;
  mainSymptomAndLocation: string;
  durationAndOnset: string;
  traumaOrSurgery: string;
  chronicConditions: string;
};

export const EMPTY_TRIAGE_INTAKE: TriageIntake = {
  age: null,
  gender: "unknown",
  mainSymptomAndLocation: "",
  durationAndOnset: "",
  traumaOrSurgery: "",
  chronicConditions: "",
};

const normalizeAge = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.trunc(value);
  return normalized > 0 && normalized <= 120 ? normalized : null;
};

const normalizeText = (value: string | null | undefined) => value?.trim() ?? "";

export function normalizeTriageIntake(
  input: Partial<TriageIntake> | null | undefined
): TriageIntake {
  const gender = input?.gender;

  return {
    age: normalizeAge(input?.age),
    gender: TRIAGE_INTAKE_GENDERS.includes(gender as TriageIntakeGender)
      ? (gender as TriageIntakeGender)
      : "unknown",
    mainSymptomAndLocation: normalizeText(input?.mainSymptomAndLocation),
    durationAndOnset: normalizeText(input?.durationAndOnset),
    traumaOrSurgery: normalizeText(input?.traumaOrSurgery),
    chronicConditions: normalizeText(input?.chronicConditions),
  };
}

export function hasStructuredTriageInput(
  input: Partial<TriageIntake> | null | undefined
) {
  const normalized = normalizeTriageIntake(input);
  return (
    normalized.age !== null ||
    normalized.gender !== "unknown" ||
    normalized.mainSymptomAndLocation.length > 0 ||
    normalized.durationAndOnset.length > 0 ||
    normalized.traumaOrSurgery.length > 0 ||
    normalized.chronicConditions.length > 0
  );
}

const GENDER_LABELS = {
  zh: {
    male: "男",
    female: "女",
    other: "其他",
    unknown: "未提供",
  },
  en: {
    male: "Male",
    female: "Female",
    other: "Other",
    unknown: "Not provided",
  },
} as const;

export function getLocalizedTriageGenderLabel(
  gender: TriageIntakeGender,
  lang: "zh" | "en"
) {
  return GENDER_LABELS[lang][gender];
}

export function buildTriageIntakeMessage(
  input: TriageIntake,
  lang: "zh" | "en"
) {
  const normalized = normalizeTriageIntake(input);
  const ageText = normalized.age === null ? "" : `${normalized.age}`;
  const genderText = getLocalizedTriageGenderLabel(normalized.gender, lang);

  if (lang === "zh") {
    return [
      "已提交极速分诊表：",
      `年龄/性别：${[ageText, genderText].filter(Boolean).join(" / ") || "未提供"}`,
      `核心症状与部位：${normalized.mainSymptomAndLocation || "未提供"}`,
      `发病时间与急缓：${normalized.durationAndOnset || "未提供"}`,
      `外伤与手术史：${normalized.traumaOrSurgery || "未提供"}`,
      `关键基础疾病：${normalized.chronicConditions || "未提供"}`,
    ].join("\n");
  }

  return [
    "Fast triage form submitted:",
    `Age / Gender: ${[ageText, genderText].filter(Boolean).join(" / ") || "Not provided"}`,
    `Main symptom & location: ${normalized.mainSymptomAndLocation || "Not provided"}`,
    `Duration & onset: ${normalized.durationAndOnset || "Not provided"}`,
    `Trauma & surgery history: ${normalized.traumaOrSurgery || "Not provided"}`,
    `Key underlying conditions: ${normalized.chronicConditions || "Not provided"}`,
  ].join("\n");
}
