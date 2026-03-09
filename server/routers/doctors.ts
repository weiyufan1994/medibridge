import { createEmbedding, invokeLLM } from "../_core/llm";
import * as doctorsRepo from "../modules/doctors/repo";
import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

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
      return await doctorsRepo.getDoctorById(input.id);
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
      return await doctorsRepo.searchDoctors(input.keywords, input.limit, {
        lang: input.lang ?? "zh",
        fallbackKeywords: input.fallbackKeywords,
      });
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

        const [zhResults, enResults] = await Promise.all([
          doctorsRepo.searchDoctors(zhQueryKeywords, 20, { lang: "zh" }),
          doctorsRepo.searchDoctors(enQueryKeywords, 20, {
            lang: "en",
            fallbackKeywords: translatedZhKeywords,
          }),
        ]);

        let vectorResults: Awaited<
          ReturnType<typeof doctorsRepo.searchDoctorsByEmbedding>
        > = [];
        const semanticQuery = [
          input.summary ?? "",
          ...normalizedKeywords,
          ...translatedZhKeywords,
        ]
          .map(value => value.trim())
          .filter(value => value.length > 0)
          .join("\n");

        if (semanticQuery.length > 0) {
          try {
            const queryEmbedding = await createEmbedding(semanticQuery);
            vectorResults = await doctorsRepo.searchDoctorsByEmbedding(
              queryEmbedding,
              20
            );
          } catch (error) {
            console.warn("[Doctors] vector retrieval failed:", error);
          }
        }

        type DoctorResult = (typeof zhResults)[number];
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
          const searchableText = [
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

          if (looksEnglish) {
            if (matchedKeywords.length > 0) {
              return `Matched ${matchedKeywords.join(", ")} with ${departmentName}.`;
            }
            return `Relevant specialist in ${departmentName} for your triage profile.`;
          }

          if (matchedKeywords.length > 0) {
            return `与关键词 ${matchedKeywords.join("、")} 匹配，建议就诊 ${result.department.name}。`;
          }
          return `该医生所在科室（${result.department.name}）与分诊信息相关。`;
        };

        const upsertScore = (result: DoctorResult, baseScore: number) => {
          const keywordHitScore = scoreKeywordHits(result) * 2;
          const recScoreBonus = (result.doctor.recommendationScore ?? 0) / 20;
          const total = baseScore + keywordHitScore + recScoreBonus;
          const existing = scored.get(result.doctor.id);

          if (!existing) {
            scored.set(result.doctor.id, { result, hybridScore: total });
            return;
          }

          existing.hybridScore += total;
        };

        zhResults.forEach(result => upsertScore(result, 3));
        enResults.forEach(result => upsertScore(result, 3));
        vectorResults.forEach(result => upsertScore(result, 5));

        return Array.from(scored.values())
          .sort((left, right) => {
            if (right.hybridScore !== left.hybridScore) {
              return right.hybridScore - left.hybridScore;
            }
            return (
              (right.result.doctor.recommendationScore ?? 0) -
              (left.result.doctor.recommendationScore ?? 0)
            );
          })
          .map(item => ({
            ...item.result,
            reason: buildRecommendationReason(item.result),
            title: item.result.doctor.title ?? item.result.doctor.titleEn ?? "",
            specialty:
              item.result.doctor.specialty ??
              item.result.doctor.specialtyEn ??
              item.result.doctor.expertise ??
              item.result.doctor.expertiseEn ??
              "",
            biography:
              item.result.doctor.description ??
              item.result.doctor.experience ??
              item.result.doctor.expertise ??
              "",
            yearsOfExperience: parseYearsOfExperience(item.result.doctor.experience),
          }))
          .slice(0, limit);
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
      return await doctorsRepo.getDoctorsByDepartment(
        input.departmentId,
        input.limit
      );
    }),
});
