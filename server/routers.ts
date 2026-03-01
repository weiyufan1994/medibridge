import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createEmbedding, invokeLLM, processTriageChat } from "./_core/llm";
import * as db from "./db";
import { nanoid } from "nanoid";
import { appointmentsRouter } from "./appointmentsRouter";
import { visitRouter } from "./visitRouter";

const tokenizeForMatching = (input: string): string[] =>
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

const normalizeIntentTokens = (tokens: string[]) =>
  tokens.filter(token => !STOP_TOKENS.has(token));

type DepartmentIntent = {
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

const detectIntentDepartments = (text: string): DepartmentIntent[] => {
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

const isGeneralDepartment = (
  doctorResult: Awaited<ReturnType<typeof db.searchDoctors>>[number]
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

const scoreDoctorRelevance = (
  doctorResult: Awaited<ReturnType<typeof db.searchDoctors>>[number],
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
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0
    )
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

const buildGroundedRecommendationMessageTemplate = (
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
        `${index + 1}. Dr. ${item.doctorName} - ${item.hospitalName} (${item.departmentName})\nReason: ${item.reason}`
    );
    return [
      "Thanks for sharing these details. Based on your current symptoms, I found these doctors in our database:",
      ...lines,
      "If you want, I can help you decide which one to book first.",
    ].join("\n");
  }

  const lines = recommendations.map(
    (item, index) =>
      `${index + 1}. ${item.doctorName} 医生 - ${item.hospitalName}（${item.departmentName}）\n推荐理由：${item.reason}`
  );
  return [
    "收到。根据您目前描述的症状，我在数据库里筛到以下更匹配的医生：",
    ...lines,
    "如果您愿意，我可以继续帮您比较这几位医生，并给出优先预约建议。",
  ].join("\n");
};

const buildGroundedRecommendationMessage = async (
  isEnglish: boolean,
  symptoms: string,
  recommendations: GroundedDoctorRecommendation[]
) => {
  if (recommendations.length === 0) {
    return buildGroundedRecommendationMessageTemplate(
      isEnglish,
      recommendations
    );
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: isEnglish
            ? `You are a medical triage assistant. Write a natural, empathetic chat reply.
Requirements:
1) Use ONLY the doctors/hospitals/departments provided in input JSON. Do not add or change any names.
2) Keep conversational flow like a normal AI assistant, not rigid bullet templates.
3) Briefly connect symptoms to why these doctors fit.
4) End with one concise next-step question.
5) Respond only in English.`
            : `你是医疗分诊助手。请写一段自然、有同理心的对话回复。
要求：
1）只能使用输入 JSON 里给出的医生/医院/科室，不得新增或改名；
2）语气像正常 AI 对话，不要僵硬模板；
3）简要解释这些医生与症状的匹配原因；
4）结尾给一个简洁的下一步追问；
5）仅用中文回复。`,
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              symptoms,
              recommendations,
            },
            null,
            2
          ),
        },
      ],
    });

    const text = (
      response.choices[0].message.content as string | undefined
    )?.trim();
    if (text && text.length > 0) {
      return text;
    }
  } catch (error) {
    console.warn(
      "[Chat] Failed to generate natural grounded response, falling back:",
      error
    );
  }

  return buildGroundedRecommendationMessageTemplate(isEnglish, recommendations);
};

const buildNoMatchFollowupMessage = (isEnglish: boolean) =>
  isEnglish
    ? [
        "I don't have enough clearly matched doctors in our current database yet.",
        "To narrow it down accurately, could you share:",
        "1) where the discomfort is most obvious,",
        "2) whether you have nausea/vomiting/diarrhea or cough/phlegm/chest pain,",
        "3) whether symptoms worsen after meals, activity, or at night?",
        "Once you add these details, I can give a more precise recommendation.",
      ].join("\n")
    : [
        "目前数据库里还没有足够明确匹配的医生结果。",
        "为了更准确筛选，请再补充三点：",
        "1）不适最明显的部位；",
        "2）是否伴随恶心/呕吐/腹泻，或咳嗽/咳痰/胸痛；",
        "3）症状是否在饭后、活动后或夜间加重。",
        "您补充后，我会马上给出更精准的推荐。",
      ].join("\n");

const buildMatchedReason = (
  isEnglish: boolean,
  result: Awaited<ReturnType<typeof db.searchDoctors>>[number]
) => {
  const departmentName = isEnglish
    ? result.department.nameEn || result.department.name
    : result.department.name;
  const rawExpertise = isEnglish
    ? result.doctor.expertiseEn || result.doctor.expertise || ""
    : result.doctor.expertise || result.doctor.expertiseEn || "";
  const expertise = rawExpertise.replace(/\s+/g, " ").trim();
  const expertiseSnippet = expertise.length > 0 ? expertise.slice(0, 60) : "";

  if (expertiseSnippet.length > 0) {
    return isEnglish
      ? `Your symptoms are closer to ${departmentName}. This doctor's expertise includes: ${expertiseSnippet}${expertise.length > 60 ? "..." : ""}`
      : `您的症状更接近${departmentName}就诊方向，该医生擅长：${expertiseSnippet}${expertise.length > 60 ? "..." : ""}`;
  }

  return isEnglish
    ? `Your symptoms are aligned with ${departmentName}, so this doctor is a better fit for first consultation.`
    : `您的症状与${departmentName}方向更匹配，建议优先由该方向医生先评估。`;
};

const detectTriageLanguage = (
  messages: Array<{ role: string; content: string }>
): "en" | "zh" => {
  const lastUserMessage = [...messages]
    .reverse()
    .find(
      message => message.role === "user" && message.content.trim().length > 0
    );
  const sample =
    lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? "";
  return /[\u4e00-\u9fff]/.test(sample) ? "zh" : "en";
};

export const appRouter = router({
  system: systemRouter,

  ai: router({
    /**
     * Structured triage chat endpoint for phase-1 flow.
     * Returns strict JSON so frontend can safely branch between
     * follow-up questions and recommendation steps.
     */
    chatTriage: publicProcedure
      .input(
        z.object({
          messages: z
            .array(
              z.object({
                role: z.string(),
                content: z.string(),
              })
            )
            .min(1),
          lang: z.enum(["auto", "en", "zh"]).optional().default("auto"),
        })
      )
      .mutation(async ({ input }) => {
        const resolvedLang =
          input.lang === "auto"
            ? detectTriageLanguage(input.messages)
            : input.lang;
        try {
          return await processTriageChat(input.messages, resolvedLang);
        } catch (error) {
          console.error("[AI] chatTriage failed:", error);
          return {
            isComplete: false,
            reply:
              resolvedLang === "zh"
                ? "我正在整理你的信息。请补充主要症状持续了多久、是否有既往病史或正在用药。"
                : "I am organizing your triage details. Please share symptom duration, medical history, and current medications.",
          };
        }
      }),
  }),

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
      .input(
        z.object({
          sessionId: z.string().optional(),
          message: z.string(),
          chatHistory: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string(),
              })
            )
            .optional(),
          lang: z.enum(["auto", "en", "zh"]).optional().default("auto"),
        })
      )
      .mutation(async ({ input }) => {
        const sessionId = input.sessionId || nanoid();
        const chatHistory = input.chatHistory || [];
        const detectLanguage = (text: string) =>
          /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
        const resolvedLang =
          input.lang === "auto" ? detectLanguage(input.message) : input.lang;
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
            content: systemPrompt,
          },
          ...chatHistory.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            role: "user" as const,
            content: input.message,
          },
        ];

        // Get AI response (used for follow-up questioning / non-recommendation turns)
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
  "urgency": "low" | "medium" | "high",
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
  "urgency": "low" | "medium" | "high",
  "readyForRecommendation": true/false
}

关键词应包括疾病、症状、科室名称、治疗方式等。
关键词使用与输入一致的语言。
若已获得基本症状信息（即使仅 1-2 轮），readyForRecommendation 应为 true。`,
            },
            {
              role: "user",
              content: `Patient conversation history:\n${chatHistory.map(m => `${m.role}: ${m.content}`).join("\n")}\n\nLatest message: ${input.message}`,
            },
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
                    description: "Extracted medical keywords",
                  },
                  symptoms: {
                    type: "string",
                    description: "Symptom description",
                  },
                  duration: {
                    type: "string",
                    description: "Duration description",
                  },
                  age: {
                    type: ["number", "null"],
                    description: "Patient age",
                  },
                  urgency: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    description: "Triage urgency level",
                  },
                  readyForRecommendation: {
                    type: "boolean",
                    description: "Ready to recommend doctors",
                  },
                },
                required: [
                  "keywords",
                  "symptoms",
                  "duration",
                  "age",
                  "urgency",
                  "readyForRecommendation",
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const extraction = JSON.parse(
          extractionResponse.choices[0].message.content as string
        );

        // Search doctors if ready
        let recommendedDoctors: any[] = [];
        if (
          extraction.readyForRecommendation &&
          extraction.keywords.length > 0
        ) {
          type DoctorSearchResult = Awaited<
            ReturnType<typeof db.searchDoctors>
          >;

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
              vectorResults = await db.searchDoctorsByEmbedding(
                queryEmbedding,
                10
              );
            }
          } catch (error) {
            console.warn(
              "[RAG] Vector search failed, falling back to keyword search:",
              error
            );
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

          const intentTokens = normalizeIntentTokens(
            tokenizeForMatching(
              [extraction.symptoms, ...(extraction.keywords ?? [])]
                .filter(
                  (item: unknown): item is string =>
                    typeof item === "string" && item.trim().length > 0
                )
                .join(" ")
            )
          );
          const intentDepartments = detectIntentDepartments(
            [extraction.symptoms, ...(extraction.keywords ?? [])]
              .filter(
                (item: unknown): item is string =>
                  typeof item === "string" && item.trim().length > 0
              )
              .join(" ")
          );
          const scoredSearchResults = searchResults
            .map(result => ({
              result,
              score: scoreDoctorRelevance(
                result,
                intentTokens,
                intentDepartments
              ),
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
          const relevantSearchResults = scoredSearchResults.map(
            item => item.result
          );

          // Rank doctors using LLM
          if (relevantSearchResults.length > 0) {
            const doctorDescriptions = relevantSearchResults.map((r, idx) => ({
              id: r.doctor.id,
              index: idx,
              text: `${idx + 1}. ${
                isEnglish ? r.doctor.nameEn || placeholder : r.doctor.name
              } - ${
                isEnglish ? r.hospital.nameEn || placeholder : r.hospital.name
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
仅用中文返回。`,
                },
                {
                  role: "user",
                  content: `Patient needs: ${extraction.symptoms}
Keywords: ${extraction.keywords.join(", ")}

Candidate doctors:
${doctorDescriptions.map(d => d.text).join("\n\n")}`,
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
                  typeof item.reason === "string" &&
                  item.reason.trim().length > 0
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
              recommendedDoctors = relevantSearchResults
                .slice(0, 3)
                .map(result => ({
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
                (item): item is GroundedDoctorRecommendation => item !== null
              );

            if (groundedRecommendations.length > 0) {
              assistantMessage = await buildGroundedRecommendationMessage(
                isEnglish,
                extraction.symptoms,
                groundedRecommendations
              );
            }
          }

          // Avoid any hallucinated doctor/hospital names when recommendation flow is active.
          // If no grounded doctors are available, return a strict database-only fallback message.
          if (recommendedDoctors.length === 0) {
            assistantMessage = buildNoMatchFollowupMessage(isEnglish);
          }
        }

        // Update session
        const updatedHistory = [
          ...chatHistory,
          { role: "user" as const, content: input.message },
          { role: "assistant" as const, content: assistantMessage },
        ];

        await db.upsertPatientSession({
          sessionId,
          chatHistory: JSON.stringify(updatedHistory),
          symptoms: extraction.symptoms,
          duration: extraction.duration,
          age: extraction.age,
          recommendedDoctors:
            recommendedDoctors.length > 0
              ? JSON.stringify(recommendedDoctors)
              : null,
        });

        return {
          sessionId,
          message: assistantMessage,
          recommendedDoctors,
          extraction,
        };
      }),

    /**
     * Get session history
     */
    getSession: publicProcedure
      .input(
        z.object({
          sessionId: z.string(),
        })
      )
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
            : [],
        };
      }),
  }),

  doctors: router({
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
        return await db.getDoctorById(input.id);
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
        return await db.searchDoctors(input.keywords, input.limit, {
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
            normalizedKeywords.filter(keyword => /[a-zA-Z]/.test(keyword))
              .length >= Math.ceil(normalizedKeywords.length / 2);

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
                  const content =
                    translationResponse.choices[0].message.content;
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
            db.searchDoctors(zhQueryKeywords, 20, { lang: "zh" }),
            db.searchDoctors(enQueryKeywords, 20, {
              lang: "en",
              fallbackKeywords: translatedZhKeywords,
            }),
          ]);

          let vectorResults: Awaited<
            ReturnType<typeof db.searchDoctorsByEmbedding>
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
              vectorResults = await db.searchDoctorsByEmbedding(
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
      .input(
        z.object({
          hospitalId: z.number(),
        })
      )
      .query(async ({ input }) => {
        return await db.getDepartmentsByHospital(input.hospitalId);
      }),
  }),

  appointments: appointmentsRouter,
  visit: visitRouter,
});

export type AppRouter = typeof appRouter;
