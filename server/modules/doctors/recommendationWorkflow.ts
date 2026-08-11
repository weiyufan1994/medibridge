import { invokeLLM } from "../../_core/llm";
import * as doctorsRepo from "./repo";
import type { RecommendDoctorsInput } from "./schemas";
import {
  buildDoctorSearchableText,
  countIntentDepartmentMatches,
  detectSpecialtyIntents,
  getBucketCounts,
  getIntentNormalizedTags,
  getNormalizedDoctorTags,
  getUniqueDoctorIdsFromBuckets,
  isGeneralDepartment,
  retrieveRecommendationBuckets,
  toPublicRecommendation,
  type DoctorResult,
} from "./recommendationSupport";

function logRecommendationTelemetry(payload: Record<string, unknown>) {
  console.info("[Doctors] recommend telemetry", JSON.stringify(payload));
}

export async function recommendDoctors(input: RecommendDoctorsInput) {
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

    const upsertScore = (result: DoctorResult, baseScore: number) => {
      const intentMatches = countIntentDepartmentMatches(
        result,
        matchedIntents
      );
      const normalizedTagSet = getNormalizedDoctorTags(
        result,
        storedTagsByDoctorId
      );
      const tagMatches = tagHints.filter(tag =>
        normalizedTagSet.has(tag)
      ).length;
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
        ? rankedResults
            .slice(0, limit)
            .map(result => toPublicRecommendation(result, keywordPool))
        : (() => {
            const stronglyMatched = rankedResults.filter(
              item =>
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
              .map(result => toPublicRecommendation(result, keywordPool));
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
}
