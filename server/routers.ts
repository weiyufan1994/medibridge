import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createEmbedding, invokeLLM } from "./_core/llm";
import * as db from "./db";
import { nanoid } from "nanoid";

const tokenizeForMatching = (input: string): string[] =>
  input
    .toLowerCase()
    .split(/[\s,，。！？；;:：、\n\t()（）【】\[\]"'“”‘’]+/)
    .map(token => token.trim())
    .filter(token => token.length >= 2);

const isDoctorRelevantToSymptoms = (
  doctorResult: Awaited<ReturnType<typeof db.searchDoctors>>[number],
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
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  return tokens.some(token => haystack.includes(token));
};

type GroundedDoctorRecommendation = {
  doctorId: number;
  reason: string;
  doctorName: string;
  hospitalName: string;
  departmentName: string;
};

const buildGroundedRecommendationMessage = (
  isEnglish: boolean,
  recommendations: GroundedDoctorRecommendation[]
) => {
  if (recommendations.length === 0) {
    return isEnglish
      ? "I currently do not have enough matched doctors in our database for your symptoms. Please provide a bit more detail, and I will continue narrowing down suitable specialists."
      : "当前数据库中暂未匹配到足够合适的医生。请补充一些症状细节，我会继续为您筛选更合适的专科医生。";
  }

  if (isEnglish) {
    const lines = recommendations.map(
      (item, index) =>
        `${index + 1}. I recommend Dr. ${item.doctorName} at ${item.hospitalName} (${item.departmentName}). Reason: ${item.reason}`
    );
    return [
      "Based on your current symptoms, here are the most relevant doctors from our database:",
      ...lines,
      "If you'd like, I can help you compare these doctors and suggest which one to book first.",
    ].join("\n");
  }

  const lines = recommendations.map(
    (item, index) =>
      `${index + 1}. 推荐 ${item.hospitalName}（${item.departmentName}）的 ${item.doctorName} 医生。理由：${item.reason}`
  );
  return [
    "根据您当前的症状，以下是数据库中匹配度更高的医生：",
    ...lines,
    "如果您愿意，我可以继续帮您比较这些医生并建议优先预约顺序。",
  ].join("\n");
};

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  chat: router({
    /**
     * Send a message and get AI response with doctor recommendations
     */
    sendMessage: publicProcedure
      .input(z.object({
        sessionId: z.string().optional(),
        message: z.string(),
        chatHistory: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })).optional(),
        lang: z.enum(["auto", "en", "zh"]).optional().default("auto"),
      }))
      .mutation(async ({ input }) => {
        const sessionId = input.sessionId || nanoid();
        const chatHistory = input.chatHistory || [];
        const detectLanguage = (text: string) =>
          /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
        const resolvedLang = input.lang === "auto" ? detectLanguage(input.message) : input.lang;
        const isEnglish = resolvedLang === "en";
        const placeholder = "Translation in progress";

        const systemPrompt = isEnglish
          ? `You are MediBridge's medical consultation assistant, helping North American patients find suitable doctors in Shanghai, China. Your tasks:

1. Kindly ask about the patient's symptoms, duration, age, and medical history
2. When you have enough information (after 1-2 exchanges), PROACTIVELY recommend specific doctors and hospitals
3. Always mention both the doctor's name AND the hospital name in your recommendations
4. After recommending doctors, encourage patients to book an appointment for further triage consultation
5. Use phrases like: "I recommend Dr. [Name] at [Hospital Name]" or "You can book an appointment with Dr. [Name] for a detailed triage consultation"

IMPORTANT:
- Be proactive - don't wait for patients to ask "where should I go?"
- Always provide concrete doctor and hospital recommendations when you have sufficient information
- Encourage booking appointments for professional triage services
- Use a warm, professional tone
- Do not provide medical diagnoses - focus on connecting patients with the right specialists
- Do not invent doctor names or hospital names that are not explicitly provided by the system
- Respond only in English`
          : `你是 MediBridge 的医疗咨询助手，帮助用户在上海找到合适的医生。你的任务：

1. 友好询问症状、病程、年龄和既往史
2. 在获得基本信息后（1-2 轮对话），主动推荐具体医生和医院
3. 推荐时必须同时提到医生姓名和医院名称
4. 推荐后鼓励用户预约进一步分诊咨询
5. 使用类似：“我推荐 [医院] 的 [医生]” 的表述

重要要求：
- 主动推荐，不要等待用户主动提问
- 有足够信息时必须给出具体医生/医院
- 语气温和专业
- 不给出诊断，仅做分诊匹配
- 不要编造系统未提供的医生或医院名称
- 仅用中文回复`;
        
        // Build conversation history
        const messages = [
          {
            role: "system" as const,
            content: systemPrompt
          },
          ...chatHistory.map(msg => ({
            role: msg.role,
            content: msg.content
          })),
          {
            role: "user" as const,
            content: input.message
          }
        ];

        // Get AI response
        const aiResponse = await invokeLLM({ messages });
        let assistantMessage = aiResponse.choices[0].message.content as string;

        // Extract medical keywords using LLM
        const extractionResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: isEnglish
                ? `Extract medical keywords from patient conversation. Return JSON format:
{
  "keywords": ["keyword1", "keyword2"],
  "symptoms": "symptom description",
  "duration": "duration description",
  "age": age_number or null,
  "readyForRecommendation": true/false
}

Keywords should include disease names, symptoms, specialty names, treatment methods, etc.
Return keywords in the same language as the input.
readyForRecommendation should be true if you have basic symptom information (even after just 1-2 exchanges).`
                : `从患者对话中提取医学关键词，返回 JSON：
{
  "keywords": ["keyword1", "keyword2"],
  "symptoms": "症状描述",
  "duration": "病程描述",
  "age": age_number or null,
  "readyForRecommendation": true/false
}

关键词应包括疾病、症状、科室名称、治疗方式等。
关键词使用与输入一致的语言。
若已获得基本症状信息（即使仅 1-2 轮），readyForRecommendation 应为 true。`
            },
            {
              role: "user",
              content: `Patient conversation history:\n${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nLatest message: ${input.message}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "medical_extraction",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  keywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Extracted medical keywords"
                  },
                  symptoms: {
                    type: "string",
                    description: "Symptom description"
                  },
                  duration: {
                    type: "string",
                    description: "Duration description"
                  },
                  age: {
                    type: ["number", "null"],
                    description: "Patient age"
                  },
                  readyForRecommendation: {
                    type: "boolean",
                    description: "Ready to recommend doctors"
                  }
                },
                required: ["keywords", "symptoms", "duration", "age", "readyForRecommendation"],
                additionalProperties: false
              }
            }
          }
        });

        const extraction = JSON.parse(extractionResponse.choices[0].message.content as string);

        // Search doctors if ready
        let recommendedDoctors: any[] = [];
        if (extraction.readyForRecommendation && extraction.keywords.length > 0) {
          type DoctorSearchResult = Awaited<ReturnType<typeof db.searchDoctors>>;

          let vectorResults: DoctorSearchResult = [];
          try {
            const semanticQuery = [extraction.symptoms, ...extraction.keywords]
              .filter((item: unknown): item is string =>
                typeof item === "string" && item.trim().length > 0
              )
              .join("\n");

            if (semanticQuery.length > 0) {
              const queryEmbedding = await createEmbedding(semanticQuery);
              vectorResults = await db.searchDoctorsByEmbedding(queryEmbedding, 10);
            }
          } catch (error) {
            console.warn("[RAG] Vector search failed, falling back to keyword search:", error);
          }

          let keywordResults = await db.searchDoctors(extraction.keywords, 10, {
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

            keywordResults = await db.searchDoctors(extraction.keywords, 10, {
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

          const intentTokens = tokenizeForMatching(
            [extraction.symptoms, ...(extraction.keywords ?? [])]
              .filter((item: unknown): item is string =>
                typeof item === "string" && item.trim().length > 0
              )
              .join(" ")
          );

          const relevantSearchResults = searchResults.filter(result =>
            isDoctorRelevantToSymptoms(result, intentTokens)
          );
          
          // Rank doctors using LLM
          if (relevantSearchResults.length > 0) {
            const doctorDescriptions = relevantSearchResults.map((r, idx) => ({
              id: r.doctor.id,
              index: idx,
              text: `${idx + 1}. ${
                isEnglish
                  ? r.doctor.nameEn || placeholder
                  : r.doctor.name
              } - ${
                isEnglish
                  ? r.hospital.nameEn || placeholder
                  : r.hospital.name
              } ${
                isEnglish
                  ? r.department.nameEn || placeholder
                  : r.department.name
              }
Title: ${
                isEnglish
                  ? r.doctor.titleEn || placeholder
                  : r.doctor.title || (isEnglish ? placeholder : "未知")
              }
Expertise: ${
                isEnglish
                  ? r.doctor.expertiseEn?.substring(0, 200) || placeholder
                  : r.doctor.expertise?.substring(0, 200) || "暂无信息"
              }
Recommendation Score: ${r.doctor.recommendationScore || "N/A"}`,
            }));

            const rankingResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: isEnglish
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
仅用中文返回。`
                },
                {
                  role: "user",
                  content: `Patient needs: ${extraction.symptoms}
Keywords: ${extraction.keywords.join(', ')}

Candidate doctors:
${doctorDescriptions.map(d => d.text).join('\n\n')}`
                }
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
                            reason: { type: "string" }
                          },
                          required: ["doctorId", "reason"],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ["selectedDoctors"],
                    additionalProperties: false
                  }
                }
              }
            });

            const ranking = JSON.parse(
              rankingResponse.choices[0].message.content as string
            ) as {
              selectedDoctors?: Array<{ doctorId: number | string; reason?: string }>;
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
                    : isEnglish
                      ? "Recommended based on your symptoms and medical needs."
                      : "根据您的症状与就诊需求推荐。",
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
                reason: isEnglish
                  ? "Recommended from relevant specialists matched to your symptoms."
                  : "基于症状匹配到的相关专科医生推荐。",
              }));
            }
          } else if (searchResults.length > 0) {
            assistantMessage += isEnglish
              ? "\n\nI could not find specialists in our current database that clearly match your symptom focus yet. Please share more details or try a related department keyword."
              : "\n\n当前数据库中暂未检索到与您症状明确匹配的专科医生。您可以补充更多症状细节，或尝试提供更具体的科室关键词。";
          }

          if (recommendedDoctors.length > 0) {
            const searchResultById = new Map(
              relevantSearchResults.map(result => [result.doctor.id, result])
            );

            const groundedRecommendations = recommendedDoctors
              .map(item => {
                const matched = searchResultById.get(item.doctorId);
                if (!matched) return null;
                return {
                  doctorId: matched.doctor.id,
                  reason: item.reason,
                  doctorName: isEnglish
                    ? matched.doctor.nameEn || matched.doctor.name
                    : matched.doctor.name,
                  hospitalName: isEnglish
                    ? matched.hospital.nameEn || matched.hospital.name
                    : matched.hospital.name,
                  departmentName: isEnglish
                    ? matched.department.nameEn || matched.department.name
                    : matched.department.name,
                } satisfies GroundedDoctorRecommendation;
              })
              .filter(
                (
                  item
                ): item is GroundedDoctorRecommendation =>
                  item !== null
              );

            if (groundedRecommendations.length > 0) {
              assistantMessage = buildGroundedRecommendationMessage(
                isEnglish,
                groundedRecommendations
              );
            }
          }
        }

        // Update session
        const updatedHistory = [
          ...chatHistory,
          { role: "user" as const, content: input.message },
          { role: "assistant" as const, content: assistantMessage }
        ];

        await db.upsertPatientSession({
          sessionId,
          chatHistory: JSON.stringify(updatedHistory),
          symptoms: extraction.symptoms,
          duration: extraction.duration,
          age: extraction.age,
          recommendedDoctors: recommendedDoctors.length > 0 ? JSON.stringify(recommendedDoctors) : null,
        });

        return {
          sessionId,
          message: assistantMessage,
          recommendedDoctors,
          extraction
        };
      }),

    /**
     * Get session history
     */
    getSession: publicProcedure
      .input(z.object({
        sessionId: z.string()
      }))
      .query(async ({ input }) => {
        const session = await db.getPatientSession(input.sessionId);
        if (!session) {
          return null;
        }

        return {
          ...session,
          chatHistory: JSON.parse(session.chatHistory as string),
          recommendedDoctors: session.recommendedDoctors 
            ? JSON.parse(session.recommendedDoctors as string)
            : []
        };
      }),
  }),

  doctors: router({
    /**
     * Get doctor details by ID
     */
    getById: publicProcedure
      .input(z.object({
        id: z.number()
      }))
      .query(async ({ input }) => {
        return await db.getDoctorById(input.id);
      }),

    /**
     * Search doctors by keywords
     */
    search: publicProcedure
      .input(z.object({
        keywords: z.array(z.string()),
        limit: z.number().optional(),
        lang: z.enum(["en", "zh"]).optional(),
        fallbackKeywords: z.array(z.string()).optional(),
      }))
      .query(async ({ input }) => {
        return await db.searchDoctors(input.keywords, input.limit, {
          lang: input.lang ?? "zh",
          fallbackKeywords: input.fallbackKeywords,
        });
      }),

    /**
     * Get doctors by department
     */
    getByDepartment: publicProcedure
      .input(z.object({
        departmentId: z.number(),
        limit: z.number().optional()
      }))
      .query(async ({ input }) => {
        return await db.getDoctorsByDepartment(input.departmentId, input.limit);
      }),
  }),

  hospitals: router({
    /**
     * Get all hospitals
     */
    getAll: publicProcedure.query(async () => {
      return await db.getAllHospitals();
    }),

    /**
     * Get departments by hospital
     */
    getDepartments: publicProcedure
      .input(z.object({
        hospitalId: z.number()
      }))
      .query(async ({ input }) => {
        return await db.getDepartmentsByHospital(input.hospitalId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
