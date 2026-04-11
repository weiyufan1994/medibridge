import type {
  TriageIntake,
  TriageIntakeGender,
} from "../../../shared/triageIntake";
import {
  getLocalizedTriageGenderLabel,
  normalizeTriageIntake,
} from "../../../shared/triageIntake";
import type {
  TriageRoutingConfidence,
  TriageRoutingCriticalField,
} from "../../../shared/triageRouting";
import type { TriageKnowledgeContext, TriageLang } from "./service";

export type TriageExtractionDraft = {
  mainSymptomAndLocation: string;
  durationAndOnset: string;
  traumaOrSurgery: string;
  chronicConditions: string;
  otherSymptoms: string;
  age: number | null;
  gender: TriageIntakeGender | null;
  urgency: "low" | "medium" | "high";
};

export type TriageCollectedData = {
  mainSymptomAndLocation: string;
  durationAndOnset: string;
  traumaOrSurgery: string;
  chronicConditions: string;
  otherSymptoms: string;
  age: number | null;
  gender: TriageIntakeGender;
  urgency: "low" | "medium" | "high";
};

export type TriageDepartmentHint = {
  key: string;
  zh: string;
  en: string;
};

export type TriageDepartmentRecommendation = {
  department: TriageDepartmentHint;
  confidence: TriageRoutingConfidence;
  missingCriticalFields: TriageRoutingCriticalField[];
};

export type MissingTriageField =
  | "mainSymptomAndLocation"
  | "durationAndOnset"
  | "traumaOrSurgery"
  | "chronicConditions"
  | "age"
  | "gender";

const POSITIVE_TRAUMA_PATTERNS = [
  /外伤/,
  /摔伤/,
  /扭伤/,
  /撞伤/,
  /切割伤/,
  /手术/,
  /术后/,
  /\binjury\b/i,
  /\btrauma\b/i,
  /\bfall\b/i,
  /\bcut\b/i,
  /\bsurgery\b/i,
  /\bpost-?op\b/i,
];

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

const PEDIATRIC_PATTERNS = [
  /儿科/,
  /儿童/,
  /小孩/,
  /宝宝/,
  /婴儿/,
  /\bpediatric\b/i,
  /\bchild\b/i,
  /\bchildren\b/i,
  /\binfant\b/i,
];

const GYNECOLOGY_PATTERNS = [
  /月经/,
  /经期/,
  /痛经/,
  /阴道/,
  /妇科/,
  /产科/,
  /怀孕/,
  /妊娠/,
  /\bmenstrual\b/i,
  /\bperiod\b/i,
  /\bvaginal\b/i,
  /\bpregnan/i,
  /\bgyne/i,
  /\bobstet/i,
];

const SPECIALTY_HINTS = [
  {
    key: "cardiology",
    patterns: [
      /胸痛/,
      /心悸/,
      /胸闷/,
      /高血压/,
      /\bheart\b/i,
      /\bcardio/i,
      /\bpalpitation/i,
      /\bchest pain\b/i,
    ],
    zh: "心内科",
    en: "cardiology",
  },
  {
    key: "respiratory",
    patterns: [
      /咳嗽/,
      /咳痰/,
      /气短/,
      /呼吸困难/,
      /\bcough\b/i,
      /\bphlegm\b/i,
      /\basthma\b/i,
      /\brespirat/i,
      /\bpulmon/i,
    ],
    zh: "呼吸科",
    en: "respiratory medicine",
  },
  {
    key: "digestive",
    patterns: [
      /腹痛/,
      /胃/,
      /腹泻/,
      /呕吐/,
      /反酸/,
      /\babdominal\b/i,
      /\bstomach\b/i,
      /\bgastro/i,
      /\bvomi/i,
      /\bdiarr/i,
    ],
    zh: "消化内科",
    en: "gastroenterology",
  },
  {
    key: "dermatology",
    patterns: [
      /皮肤/,
      /皮疹/,
      /瘙痒/,
      /湿疹/,
      /\brash\b/i,
      /\bitch/i,
      /\beczema\b/i,
      /\bdermat/i,
    ],
    zh: "皮肤科",
    en: "dermatology",
  },
  {
    key: "neurology",
    patterns: [
      /头痛/,
      /头晕/,
      /麻木/,
      /偏头痛/,
      /\bheadache\b/i,
      /\bdizz/i,
      /\bnumb/i,
      /\bmigraine\b/i,
      /\bneurolog/i,
    ],
    zh: "神经内科",
    en: "neurology",
  },
  {
    key: "orthopedics",
    patterns: [
      /关节/,
      /膝/,
      /骨折/,
      /骨/,
      /扭伤/,
      /\bknee\b/i,
      /\bjoint\b/i,
      /\bfracture\b/i,
      /\borthop/i,
      /\btrauma\b/i,
    ],
    zh: "骨科",
    en: "orthopedics",
  },
  {
    key: "gynecology",
    patterns: GYNECOLOGY_PATTERNS,
    zh: "妇科",
    en: "gynecology",
  },
  {
    key: "pediatrics",
    patterns: PEDIATRIC_PATTERNS,
    zh: "儿科",
    en: "pediatrics",
  },
];

const KNOWLEDGE_TAG_LABELS: Record<string, TriageDepartmentHint> = {
  musculoskeletal: {
    key: "orthopedics",
    zh: "骨科",
    en: "orthopedics",
  },
  trauma_fracture: {
    key: "orthopedics",
    zh: "创伤骨科",
    en: "orthopedic trauma",
  },
  oral_maxillofacial: {
    key: "oral",
    zh: "口腔颌面外科",
    en: "oral and maxillofacial surgery",
  },
  rheumatology: {
    key: "rheumatology",
    zh: "风湿免疫科",
    en: "rheumatology",
  },
  sports_medicine: {
    key: "sports_medicine",
    zh: "运动医学",
    en: "sports medicine",
  },
  neurology: {
    key: "neurology",
    zh: "神经内科",
    en: "neurology",
  },
  digestive: {
    key: "digestive",
    zh: "消化内科",
    en: "gastroenterology",
  },
  respiratory: {
    key: "respiratory",
    zh: "呼吸科",
    en: "respiratory medicine",
  },
  cardiology: {
    key: "cardiology",
    zh: "心内科",
    en: "cardiology",
  },
  gynecology: {
    key: "gynecology",
    zh: "妇科",
    en: "gynecology",
  },
  pediatrics: {
    key: "pediatrics",
    zh: "儿科",
    en: "pediatrics",
  },
  dermatology: {
    key: "dermatology",
    zh: "皮肤科",
    en: "dermatology",
  },
  general_medicine: {
    key: "general_medicine",
    zh: "全科",
    en: "general medicine",
  },
} as const;

const GENERAL_MEDICINE_HINT: TriageDepartmentHint = {
  key: "general_medicine",
  zh: "全科",
  en: "general medicine",
};

const PEDIATRICS_HINT: TriageDepartmentHint = {
  key: "pediatrics",
  zh: "儿科",
  en: "pediatrics",
};

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
      traumaOrSurgery:
        "Is this issue related to any recent injury or surgery?",
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
    .map(field =>
    getLocalizedFollowupQuestion(field, input.lang)
    );

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

const isNonInformativeKeyword = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return ["未提供", "not provided", "none", "no", "无", "unknown"].includes(
    normalized
  );
};

const createKeywordPool = (data: TriageCollectedData) => {
  const values = [
    data.mainSymptomAndLocation,
    data.otherSymptoms,
    data.traumaOrSurgery,
    data.chronicConditions,
  ]
    .map(value => value.trim())
    .filter(value => value.length > 0 && !isNonInformativeKeyword(value));

  return Array.from(new Set(values));
};

const uniqueDepartmentHints = (hints: TriageDepartmentHint[]) => {
  const seen = new Set<string>();
  const next: TriageDepartmentHint[] = [];

  for (const hint of hints) {
    if (seen.has(hint.key)) {
      continue;
    }

    seen.add(hint.key);
    next.push(hint);
  }

  return next;
};

function buildTriageHaystack(data: TriageCollectedData) {
  return [
    data.mainSymptomAndLocation,
    data.durationAndOnset,
    data.traumaOrSurgery,
    data.chronicConditions,
    data.otherSymptoms,
  ].join(" ");
}

function listKnowledgeDepartmentHints(
  knowledgeContext?: TriageKnowledgeContext
) {
  const tags = knowledgeContext?.snippets.flatMap(snippet => snippet.specialtyTags) ?? [];

  return uniqueDepartmentHints(
    tags
      .map(tag => KNOWLEDGE_TAG_LABELS[tag])
      .filter((hint): hint is TriageDepartmentHint => Boolean(hint))
  );
}

function listPatternDepartmentHints(data: TriageCollectedData) {
  const haystack = buildTriageHaystack(data);

  return SPECIALTY_HINTS.filter(item =>
    item.patterns.some(pattern => pattern.test(haystack))
  ).map(item => ({
    key: item.key,
    zh: item.zh,
    en: item.en,
  }));
}

function assessDepartmentEligibility(input: {
  department: TriageDepartmentHint;
  data: TriageCollectedData;
}) {
  if (input.department.key === "gynecology" || input.department.key === "obstetrics") {
    if (input.data.gender === "female") {
      return {
        isEligible: true,
        missingCriticalFields: [] as TriageRoutingCriticalField[],
      };
    }

    if (input.data.gender === "unknown") {
      return {
        isEligible: false,
        missingCriticalFields: ["gender"] as TriageRoutingCriticalField[],
      };
    }

    return {
      isEligible: false,
      missingCriticalFields: [] as TriageRoutingCriticalField[],
    };
  }

  if (input.department.key === "andrology") {
    if (input.data.gender === "male") {
      return {
        isEligible: true,
        missingCriticalFields: [] as TriageRoutingCriticalField[],
      };
    }

    if (input.data.gender === "unknown") {
      return {
        isEligible: false,
        missingCriticalFields: ["gender"] as TriageRoutingCriticalField[],
      };
    }

    return {
      isEligible: false,
      missingCriticalFields: [] as TriageRoutingCriticalField[],
    };
  }

  if (input.department.key === "pediatrics") {
    if (typeof input.data.age === "number" && input.data.age <= 14) {
      return {
        isEligible: true,
        missingCriticalFields: [] as TriageRoutingCriticalField[],
      };
    }

    if (input.data.age === null) {
      return {
        isEligible: false,
        missingCriticalFields: ["age"] as TriageRoutingCriticalField[],
      };
    }

    return {
      isEligible: false,
      missingCriticalFields: [] as TriageRoutingCriticalField[],
    };
  }

  return {
    isEligible: true,
    missingCriticalFields: [] as TriageRoutingCriticalField[],
  };
}

export function resolveRecommendedDepartment(input: {
  data: TriageCollectedData;
  knowledgeContext?: TriageKnowledgeContext;
}): TriageDepartmentRecommendation {
  const candidates = uniqueDepartmentHints([
    ...(input.data.age !== null && input.data.age <= 14 ? [PEDIATRICS_HINT] : []),
    ...listKnowledgeDepartmentHints(input.knowledgeContext),
    ...listPatternDepartmentHints(input.data),
    GENERAL_MEDICINE_HINT,
  ]);

  const missingCriticalFields = new Set<TriageRoutingCriticalField>();

  for (const department of candidates) {
    const eligibility = assessDepartmentEligibility({
      department,
      data: input.data,
    });

    if (eligibility.isEligible) {
      return {
        department,
        confidence:
          missingCriticalFields.size > 0 ? "reduced" : "standard",
        missingCriticalFields: Array.from(missingCriticalFields),
      };
    }

    for (const field of eligibility.missingCriticalFields) {
      missingCriticalFields.add(field);
    }
  }

  return {
    department: GENERAL_MEDICINE_HINT,
    confidence: missingCriticalFields.size > 0 ? "reduced" : "standard",
    missingCriticalFields: Array.from(missingCriticalFields),
  };
}

export function pickRecommendedDepartment(input: {
  data: TriageCollectedData;
  knowledgeContext?: TriageKnowledgeContext;
}): TriageDepartmentHint {
  return resolveRecommendedDepartment(input).department;
}

function pickSpecialtyHint(
  data: TriageCollectedData,
  lang: TriageLang,
  knowledgeContext?: TriageKnowledgeContext
) {
  const department = resolveRecommendedDepartment({
    data,
    knowledgeContext,
  }).department;
  return department[lang];
}

export function buildRecommendationKeywords(input: {
  data: TriageCollectedData;
  lang: TriageLang;
  knowledgeContext?: TriageKnowledgeContext;
}) {
  const pool = createKeywordPool(input.data);
  const specialtyHint = pickSpecialtyHint(
    input.data,
    input.lang,
    input.knowledgeContext
  );

  const keywords = Array.from(
    new Set([
      pool[0],
      pool[1],
      specialtyHint,
      POSITIVE_TRAUMA_PATTERNS.some(pattern =>
        pattern.test(input.data.traumaOrSurgery)
      )
        ? input.lang === "zh"
          ? "外伤"
          : "trauma"
        : "",
      pool[2],
    ])
  )
    .map(value => value?.trim() ?? "")
    .filter(value => value.length > 0 && !isNonInformativeKeyword(value))
    .slice(0, 5);

  if (keywords.length >= 3) {
    return keywords;
  }

  const fallbackKeywords = Array.from(
    new Set([
      ...keywords,
      input.data.mainSymptomAndLocation,
      input.lang === "zh" ? "门诊分诊" : "triage consult",
      specialtyHint,
    ])
  )
    .map(value => value.trim())
    .filter(value => value.length > 0 && !isNonInformativeKeyword(value))
    .slice(0, 5);

  return fallbackKeywords;
}

export function buildCompletionReply(
  lang: TriageLang,
  recommendation?: TriageDepartmentRecommendation
) {
  const departmentLabel = recommendation?.department
    ? lang === "zh"
      ? recommendation.department.zh
      : recommendation.department.en
    : lang === "zh"
      ? "相关专科"
      : "the relevant department";

  const missingFieldLabels =
    recommendation?.missingCriticalFields.map(field =>
      lang === "zh"
        ? field === "gender"
          ? "性别"
          : "年龄"
        : field === "gender"
          ? "gender"
          : "age"
    ) ?? [];

  if (
    recommendation?.confidence === "reduced" &&
    missingFieldLabels.length > 0
  ) {
    if (lang === "zh") {
      return `当前关键信息仍不足（${missingFieldLabels.join("、")}未提供），下面先展示偏保守的建议就诊方向（${departmentLabel}）和参考医院。建议补充相关信息以提高准确性。这是分诊建议，不是明确诊断。`;
    }

    return `Some critical information is still missing (${missingFieldLabels.join(", ")} not provided), so I will show a safer preliminary routing suggestion (${departmentLabel}) and reference hospitals for now. Please add those details to improve accuracy. This is routing guidance, not a confirmed diagnosis.`;
  }

  if (lang === "zh") {
    return `已根据您提供的关键信息完成极速分诊。下面将展示建议就诊专科（${departmentLabel}）和参考医院。这是分诊建议，不是明确诊断。`;
  }

  return `I have enough key details to complete this fast triage. I will now show the suggested department (${departmentLabel}) and reference hospitals. This is routing guidance, not a confirmed diagnosis.`;
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
