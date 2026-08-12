import { createEmbedding, invokeLLM } from "../../_core/llm";
import { createLogger } from "../../_core/logger";
import { doctorSearchApi as doctors } from "../doctors/publicApi";
import {
  detectIntentDepartments,
  isGeneralDepartment,
  normalizeIntentTokens,
  scoreDoctorRelevance,
  tokenizeForMatching,
} from "./doctorRecommendationMatching";
import {
  buildDefaultRecommendationReason,
  buildEnglishRankingCandidate,
  buildGroundedRecommendationMessage,
  buildMatchedReason,
  buildNoMatchFollowupMessage,
  getEnglishGroundedDisplayFields,
  type GroundedDoctorRecommendation,
} from "./doctorRecommendationPresentation";

const logger = createLogger("chat-doctor-recommendation");

export type ChatMedicalExtraction = {
  keywords: string[];
  symptoms: string;
  duration: string;
  age: number | null;
  urgency: "low" | "medium" | "high";
  readyForRecommendation: boolean;
};

export type RecommendedDoctor = {
  doctorId: number;
  reason: string;
};

export async function buildDoctorRecommendation(input: {
  extraction: ChatMedicalExtraction;
  isEnglish: boolean;
  assistantMessage: string;
}) {
  const { extraction, isEnglish } = input;
  let assistantMessage = input.assistantMessage;
  let recommendedDoctors: RecommendedDoctor[] = [];

  if (!extraction.readyForRecommendation || extraction.keywords.length === 0) {
    return { assistantMessage, recommendedDoctors };
  }

  type DoctorSearchResult = Awaited<ReturnType<typeof doctors.search>>;

  let vectorResults: DoctorSearchResult = [];
  try {
    const semanticQuery = [extraction.symptoms, ...extraction.keywords]
      .filter(
        (item: unknown): item is string =>
          typeof item === "string" && item.trim().length > 0
      )
      .join("\n");

    if (semanticQuery.length > 0) {
      const queryEmbedding = await createEmbedding(semanticQuery);
      vectorResults = await doctors.searchByEmbedding(queryEmbedding, 10);
    }
  } catch (error) {
    logger.warn("vector_search_failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  let keywordResults = await doctors.search(extraction.keywords, 10, {
    lang: isEnglish ? "en" : "zh",
  });

  if (isEnglish && keywordResults.length < 3) {
    const translationResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Translate English medical keywords into concise Chinese equivalents. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({ keywords: extraction.keywords }),
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
    });
    const translated = JSON.parse(
      translationResponse.choices[0].message.content as string
    ) as { keywordsZh: string[] };

    keywordResults = await doctors.search(extraction.keywords, 10, {
      lang: "en",
      fallbackKeywords: translated.keywordsZh,
    });
  }

  const mergedResults = new Map<number, DoctorSearchResult[number]>();
  for (const result of vectorResults) {
    mergedResults.set(result.doctor.id, result);
  }
  for (const result of keywordResults) {
    if (!mergedResults.has(result.doctor.id)) {
      mergedResults.set(result.doctor.id, result);
    }
  }

  const searchResults = Array.from(mergedResults.values()).slice(0, 10);

  const intentText = [extraction.symptoms, ...(extraction.keywords ?? [])]
    .filter(
      (item: unknown): item is string =>
        typeof item === "string" && item.trim().length > 0
    )
    .join(" ");
  const intentTokens = normalizeIntentTokens(tokenizeForMatching(intentText));
  const intentDepartments = detectIntentDepartments(intentText);
  const scoredSearchResults = searchResults
    .map(result => ({
      result,
      score: scoreDoctorRelevance(result, intentTokens, intentDepartments),
    }))
    .filter(item =>
      intentDepartments.length > 0 ? item.score >= 3 : item.score > 0
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return (
        (right.result.doctor.recommendationScore ?? 0) -
        (left.result.doctor.recommendationScore ?? 0)
      );
    });
  const relevantSearchResults = scoredSearchResults.map(item => item.result);

  if (relevantSearchResults.length > 0) {
    const doctorRankingInput = isEnglish
      ? JSON.stringify(
          relevantSearchResults.map((result, index) =>
            buildEnglishRankingCandidate(result, index)
          ),
          null,
          2
        )
      : relevantSearchResults
          .map((result, index) => ({
            id: result.doctor.id,
            index,
            text: `${index + 1}. ${result.doctor.name} - ${result.hospital.name} ${result.department.name}
Title: ${result.doctor.title || "未知"}
Expertise: ${result.doctor.expertise?.substring(0, 200) || "暂无信息"}
Recommendation Score: ${result.doctor.recommendationScore || "N/A"}`,
          }))
          .map(item => item.text)
          .join("\n\n");

    const rankingPrompt = isEnglish
      ? `Based on patient needs, select the 3-5 most suitable doctors from candidates, ranked by relevance.
Return JSON format:
{
  "selectedDoctors": [
    {
      "doctorId": doctor_id,
      "reason": "recommendation reason"
    }
  ]
}
Candidate doctors are provided as JSON. English display fields may be null, and missingEnglishFields lists which translations are unavailable.
Treat missing English fields as metadata only. Do not invent replacement text or restate placeholder copy.
Respond only in English.`
      : `根据患者需求，从候选医生中选出 3-5 位最合适的，按相关度排序。
返回 JSON：
{
  "selectedDoctors": [
    {
      "doctorId": doctor_id,
      "reason": "推荐理由"
    }
  ]
}
仅用中文返回。`;

    const rankingUserContent = isEnglish
      ? `Patient needs: ${extraction.symptoms}
Keywords: ${extraction.keywords.join(", ")}

Candidate doctors JSON:
${doctorRankingInput}`
      : `Patient needs: ${extraction.symptoms}
Keywords: ${extraction.keywords.join(", ")}

Candidate doctors:
${doctorRankingInput}`;

    const rankingResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: rankingPrompt,
        },
        {
          role: "user",
          content: rankingUserContent,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "doctor_ranking",
          strict: true,
          schema: {
            type: "object",
            properties: {
              selectedDoctors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    doctorId: { type: "number" },
                    reason: { type: "string" },
                  },
                  required: ["doctorId", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["selectedDoctors"],
            additionalProperties: false,
          },
        },
      },
    });

    const ranking = JSON.parse(
      rankingResponse.choices[0].message.content as string
    ) as {
      selectedDoctors?: Array<{
        doctorId: number | string;
        reason?: string;
      }>;
    };

    const candidateDoctorIds = new Set(
      relevantSearchResults.map(result => result.doctor.id)
    );

    const validatedRecommendations = (ranking.selectedDoctors ?? [])
      .map(item => ({
        doctorId: Number(item.doctorId),
        reason:
          typeof item.reason === "string" && item.reason.trim().length > 0
            ? item.reason.trim()
            : buildDefaultRecommendationReason(isEnglish),
      }))
      .filter(
        item =>
          Number.isInteger(item.doctorId) &&
          item.doctorId > 0 &&
          candidateDoctorIds.has(item.doctorId)
      );

    if (validatedRecommendations.length > 0) {
      recommendedDoctors = validatedRecommendations.slice(0, 5);
    } else {
      recommendedDoctors = relevantSearchResults.slice(0, 3).map(result => ({
        doctorId: result.doctor.id,
        reason: buildMatchedReason(isEnglish, result),
      }));
    }
  } else if (searchResults.length > 0) {
    const fallbackDoctors = searchResults
      .filter(result => isGeneralDepartment(result))
      .slice(0, 3);

    if (fallbackDoctors.length > 0) {
      recommendedDoctors = fallbackDoctors.map(result => ({
        doctorId: result.doctor.id,
        reason: isEnglish
          ? "No exact specialty match found yet. This is a safer fallback for first triage."
          : "目前尚无完全匹配专科，先由更综合的门诊方向进行初步分诊更稳妥。",
      }));
    } else {
      assistantMessage = isEnglish
        ? "I could not find specialists in our current database that clearly match your symptom focus yet. Please share more details or try a related department keyword."
        : "当前数据库中暂未检索到与您症状明确匹配的专科医生。您可以补充更多症状细节，或尝试提供更具体的科室关键词。";
    }
  }

  if (recommendedDoctors.length > 0) {
    const searchResultById = new Map(
      relevantSearchResults.map(result => [result.doctor.id, result])
    );

    const groundedRecommendations = recommendedDoctors
      .map(item => {
        const matched = searchResultById.get(item.doctorId);
        if (!matched) return null;

        if (isEnglish) {
          const englishDisplayFields = getEnglishGroundedDisplayFields(matched);
          if (!englishDisplayFields) return null;

          return {
            doctorId: matched.doctor.id,
            reason: item.reason,
            ...englishDisplayFields,
          } satisfies GroundedDoctorRecommendation;
        }

        return {
          doctorId: matched.doctor.id,
          reason: item.reason,
          doctorName: matched.doctor.name,
          hospitalName: matched.hospital.name,
          departmentName: matched.department.name,
        } satisfies GroundedDoctorRecommendation;
      })
      .filter((item): item is GroundedDoctorRecommendation => item !== null);

    if (groundedRecommendations.length > 0) {
      assistantMessage = await buildGroundedRecommendationMessage(
        isEnglish,
        extraction.symptoms,
        groundedRecommendations
      );
    } else if (isEnglish) {
      assistantMessage = buildNoMatchFollowupMessage(true);
    }
  }

  if (recommendedDoctors.length === 0) {
    assistantMessage = buildNoMatchFollowupMessage(isEnglish);
  }

  return { assistantMessage, recommendedDoctors };
}
