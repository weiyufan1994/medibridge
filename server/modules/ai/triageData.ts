import type {
  TriageIntake,
  TriageIntakeGender,
} from "../../../shared/triageIntake";
import {
  getLocalizedTriageGenderLabel,
  normalizeTriageIntake,
} from "../../../shared/triageIntake";
import type { TriageLang } from "./service";
import {
  GYNECOLOGY_PATTERNS,
  PEDIATRIC_PATTERNS,
} from "./triageDepartmentRules";
import type {
  MissingTriageField,
  TriageCollectedData,
  TriageExtractionDraft,
} from "./triageTypes";

const NEGATIVE_PATTERNS = [
  /^无$/,
  /^没有$/,
  /^未见$/,
  /^否认$/,
  /^none$/i,
  /^no$/i,
  /^nothing$/i,
  /^n\/a$/i,
  /^not provided$/i,
];

const LOCALIZED_MISSING_VALUE = {
  zh: "未提供",
  en: "Not provided",
} as const;

const getMissingValueLabel = (lang: TriageLang) =>
  LOCALIZED_MISSING_VALUE[lang];

const normalizeText = (value: string | null | undefined) => value?.trim() ?? "";

const isNegativeValue = (value: string) => {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return NEGATIVE_PATTERNS.some(pattern => pattern.test(normalized));
};

const isKnownText = (value: string) => value.trim().length > 0;

const isKnownCoreField = (field: MissingTriageField, value: string) => {
  if (field === "traumaOrSurgery" || field === "chronicConditions") {
    return isKnownText(value);
  }

  return isKnownText(value) && !isNegativeValue(value);
};

const pickFirstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return "";
};

const normalizeGender = (
  value: TriageIntakeGender | null | undefined
): TriageIntakeGender => {
  if (value === "male" || value === "female" || value === "other") {
    return value;
  }
  return "unknown";
};

export function mergeTriageData(input: {
  intake?: Partial<TriageIntake> | null;
  extracted?: Partial<TriageExtractionDraft> | null;
}): TriageCollectedData {
  const normalizedIntake = normalizeTriageIntake(input.intake);
  const extracted = input.extracted ?? {};
  const intakeGender =
    normalizedIntake.gender !== "unknown" ? normalizedIntake.gender : null;

  return {
    mainSymptomAndLocation: pickFirstText(
      normalizedIntake.mainSymptomAndLocation,
      extracted.mainSymptomAndLocation
    ),
    durationAndOnset: pickFirstText(
      normalizedIntake.durationAndOnset,
      extracted.durationAndOnset
    ),
    traumaOrSurgery: pickFirstText(
      normalizedIntake.traumaOrSurgery,
      extracted.traumaOrSurgery
    ),
    chronicConditions: pickFirstText(
      normalizedIntake.chronicConditions,
      extracted.chronicConditions
    ),
    otherSymptoms: normalizeText(extracted.otherSymptoms),
    age:
      normalizedIntake.age ??
      (typeof extracted.age === "number" && Number.isFinite(extracted.age)
        ? Math.trunc(extracted.age)
        : null),
    gender: normalizeGender(intakeGender ?? extracted.gender ?? "unknown"),
    urgency:
      extracted.urgency === "low" ||
      extracted.urgency === "medium" ||
      extracted.urgency === "high"
        ? extracted.urgency
        : "medium",
  };
}

function requiresDemographics(data: TriageCollectedData) {
  const haystack = [
    data.mainSymptomAndLocation,
    data.durationAndOnset,
    data.traumaOrSurgery,
    data.chronicConditions,
    data.otherSymptoms,
  ]
    .join(" ")
    .trim();

  const needsPediatrics = PEDIATRIC_PATTERNS.some(pattern =>
    pattern.test(haystack)
  );
  const needsGynecology = GYNECOLOGY_PATTERNS.some(pattern =>
    pattern.test(haystack)
  );

  return {
    age: needsPediatrics || needsGynecology,
    gender: needsGynecology,
  };
}

export function listMissingTriageFields(data: TriageCollectedData) {
  const missing: MissingTriageField[] = [];

  if (
    !isKnownCoreField("mainSymptomAndLocation", data.mainSymptomAndLocation)
  ) {
    missing.push("mainSymptomAndLocation");
  }
  if (!isKnownCoreField("durationAndOnset", data.durationAndOnset)) {
    missing.push("durationAndOnset");
  }
  if (!isKnownCoreField("traumaOrSurgery", data.traumaOrSurgery)) {
    missing.push("traumaOrSurgery");
  }
  if (!isKnownCoreField("chronicConditions", data.chronicConditions)) {
    missing.push("chronicConditions");
  }

  const demographicRequirements = requiresDemographics(data);
  if (demographicRequirements.age && data.age === null) {
    missing.push("age");
  }
  if (
    demographicRequirements.gender &&
    (data.gender === "unknown" || data.gender.length === 0)
  ) {
    missing.push("gender");
  }

  return missing;
}

function getLocalizedFollowupQuestion(
  field: MissingTriageField,
  lang: TriageLang
) {
  const labels = {
    zh: {
      mainSymptomAndLocation: "现在最主要的不适是什么，具体在哪个部位？",
      durationAndOnset: "这个症状出现多久了，是突然发生还是逐渐加重/反复发作？",
      traumaOrSurgery: "这次不适和外伤或近期手术有没有关系？",
      chronicConditions:
        "有没有需要特别注意的基础疾病，比如糖尿病、高血压或心脏病、免疫系统疾病或肿瘤？",
      age: "请补充一下年龄。",
      gender: "请补充一下性别。",
    },
    en: {
      mainSymptomAndLocation:
        "What is the main symptom, and where is it located?",
      durationAndOnset:
        "How long have you had this symptom, and did it start suddenly or gradually?",
      traumaOrSurgery: "Is this issue related to any recent injury or surgery?",
      chronicConditions:
        "Do you have any important underlying conditions, such as diabetes, high blood pressure, heart disease, immune disorders, or cancer?",
      age: "Please share your age.",
      gender: "Please share your gender.",
    },
  } as const;

  return labels[lang][field];
}

const FOLLOWUP_FIELD_PRIORITY: MissingTriageField[] = [
  "age",
  "gender",
  "mainSymptomAndLocation",
  "durationAndOnset",
  "traumaOrSurgery",
  "chronicConditions",
];

export function buildFollowupReply(input: {
  lang: TriageLang;
  missingFields: MissingTriageField[];
}) {
  const questions = [...input.missingFields]
    .sort(
      (left, right) =>
        FOLLOWUP_FIELD_PRIORITY.indexOf(left) -
        FOLLOWUP_FIELD_PRIORITY.indexOf(right)
    )
    .map(field => getLocalizedFollowupQuestion(field, input.lang));

  if (input.lang === "zh") {
    return `我再确认 ${questions.length} 点：${questions.map((question, index) => `${index + 1}. ${question}`).join(" ")} 按顺序简单回复就可以；没有或不确定的，写“无”或“不清楚”即可。`;
  }

  return `I just need ${questions.length} more detail${questions.length > 1 ? "s" : ""}: ${questions.map((question, index) => `${index + 1}. ${question}`).join(" ")} A short reply is fine. If something does not apply, write "none"; if you are not sure, say "not sure".`;
}

export function coerceMissingFieldsForCompletion(
  data: TriageCollectedData,
  lang: TriageLang
) {
  const missingValue = getMissingValueLabel(lang);
  const next = { ...data };

  if (
    !isKnownCoreField("mainSymptomAndLocation", next.mainSymptomAndLocation)
  ) {
    next.mainSymptomAndLocation = missingValue;
  }
  if (!isKnownCoreField("durationAndOnset", next.durationAndOnset)) {
    next.durationAndOnset = missingValue;
  }
  if (!isKnownCoreField("traumaOrSurgery", next.traumaOrSurgery)) {
    next.traumaOrSurgery = missingValue;
  }
  if (!isKnownCoreField("chronicConditions", next.chronicConditions)) {
    next.chronicConditions = missingValue;
  }
  if (next.gender === "unknown") {
    next.gender = "unknown";
  }

  return next;
}

export function buildTriageSummary(
  data: TriageCollectedData,
  lang: TriageLang
) {
  const ageText =
    data.age === null ? getMissingValueLabel(lang) : `${data.age}`;
  const genderText = getLocalizedTriageGenderLabel(data.gender, lang);

  if (lang === "zh") {
    return [
      `年龄/性别：${ageText} / ${genderText}`,
      `核心症状与部位：${data.mainSymptomAndLocation}`,
      `发病时间与急缓：${data.durationAndOnset}`,
      `外伤与手术史：${data.traumaOrSurgery}`,
      `关键基础疾病：${data.chronicConditions}`,
      data.otherSymptoms ? `其他症状：${data.otherSymptoms}` : "",
    ]
      .filter(Boolean)
      .join("；");
  }

  return [
    `Age/Gender: ${ageText} / ${genderText}`,
    `Main Symptom & Location: ${data.mainSymptomAndLocation}`,
    `Duration & Onset: ${data.durationAndOnset}`,
    `Trauma & Surgery History: ${data.traumaOrSurgery}`,
    `Key Underlying Conditions: ${data.chronicConditions}`,
    data.otherSymptoms ? `Other Symptoms: ${data.otherSymptoms}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildTriageExtractionOutput(
  data: TriageCollectedData,
  lang: TriageLang
) {
  return {
    symptoms: data.mainSymptomAndLocation,
    duration: data.durationAndOnset,
    age: data.age,
    gender: getLocalizedTriageGenderLabel(data.gender, lang),
    medicalHistory: data.chronicConditions,
    traumaOrSurgery: data.traumaOrSurgery,
    otherSymptoms: data.otherSymptoms,
    urgency: data.urgency,
  };
}
