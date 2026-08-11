import type { TriageRoutingCriticalField } from "../../../shared/triageRouting";
import type { TriageKnowledgeContext, TriageLang } from "./service";
import {
  GENERAL_MEDICINE_HINT,
  KNOWLEDGE_TAG_LABELS,
  PEDIATRICS_HINT,
  POSITIVE_TRAUMA_PATTERNS,
  SPECIALTY_HINTS,
} from "./triageDepartmentRules";
import type {
  TriageCollectedData,
  TriageDepartmentHint,
  TriageDepartmentRecommendation,
} from "./triageTypes";

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
  const tags =
    knowledgeContext?.snippets.flatMap(snippet => snippet.specialtyTags) ?? [];

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
  if (
    input.department.key === "gynecology" ||
    input.department.key === "obstetrics"
  ) {
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
    ...(input.data.age !== null && input.data.age <= 14
      ? [PEDIATRICS_HINT]
      : []),
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
        confidence: missingCriticalFields.size > 0 ? "reduced" : "standard",
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
