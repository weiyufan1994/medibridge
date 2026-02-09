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
            content: `You are MediBridge's medical consultation assistant, helping North American patients find suitable doctors in Shanghai, China. Your tasks:

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
- Do not provide medical diagnoses - focus on connecting patients with the right specialists`
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
              content: `Extract medical keywords from patient conversation. Return JSON format:
{
  "keywords": ["keyword1", "keyword2"],
  "symptoms": "symptom description",
  "duration": "duration description",
  "age": age_number or null,
  "readyForRecommendation": true/false
}

Keywords should include: disease names, symptoms, specialty names, treatment methods, etc.
readyForRecommendation should be true if you have basic symptom information (even after just 1-2 exchanges), so we can show doctor recommendations proactively.`
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
          const searchResults = await db.searchDoctors(extraction.keywords, 10);
          
          // Rank doctors using LLM
          if (searchResults.length > 0) {
            const doctorDescriptions = searchResults.map((r, idx) => ({
              id: r.doctor.id,
              index: idx,
              text: `${idx + 1}. ${r.doctor.name} - ${r.hospital.name} ${r.department.name}
Title: ${r.doctor.title || 'Unknown'}
Expertise: ${r.doctor.expertise?.substring(0, 200) || 'No information'}
Recommendation Score: ${r.doctor.recommendationScore || 'N/A'}`
            }));

            const rankingResponse = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `Based on patient needs, select the 3-5 most suitable doctors from candidates, ranked by relevance.
Return JSON format:
{
  "selectedDoctors": [
    {
      "doctorId": doctor_id,
      "reason": "recommendation reason"
    }
  ]
}`
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
