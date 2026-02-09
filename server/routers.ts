import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { nanoid } from "nanoid";

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
      }))
      .mutation(async ({ input }) => {
        const sessionId = input.sessionId || nanoid();
        const chatHistory = input.chatHistory || [];
        
        // Build conversation history
        const messages = [
          {
            role: "system" as const,
            content: `你是MediBridge的医疗咨询助手，帮助患者找到合适的医生。你的任务是：
1. 友好地询问患者的症状、病程、年龄等信息
2. 根据患者描述，提取关键医疗关键词（疾病名称、症状、专科等）
3. 如果信息不足，继续询问以获取更准确的推荐
4. 当信息充足时，告知患者你将为其推荐合适的医生

请用温暖、专业的语气与患者交流。不要直接给出医疗建议，而是帮助患者找到合适的专科医生。`
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
        const assistantMessage = aiResponse.choices[0].message.content as string;

        // Extract medical keywords using LLM
        const extractionResponse = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `从患者的对话中提取医疗关键词。返回JSON格式：
{
  "keywords": ["关键词1", "关键词2"],
  "symptoms": "症状描述",
  "duration": "病程",
  "age": 年龄数字或null,
  "readyForRecommendation": true/false
}

关键词应包括：疾病名称、症状、专科名称、治疗方式等。
readyForRecommendation表示是否有足够信息推荐医生。`
            },
            {
              role: "user",
              content: `患者对话历史：\n${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\n最新消息：${input.message}`
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
                    description: "提取的医疗关键词"
                  },
                  symptoms: {
                    type: "string",
                    description: "症状描述"
                  },
                  duration: {
                    type: "string",
                    description: "病程描述"
                  },
                  age: {
                    type: ["number", "null"],
                    description: "患者年龄"
                  },
                  readyForRecommendation: {
                    type: "boolean",
                    description: "是否准备好推荐医生"
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
          const searchResults = await db.searchDoctors(extraction.keywords, 10);
          
          // Rank doctors using LLM
          if (searchResults.length > 0) {
            const doctorDescriptions = searchResults.map((r, idx) => ({
              id: r.doctor.id,
              index: idx,
              text: `${idx + 1}. ${r.doctor.name} - ${r.hospital.name} ${r.department.name}
职称：${r.doctor.title || '未知'}
专业擅长：${r.doctor.expertise?.substring(0, 200) || '暂无信息'}
推荐度：${r.doctor.recommendationScore || 'N/A'}`
            }));

            const rankingResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `根据患者需求，从候选医生中选择最合适的3-5位医生，按相关性排序。
返回JSON格式：
{
  "selectedDoctors": [
    {
      "doctorId": 医生ID,
      "reason": "推荐理由"
    }
  ]
}`
                },
                {
                  role: "user",
                  content: `患者需求：${extraction.symptoms}
关键词：${extraction.keywords.join(', ')}

候选医生：
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

            const ranking = JSON.parse(rankingResponse.choices[0].message.content as string);
            recommendedDoctors = ranking.selectedDoctors;
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
        limit: z.number().optional()
      }))
      .query(async ({ input }) => {
        return await db.searchDoctors(input.keywords, input.limit);
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
