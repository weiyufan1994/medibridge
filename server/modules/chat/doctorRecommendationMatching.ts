import { doctorSearchApi as doctors } from "../doctors/publicApi";

export const tokenizeForMatching = (input: string): string[] =>
  input
    .toLowerCase()
    .split(/[\s,，。！？；;:：、\n\t()（）【】\[\]"'“”‘’]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2);

const STOP_TOKENS = new Set([
  "with",
  "without",
  "about",
  "around",
  "little",
  "mild",
  "bit",
  "days",
  "day",
  "degree",
  "degrees",
  "celsius",
  "symptom",
  "symptoms",
  "getting",
  "have",
  "has",
  "had",
  "and",
  "the",
  "for",
  "发热",
  "低烧",
  "症状",
  "感觉",
  "有点",
  "大概",
  "今天",
  "昨天",
]);

export const normalizeIntentTokens = (tokens: string[]) =>
  tokens.filter(token => !STOP_TOKENS.has(token));

export type DepartmentIntent = {
  id: string;
  symptomKeywords: string[];
  departmentKeywords: string[];
};

const DEPARTMENT_INTENTS: DepartmentIntent[] = [
  {
    id: "digestive",
    symptomKeywords: [
      "stomachache",
      "stomach",
      "gastric",
      "gastro",
      "abdomen",
      "abdominal",
      "belly",
      "digestive",
      "nausea",
      "vomit",
      "vomiting",
      "diarrhea",
      "diarrhoea",
      "constipation",
      "indigestion",
      "胃",
      "腹痛",
      "肚子",
      "消化",
      "恶心",
      "呕吐",
      "腹泻",
      "便秘",
      "反酸",
      "烧心",
    ],
    departmentKeywords: [
      "消化",
      "胃肠",
      "gastro",
      "digestive",
      "gastroenterology",
    ],
  },
  {
    id: "respiratory",
    symptomKeywords: [
      "cough",
      "phlegm",
      "sputum",
      "wheeze",
      "asthma",
      "shortness",
      "breath",
      "dyspnea",
      "咳嗽",
      "咳痰",
      "气短",
      "喘",
      "呼吸困难",
      "哮喘",
    ],
    departmentKeywords: ["呼吸", "肺", "respiratory", "pulmonary"],
  },
];

export const detectIntentDepartments = (text: string): DepartmentIntent[] => {
  const lowered = text.toLowerCase();
  return DEPARTMENT_INTENTS.filter(intent =>
    intent.symptomKeywords.some(keyword =>
      lowered.includes(keyword.toLowerCase())
    )
  );
};

const GENERAL_DEPARTMENT_KEYWORDS = [
  "全科",
  "综合",
  "内科",
  "general",
  "internal medicine",
  "family medicine",
];

export const isGeneralDepartment = (
  doctorResult: Awaited<ReturnType<typeof doctors.search>>[number]
) => {
  const departmentText = [
    doctorResult.department.name,
    doctorResult.department.nameEn,
    doctorResult.doctor.specialty,
    doctorResult.doctor.specialtyEn,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(" ")
    .toLowerCase();

  return GENERAL_DEPARTMENT_KEYWORDS.some(keyword =>
    departmentText.includes(keyword.toLowerCase())
  );
};

export const scoreDoctorRelevance = (
  doctorResult: Awaited<ReturnType<typeof doctors.search>>[number],
  tokens: string[],
  intents: DepartmentIntent[]
) => {
  const coreText = [
    doctorResult.department.name,
    doctorResult.department.nameEn,
    doctorResult.doctor.specialty,
    doctorResult.doctor.specialtyEn,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(" ")
    .toLowerCase();

  const fullText = [
    coreText,
    doctorResult.doctor.expertise,
    doctorResult.doctor.expertiseEn,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(" ")
    .toLowerCase();

  let score = 0;

  const tokenMatchesCore = tokens.filter(token =>
    coreText.includes(token)
  ).length;
  const tokenMatchesFull = tokens.filter(token =>
    fullText.includes(token)
  ).length;
  score += tokenMatchesCore * 2 + tokenMatchesFull;

  for (const intent of intents) {
    const matchesCore = intent.departmentKeywords.some(keyword =>
      coreText.includes(keyword.toLowerCase())
    );
    const matchesFull = intent.departmentKeywords.some(keyword =>
      fullText.includes(keyword.toLowerCase())
    );
    if (matchesCore) {
      score += 6;
    } else if (matchesFull) {
      score += 3;
    }
  }

  return score;
};

export const isDoctorRelevantToSymptoms = (
  doctorResult: Awaited<ReturnType<typeof doctors.search>>[number],
  tokens: string[]
) => {
  if (tokens.length === 0) {
    return true;
  }

  const haystack = [
    doctorResult.department.name,
    doctorResult.department.nameEn,
    doctorResult.doctor.specialty,
    doctorResult.doctor.specialtyEn,
    doctorResult.doctor.expertise,
    doctorResult.doctor.expertiseEn,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(" ")
    .toLowerCase();

  return tokens.some(token => haystack.includes(token));
};
