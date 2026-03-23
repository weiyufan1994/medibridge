import { createEmbedding, invokeLLM } from "../_core/llm";
import * as doctorsRepo from "../modules/doctors/repo";
import {
  toPublicLocalizedDoctorSearchResult,
  toLocalizedTextValue,
} from "../modules/doctors/presentation";
import {
  deriveDoctorSpecialtyTags,
  type DoctorSpecialtyTag,
} from "../modules/doctors/taxonomy";
import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

type SpecialtyIntent = {
  id: string;
  triggerKeywords: string[];
  departmentTerms: string[];
  normalizedTags: DoctorSpecialtyTag[];
};

type DoctorResult = Awaited<ReturnType<typeof doctorsRepo.searchDoctors>>[number];

type RecommendationBuckets = {
  zhResults: DoctorResult[];
  enResults: DoctorResult[];
  vectorResults: DoctorResult[];
};

const SPECIALTY_INTENTS: SpecialtyIntent[] = [
  {
    id: "musculoskeletal",
    triggerKeywords: [
      "膝",
      "膝盖",
      "膝关节",
      "关节",
      "积液",
      "积水",
      "骨",
      "骨头",
      "肌肉",
      "韧带",
      "半月板",
      "运动损伤",
      "arthritis",
      "joint",
      "knee",
      "orthopedic",
      "orthopaedic",
      "ligament",
      "meniscus",
      "rheumat",
      "swelling",
    ],
    departmentTerms: [
      "骨科",
      "关节",
      "运动医学",
      "创伤",
      "风湿",
      "骨外",
      "orthop",
      "sports medicine",
      "rheumat",
      "joint",
    ],
    normalizedTags: [
      "musculoskeletal",
      "trauma_fracture",
      "rheumatology",
      "sports_medicine",
    ],
  },
  {
    id: "trauma_fracture",
    triggerKeywords: [
      "骨折",
      "创伤",
      "外伤",
      "摔伤",
      "跌倒",
      "面部骨折",
      "胫骨",
      "腓骨",
      "fracture",
      "trauma",
      "injury",
      "fall",
      "fell",
      "tibia",
      "fibula",
    ],
    departmentTerms: [
      "骨科",
      "创伤",
      "急诊",
      "orthop",
      "fracture",
      "trauma",
      "emergency",
    ],
    normalizedTags: ["trauma_fracture", "musculoskeletal"],
  },
  {
    id: "oral_maxillofacial",
    triggerKeywords: [
      "颌面",
      "口腔颌面",
      "上颌",
      "下颌",
      "面部骨折",
      "面骨",
      "jaw",
      "maxillofacial",
      "oral surgery",
      "facial fracture",
      "mandible",
      "maxilla",
    ],
    departmentTerms: [
      "口腔",
      "颌面",
      "口腔外科",
      "oral",
      "maxillofacial",
      "dental",
      "oral surgery",
    ],
    normalizedTags: ["oral_maxillofacial"],
  },
  {
    id: "neurology",
    triggerKeywords: [
      "头痛",
      "偏头痛",
      "头晕",
      "麻木",
      "抽搐",
      "癫痫",
      "中风",
      "神经",
      "migraine",
      "headache",
      "dizziness",
      "numbness",
      "seizure",
      "stroke",
      "neurolog",
    ],
    departmentTerms: ["神经内科", "神经科", "脑", "neurolog"],
    normalizedTags: ["neurology"],
  },
  {
    id: "digestive",
    triggerKeywords: [
      "胃",
      "腹痛",
      "肚子",
      "腹泻",
      "便秘",
      "恶心",
      "呕吐",
      "反酸",
      "烧心",
      "stomach",
      "abdomen",
      "abdominal",
      "diarrhea",
      "constipation",
      "vomit",
      "gastric",
      "gastro",
    ],
    departmentTerms: ["消化", "胃肠", "gastro", "digestive"],
    normalizedTags: ["digestive"],
  },
  {
    id: "respiratory",
    triggerKeywords: [
      "咳嗽",
      "咳痰",
      "气短",
      "呼吸困难",
      "肺",
      "哮喘",
      "cough",
      "phlegm",
      "wheeze",
      "asthma",
      "dyspnea",
      "shortness of breath",
      "respirat",
      "pulmon",
    ],
    departmentTerms: ["呼吸", "肺", "respirat", "pulmon"],
    normalizedTags: ["respiratory"],
  },
  {
    id: "cardiology",
    triggerKeywords: [
      "胸痛",
      "心悸",
      "胸闷",
      "高血压",
      "心脏",
      "heart",
      "cardio",
      "palpitation",
      "hypertension",
      "chest pain",
    ],
    departmentTerms: ["心内", "心血管", "cardio", "heart"],
    normalizedTags: ["cardiology"],
  },
  {
    id: "gynecology",
    triggerKeywords: [
      "月经",
      "痛经",
      "阴道",
      "妇科",
      "卵巢",
      "子宫",
      "pregnancy",
      "menstrual",
      "gyne",
      "uterus",
      "ovary",
    ],
    departmentTerms: ["妇科", "产科", "gyne", "obstet"],
    normalizedTags: ["gynecology"],
  },
  {
    id: "pediatrics",
    triggerKeywords: ["儿童", "小孩", "宝宝", "儿科", "婴儿", "child", "children", "infant", "pediatric"],
    departmentTerms: ["儿科", "儿童", "pediatric"],
    normalizedTags: ["pediatrics"],
  },
  {
    id: "dermatology",
    triggerKeywords: ["皮肤", "皮疹", "湿疹", "瘙痒", "痘", "rash", "itch", "eczema", "dermat"],
    departmentTerms: ["皮肤", "dermat"],
    normalizedTags: ["dermatology"],
  },
];

const GENERAL_DEPARTMENT_TERMS = [
  "全科",
  "综合",
  "内科",
  "急诊",
  "general",
  "family medicine",
  "internal medicine",
  "emergency",
];

const buildDoctorSearchableText = (result: DoctorResult) =>
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
      (value): value is string => typeof value === "string" && value.trim().length > 0
    )
    .join(" ")
    .toLowerCase();

function getNormalizedDoctorTags(
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

function detectSpecialtyIntents(input: string[]) {
  const haystack = input
    .map(value => value.trim().toLowerCase())
    .filter(value => value.length > 0)
    .join(" ");

  return SPECIALTY_INTENTS.filter(intent =>
    intent.triggerKeywords.some(keyword => haystack.includes(keyword.toLowerCase()))
  );
}

function isGeneralDepartment(result: DoctorResult) {
  const searchableText = buildDoctorSearchableText(result);
  return GENERAL_DEPARTMENT_TERMS.some(term =>
    searchableText.includes(term.toLowerCase())
  );
}

function countIntentDepartmentMatches(result: DoctorResult, intents: SpecialtyIntent[]) {
  if (intents.length === 0) {
    return 0;
  }

  const searchableText = buildDoctorSearchableText(result);
  let matches = 0;
  for (const intent of intents) {
    if (
      intent.departmentTerms.some(term => searchableText.includes(term.toLowerCase()))
    ) {
      matches += 1;
    }
  }

  return matches;
}

function getIntentNormalizedTags(intents: SpecialtyIntent[]) {
  return Array.from(
    new Set(intents.flatMap(intent => intent.normalizedTags))
  );
}

function getUniqueDoctorIdsFromBuckets(buckets: RecommendationBuckets) {
  return Array.from(
    new Set(
      [...buckets.zhResults, ...buckets.enResults, ...buckets.vectorResults].map(
        item => item.doctor.id
      )
    )
  );
}

function getBucketCounts(buckets: RecommendationBuckets) {
  return {
    zh: buckets.zhResults.length,
    en: buckets.enResults.length,
    vector: buckets.vectorResults.length,
    unique: getUniqueDoctorIdsFromBuckets(buckets).length,
  };
}

function logRecommendationTelemetry(payload: Record<string, unknown>) {
  console.info("[Doctors] recommend telemetry", JSON.stringify(payload));
}

async function retrieveRecommendationBuckets(input: {
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
        { candidateDoctorIds: input.candidateDoctorIds }
      );
    } catch (error) {
      console.warn("[Doctors] vector retrieval failed:", error);
    }
  }

  return {
    zhResults,
    enResults,
    vectorResults,
  };
}

export const doctorsRouter = router({
  /**
   * Get doctor details by ID
   */
  getById: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input }) => {
      const result = await doctorsRepo.getDoctorById(input.id);
      if (!result) {
        return null;
      }

      return toPublicLocalizedDoctorSearchResult(result);
    }),

  /**
   * Search doctors by keywords
   */
  search: publicProcedure
    .input(
      z.object({
        keywords: z.array(z.string()),
        limit: z.number().optional(),
        lang: z.enum(["en", "zh"]).optional(),
        fallbackKeywords: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const results = await doctorsRepo.searchDoctors(input.keywords, input.limit, {
        lang: input.lang ?? "zh",
        fallbackKeywords: input.fallbackKeywords,
      });
      return results.map(toPublicLocalizedDoctorSearchResult);
    }),

  /**
   * Recommend top matched doctors by triage keywords.
   * Uses fuzzy keyword search across doctor/department/hospital fields.
   */
  recommend: publicProcedure
    .input(
      z.object({
        keywords: z.array(z.string()).min(1),
        summary: z.string().optional(),
        triageSessionId: z.string().optional(),
        limit: z.number().min(1).max(5).optional(),
      })
    )
    .query(async ({ input }) => {
      const parseYearsOfExperience = (value: string | null | undefined) => {
        if (!value || value.trim().length === 0) return null;
        const yearsMatch = value.match(/(\d{1,2})\s*\+?\s*(years?|yrs?)/i);
        if (yearsMatch) return Number(yearsMatch[1]);
        const chineseMatch = value.match(/(\d{1,2})\s*年/);
        if (chineseMatch) return Number(chineseMatch[1]);
        const numericMatch = value.match(/\d{1,2}/);
        return numericMatch ? Number(numericMatch[0]) : null;
      };

      const limit = input.limit ?? 5;
      const normalizedKeywords = Array.from(
        new Set(
          input.keywords
            .map(keyword => keyword.trim())
            .filter(keyword => keyword.length > 0)
        )
      ).slice(0, 8);

      if (normalizedKeywords.length === 0) {
        return [];
      }

      try {
        const matchedIntents = detectSpecialtyIntents([
          input.summary ?? "",
          ...normalizedKeywords,
        ]);
        const looksEnglish =
          normalizedKeywords.filter(keyword => /[a-zA-Z]/.test(keyword)).length >=
          Math.ceil(normalizedKeywords.length / 2);

        let translatedZhKeywords: string[] = [];
        if (looksEnglish) {
          try {
            const translationResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content:
                    "Translate English symptom/department keywords into concise Chinese clinical search keywords. Return JSON only.",
                },
                {
                  role: "user",
                  content: JSON.stringify({
                    keywords: normalizedKeywords,
                  }),
                },
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "keyword_translation",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      keywordsZh: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                    required: ["keywordsZh"],
                    additionalProperties: false,
                  },
                },
              },
              max_tokens: 300,
            });

            const translated = JSON.parse(
              (() => {
                const content = translationResponse.choices[0].message.content;
                if (typeof content === "string") {
                  return content;
                }
                return content
                  .filter(part => part.type === "text")
                  .map(part => part.text)
                  .join("\n");
              })()
            ) as { keywordsZh?: string[] };

            translatedZhKeywords = (translated.keywordsZh ?? [])
              .map(keyword => keyword.trim())
              .filter(keyword => keyword.length > 0)
              .slice(0, 8);
          } catch (error) {
            console.warn("[Doctors] keyword translation failed:", error);
          }
        }

        const zhQueryKeywords = Array.from(
          new Set([...normalizedKeywords, ...translatedZhKeywords])
        ).slice(0, 10);
        const enQueryKeywords = normalizedKeywords.slice(0, 10);
        const tagHints = getIntentNormalizedTags(matchedIntents);

        let recommendationCandidates: DoctorResult[] = [];
        let candidatePool: DoctorResult[] = [];
        let candidateDoctorIds: number[] | undefined;
        let storedTagsByDoctorId = new Map<number, string[]>();
        if (matchedIntents.length > 0) {
          recommendationCandidates =
            await doctorsRepo.listRecommendationCandidates();
          storedTagsByDoctorId =
            await doctorsRepo.listDoctorSpecialtyTagsByDoctorIds(
              recommendationCandidates.map(item => item.doctor.id)
            );

          const stronglyMatchedCandidates = recommendationCandidates.filter(
            candidate => {
              const normalizedTags = getNormalizedDoctorTags(
                candidate,
                storedTagsByDoctorId
              );
              return tagHints.some(tag => normalizedTags.has(tag));
            }
          );
          const generalFallbackCandidates = recommendationCandidates.filter(
            candidate => {
              const normalizedTags = getNormalizedDoctorTags(
                candidate,
                storedTagsByDoctorId
              );
              return (
                !tagHints.some(tag => normalizedTags.has(tag)) &&
                (normalizedTags.has("general_medicine") ||
                  isGeneralDepartment(candidate))
              );
            }
          );
          candidatePool = [
            ...stronglyMatchedCandidates,
            ...generalFallbackCandidates,
          ];
          if (candidatePool.length > 0) {
            candidateDoctorIds = candidatePool.map(item => item.doctor.id);
          }
        }

        const semanticQuery = [
          input.summary ?? "",
          ...normalizedKeywords,
          ...translatedZhKeywords,
        ]
          .map(value => value.trim())
          .filter(value => value.length > 0)
          .join("\n");

        const primaryBuckets = await retrieveRecommendationBuckets({
          zhQueryKeywords,
          enQueryKeywords,
          translatedZhKeywords,
          semanticQuery,
          candidateDoctorIds,
        });

        let activeBuckets = primaryBuckets;
        let usedUnrestrictedFallback = false;
        if (
          candidateDoctorIds &&
          candidateDoctorIds.length > 0 &&
          getUniqueDoctorIdsFromBuckets(primaryBuckets).length === 0
        ) {
          usedUnrestrictedFallback = true;
          activeBuckets = await retrieveRecommendationBuckets({
            zhQueryKeywords,
            enQueryKeywords,
            translatedZhKeywords,
            semanticQuery,
          });
        }

        const allDoctorIds = getUniqueDoctorIdsFromBuckets(activeBuckets);
        if (allDoctorIds.length > 0) {
          const missingTagDoctorIds = allDoctorIds.filter(
            id => !storedTagsByDoctorId.has(id)
          );
          if (missingTagDoctorIds.length > 0) {
            const missingTags =
              await doctorsRepo.listDoctorSpecialtyTagsByDoctorIds(
                missingTagDoctorIds
              );
            missingTags.forEach((tags, doctorId) => {
              storedTagsByDoctorId.set(doctorId, tags);
            });
          }
        }
        const scored = new Map<
          number,
          {
            result: DoctorResult;
            hybridScore: number;
          }
        >();

        const keywordPool = Array.from(
          new Set([...normalizedKeywords, ...translatedZhKeywords])
        ).map(keyword => keyword.toLowerCase());

        const scoreKeywordHits = (result: DoctorResult) => {
          const searchableText = buildDoctorSearchableText(result);

          return keywordPool.reduce(
            (count, keyword) =>
              searchableText.includes(keyword) ? count + 1 : count,
            0
          );
        };

        const buildRecommendationReason = (result: DoctorResult) => {
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
        };

        const toPublicRecommendation = (result: DoctorResult) => ({
          reason: buildRecommendationReason(result),
          title: toLocalizedTextValue(
            result.doctor.title,
            result.doctor.titleEn
          ),
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
        });

        const upsertScore = (result: DoctorResult, baseScore: number) => {
          const intentMatches = countIntentDepartmentMatches(result, matchedIntents);
          const normalizedTagSet = getNormalizedDoctorTags(
            result,
            storedTagsByDoctorId
          );
          const tagMatches = tagHints.filter(tag => normalizedTagSet.has(tag)).length;
          const keywordHitScore = scoreKeywordHits(result) * 2;
          const recScoreBonus = (result.doctor.recommendationScore ?? 0) / 20;
          const intentBoost = intentMatches * 10;
          const tagBoost = tagMatches * 12;
          const mismatchPenalty =
            matchedIntents.length > 0 &&
            intentMatches === 0 &&
            tagMatches === 0 &&
            !isGeneralDepartment(result)
              ? -8
              : 0;
          const total =
            baseScore +
            keywordHitScore +
            recScoreBonus +
            intentBoost +
            tagBoost +
            mismatchPenalty;
          const existing = scored.get(result.doctor.id);

          if (!existing) {
            scored.set(result.doctor.id, { result, hybridScore: total });
            return;
          }

          existing.hybridScore += total;
        };

        activeBuckets.zhResults.forEach(result => upsertScore(result, 3));
        activeBuckets.enResults.forEach(result => upsertScore(result, 3));
        activeBuckets.vectorResults.forEach(result => upsertScore(result, 5));

        let usedRankFallback = false;
        let fallbackSource = "none";
        if (scored.size === 0) {
          if (recommendationCandidates.length === 0) {
            recommendationCandidates =
              await doctorsRepo.listRecommendationCandidates();
          }

          const fallbackCandidates =
            candidatePool.length > 0 ? candidatePool : recommendationCandidates;
          const fallbackDoctorIds = fallbackCandidates.map(item => item.doctor.id);
          if (fallbackDoctorIds.length > 0) {
            const missingFallbackTagDoctorIds = fallbackDoctorIds.filter(
              id => !storedTagsByDoctorId.has(id)
            );
            if (missingFallbackTagDoctorIds.length > 0) {
              const missingTags =
                await doctorsRepo.listDoctorSpecialtyTagsByDoctorIds(
                  missingFallbackTagDoctorIds
                );
              missingTags.forEach((tags, doctorId) => {
                storedTagsByDoctorId.set(doctorId, tags);
              });
            }

            fallbackCandidates.forEach(result => upsertScore(result, 1));
            usedRankFallback = true;
            fallbackSource =
              candidatePool.length > 0
                ? "candidate_pool"
                : "recommendation_candidates";
          }
        }

        const rankedResults = Array.from(scored.values())
          .sort((left, right) => {
            if (right.hybridScore !== left.hybridScore) {
              return right.hybridScore - left.hybridScore;
            }
            return (
              (right.result.doctor.recommendationScore ?? 0) -
              (left.result.doctor.recommendationScore ?? 0)
            );
          })
          .map(item => item.result);

        const finalResults =
          matchedIntents.length === 0
            ? rankedResults.slice(0, limit).map(toPublicRecommendation)
            : (() => {
                const stronglyMatched = rankedResults.filter(item =>
                  countIntentDepartmentMatches(item, matchedIntents) > 0 ||
                  tagHints.some(tag =>
                    getNormalizedDoctorTags(item, storedTagsByDoctorId).has(tag)
                  )
                );
                const generalFallback = rankedResults.filter(
                  item =>
                    countIntentDepartmentMatches(item, matchedIntents) === 0 &&
                    isGeneralDepartment(item)
                );
                const remainder = rankedResults.filter(
                  item =>
                    countIntentDepartmentMatches(item, matchedIntents) === 0 &&
                    !isGeneralDepartment(item)
                );

                return [...stronglyMatched, ...generalFallback, ...remainder]
                  .slice(0, limit)
                  .map(toPublicRecommendation);
              })();

        logRecommendationTelemetry({
          looksEnglish,
          keywordCount: normalizedKeywords.length,
          translatedKeywordCount: translatedZhKeywords.length,
          matchedIntents: matchedIntents.map(intent => intent.id),
          tagHints,
          candidatePoolCount: candidatePool.length,
          usedUnrestrictedFallback,
          usedRankFallback,
          fallbackSource,
          primaryCounts: getBucketCounts(primaryBuckets),
          activeCounts: getBucketCounts(activeBuckets),
          finalCount: finalResults.length,
        });

        return finalResults;
      } catch (error) {
        console.error("[Doctors] recommend failed:", error);
        return [];
      }
    }),

  /**
   * Get doctors by department
   */
  getByDepartment: publicProcedure
    .input(
      z.object({
        departmentId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const results = await doctorsRepo.getDoctorsByDepartment(
        input.departmentId,
        input.limit
      );

      return results.map(toPublicLocalizedDoctorSearchResult);
    }),
});
