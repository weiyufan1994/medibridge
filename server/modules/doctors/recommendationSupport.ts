import { createEmbedding } from "../../_core/llm";
import { createLogger } from "../../_core/logger";
import {
  toLocalizedTextValue,
  toPublicLocalizedDoctorSearchResult,
  type PublicLocalizedDoctorRecommendation,
} from "./presentation";
import * as doctorsRepo from "./repo";
import {
  GENERAL_DEPARTMENT_TERMS,
  SPECIALTY_INTENTS,
  type SpecialtyIntent,
} from "./recommendationIntents";
import { deriveDoctorSpecialtyTags } from "./taxonomy";

const logger = createLogger("doctor-recommendation-retrieval");

export type DoctorResult = Awaited<
  ReturnType<typeof doctorsRepo.searchDoctors>
>[number];

export type RecommendationBuckets = {
  zhResults: DoctorResult[];
  enResults: DoctorResult[];
  vectorResults: DoctorResult[];
};

export const buildDoctorSearchableText = (result: DoctorResult) =>
  [
    result.doctor.name,
    result.doctor.nameEn,
    result.doctor.specialty,
    result.doctor.specialtyEn,
    result.doctor.expertise,
    result.doctor.expertiseEn,
    result.department.name,
    result.department.nameEn,
    result.hospital.name,
    result.hospital.nameEn,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(" ")
    .toLowerCase();

export function getNormalizedDoctorTags(
  result: DoctorResult,
  storedTagsByDoctorId: Map<number, string[]>
) {
  return new Set([
    ...(storedTagsByDoctorId.get(result.doctor.id) ?? []),
    ...deriveDoctorSpecialtyTags({
      departmentName: result.department.name,
      departmentNameEn: result.department.nameEn,
      specialty: result.doctor.specialty,
      specialtyEn: result.doctor.specialtyEn,
      expertise: result.doctor.expertise,
      expertiseEn: result.doctor.expertiseEn,
    }),
  ]);
}

export function detectSpecialtyIntents(input: string[]) {
  const haystack = input
    .map(value => value.trim().toLowerCase())
    .filter(value => value.length > 0)
    .join(" ");

  return SPECIALTY_INTENTS.filter(intent =>
    intent.triggerKeywords.some(keyword =>
      haystack.includes(keyword.toLowerCase())
    )
  );
}

export function isGeneralDepartment(result: DoctorResult) {
  const searchableText = buildDoctorSearchableText(result);
  return GENERAL_DEPARTMENT_TERMS.some(term =>
    searchableText.includes(term.toLowerCase())
  );
}

export function countIntentDepartmentMatches(
  result: DoctorResult,
  intents: SpecialtyIntent[]
) {
  if (intents.length === 0) {
    return 0;
  }

  const searchableText = buildDoctorSearchableText(result);
  let matches = 0;
  for (const intent of intents) {
    if (
      intent.departmentTerms.some(term =>
        searchableText.includes(term.toLowerCase())
      )
    ) {
      matches += 1;
    }
  }

  return matches;
}

export function getIntentNormalizedTags(intents: SpecialtyIntent[]) {
  return Array.from(new Set(intents.flatMap(intent => intent.normalizedTags)));
}

export function getUniqueDoctorIdsFromBuckets(buckets: RecommendationBuckets) {
  return Array.from(
    new Set(
      [
        ...buckets.zhResults,
        ...buckets.enResults,
        ...buckets.vectorResults,
      ].map(item => item.doctor.id)
    )
  );
}

export function getBucketCounts(buckets: RecommendationBuckets) {
  return {
    zh: buckets.zhResults.length,
    en: buckets.enResults.length,
    vector: buckets.vectorResults.length,
    unique: getUniqueDoctorIdsFromBuckets(buckets).length,
  };
}

export async function retrieveRecommendationBuckets(input: {
  zhQueryKeywords: string[];
  enQueryKeywords: string[];
  translatedZhKeywords: string[];
  semanticQuery: string;
  candidateDoctorIds?: number[];
}): Promise<RecommendationBuckets> {
  const [zhResults, enResults] = await Promise.all([
    doctorsRepo.searchDoctors(input.zhQueryKeywords, 20, {
      lang: "zh",
      candidateDoctorIds: input.candidateDoctorIds,
    }),
    doctorsRepo.searchDoctors(input.enQueryKeywords, 20, {
      lang: "en",
      fallbackKeywords: input.translatedZhKeywords,
      candidateDoctorIds: input.candidateDoctorIds,
    }),
  ]);

  let vectorResults: DoctorResult[] = [];
  if (input.semanticQuery.length > 0) {
    try {
      const queryEmbedding = await createEmbedding(input.semanticQuery);
      vectorResults = await doctorsRepo.searchDoctorsByEmbedding(
        queryEmbedding,
        20,
        {
          candidateDoctorIds: input.candidateDoctorIds,
        }
      );
    } catch (error) {
      logger.warn("vector_retrieval_failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  return {
    zhResults,
    enResults,
    vectorResults,
  };
}

function parseYearsOfExperience(value: string | null | undefined) {
  if (!value || value.trim().length === 0) return null;
  const yearsMatch = value.match(/(\d{1,2})\s*\+?\s*(years?|yrs?)/i);
  if (yearsMatch) return Number(yearsMatch[1]);
  const chineseMatch = value.match(/(\d{1,2})\s*年/);
  if (chineseMatch) return Number(chineseMatch[1]);
  const numericMatch = value.match(/\d{1,2}/);
  return numericMatch ? Number(numericMatch[0]) : null;
}

function buildRecommendationReason(
  result: DoctorResult,
  keywordPool: string[]
) {
  const searchableText = [
    result.doctor.specialty,
    result.doctor.specialtyEn,
    result.doctor.expertise,
    result.doctor.expertiseEn,
    result.department.name,
    result.department.nameEn,
    result.hospital.name,
    result.hospital.nameEn,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
    .join(" ")
    .toLowerCase();

  const matchedKeywords = keywordPool
    .filter(keyword => searchableText.includes(keyword))
    .slice(0, 3);

  const departmentName =
    result.department.nameEn?.trim() || result.department.name.trim();

  const zh =
    matchedKeywords.length > 0
      ? `与关键词 ${matchedKeywords.join("、")} 匹配，建议就诊 ${result.department.name}。`
      : `该医生所在科室（${result.department.name}）与分诊信息相关。`;
  const en =
    matchedKeywords.length > 0
      ? `Matched ${matchedKeywords.join(", ")} with ${departmentName}.`
      : `Relevant specialist in ${departmentName} for your triage profile.`;

  return toLocalizedTextValue(zh, en);
}

export function toPublicRecommendation(
  result: DoctorResult,
  keywordPool: string[]
): PublicLocalizedDoctorRecommendation {
  return {
    reason: buildRecommendationReason(result, keywordPool),
    title: toLocalizedTextValue(result.doctor.title, result.doctor.titleEn),
    specialty: toLocalizedTextValue(
      result.doctor.specialty ?? result.doctor.expertise,
      result.doctor.specialtyEn ?? result.doctor.expertiseEn
    ),
    biography: toLocalizedTextValue(
      result.doctor.description ??
        result.doctor.expertise ??
        result.doctor.experience,
      result.doctor.expertiseEn ??
        result.doctor.description ??
        result.doctor.expertise ??
        result.doctor.experience
    ),
    yearsOfExperience: parseYearsOfExperience(result.doctor.experience),
    ...toPublicLocalizedDoctorSearchResult(result),
  };
}
