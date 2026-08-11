import { invokeLLM } from "../../_core/llm";
import { visitChatSessionApi as sessions } from "../visit/publicApi";
import { nanoid } from "nanoid";
import {
  buildDoctorRecommendation,
  type ChatMedicalExtraction,
} from "./doctorRecommendationWorkflow";
import type { GetSessionInput, SendMessageInput } from "./schemas";

export async function sendMessageAction(input: SendMessageInput) {
  const sessionId = input.sessionId || nanoid();
  const chatHistory = input.chatHistory || [];
  const detectLanguage = (text: string) =>
    /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";
  const resolvedLang =
    input.lang === "auto" ? detectLanguage(input.message) : input.lang;
  const isEnglish = resolvedLang === "en";

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

  const aiResponse = await invokeLLM({ messages });
  let assistantMessage = aiResponse.choices[0].message.content as string;

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
  ) as ChatMedicalExtraction;
  const recommendation = await buildDoctorRecommendation({
    extraction,
    isEnglish,
    assistantMessage,
  });
  assistantMessage = recommendation.assistantMessage;
  const recommendedDoctors = recommendation.recommendedDoctors;

  const updatedHistory = [
    ...chatHistory,
    { role: "user" as const, content: input.message },
    { role: "assistant" as const, content: assistantMessage },
  ];

  await sessions.upsertSession({
    sessionId,
    chatHistory: JSON.stringify(updatedHistory),
    symptoms: extraction.symptoms,
    duration: extraction.duration,
    age: extraction.age,
    recommendedDoctors:
      recommendedDoctors.length > 0 ? JSON.stringify(recommendedDoctors) : null,
  });

  return {
    sessionId,
    message: assistantMessage,
    recommendedDoctors,
    extraction,
  };
}

export async function getSessionAction(input: GetSessionInput) {
  const session = await sessions.getSession(input.sessionId);
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
}
